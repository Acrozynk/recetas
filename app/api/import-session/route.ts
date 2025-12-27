import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseCopyMeThatExport, type ParsedRecipe } from "@/lib/parse-copymthat";

export interface ImportRecipeEntry {
  original: ParsedRecipe;
  status: "pending" | "accepted" | "edited" | "discarded";
  edited: ParsedRecipe | null;
  imported_id: string | null;
}

export interface ImportSession {
  id: string;
  source: string;
  total_recipes: number;
  current_index: number;
  status: "active" | "completed" | "abandoned";
  recipes: ImportRecipeEntry[];
  image_mapping: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// GET: Get active session or specific session by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (sessionId) {
      // Get specific session
      const { data, error } = await supabase
        .from("import_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    // Get active session (most recent)
    const { data, error } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching session:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data || null });
  } catch (error) {
    console.error("GET session error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// POST: Create new session from HTML file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const htmlFile = formData.get("html") as File | null;

    if (!htmlFile) {
      return NextResponse.json({ error: "No HTML file provided" }, { status: 400 });
    }

    const htmlText = await htmlFile.text();
    const parsedRecipes = parseCopyMeThatExport(htmlText);

    if (parsedRecipes.length === 0) {
      return NextResponse.json(
        { error: "No recipes found in the HTML file" },
        { status: 400 }
      );
    }

    // Create recipe entries with pending status
    const recipes: ImportRecipeEntry[] = parsedRecipes.map((recipe) => ({
      original: recipe,
      status: "pending",
      edited: null,
      imported_id: null,
    }));

    // Abandon any existing active sessions
    await supabase
      .from("import_sessions")
      .update({ status: "abandoned" })
      .eq("status", "active");

    // Create new session
    const { data, error } = await supabase
      .from("import_sessions")
      .insert({
        source: "copymethat",
        total_recipes: recipes.length,
        current_index: 0,
        status: "active",
        recipes,
        image_mapping: {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating session:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      session: data,
      message: `Created import session with ${recipes.length} recipes`,
    });
  } catch (error) {
    console.error("POST session error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// PATCH: Update session (review a recipe, update progress)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, recipeIndex, editedRecipe, importedId, imageMapping } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const recipes: ImportRecipeEntry[] = session.recipes;
    let currentIndex = session.current_index;
    let newImageMapping = session.image_mapping || {};

    // Handle different actions
    switch (action) {
      case "accept":
        if (recipeIndex !== undefined && recipes[recipeIndex]) {
          recipes[recipeIndex].status = "accepted";
          recipes[recipeIndex].imported_id = importedId || null;
        }
        break;

      case "edit":
        if (recipeIndex !== undefined && recipes[recipeIndex] && editedRecipe) {
          recipes[recipeIndex].status = "edited";
          recipes[recipeIndex].edited = editedRecipe;
          recipes[recipeIndex].imported_id = importedId || null;
        }
        break;

      case "discard":
        if (recipeIndex !== undefined && recipes[recipeIndex]) {
          recipes[recipeIndex].status = "discarded";
        }
        break;

      case "navigate":
        if (recipeIndex !== undefined && recipeIndex >= 0 && recipeIndex < recipes.length) {
          currentIndex = recipeIndex;
        }
        break;

      case "update_images":
        if (imageMapping) {
          newImageMapping = { ...newImageMapping, ...imageMapping };
        }
        break;

      case "complete":
        // Mark session as completed
        const { error: completeError } = await supabase
          .from("import_sessions")
          .update({
            status: "completed",
            recipes,
            current_index: currentIndex,
          })
          .eq("id", sessionId);

        if (completeError) {
          return NextResponse.json({ error: completeError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: "completed" });

      case "abandon":
        const { error: abandonError } = await supabase
          .from("import_sessions")
          .update({ status: "abandoned" })
          .eq("id", sessionId);

        if (abandonError) {
          return NextResponse.json({ error: abandonError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: "abandoned" });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Move to next recipe after accept/edit/discard
    if (["accept", "edit", "discard"].includes(action)) {
      // Find next pending recipe
      let nextIndex = currentIndex + 1;
      while (nextIndex < recipes.length && recipes[nextIndex].status !== "pending") {
        nextIndex++;
      }
      if (nextIndex < recipes.length) {
        currentIndex = nextIndex;
      }
    }

    // Check if all recipes have been reviewed
    const allReviewed = recipes.every((r) => r.status !== "pending");
    const newStatus = allReviewed ? "completed" : "active";

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from("import_sessions")
      .update({
        recipes,
        current_index: currentIndex,
        status: newStatus,
        image_mapping: newImageMapping,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: recipes.length,
      pending: recipes.filter((r) => r.status === "pending").length,
      accepted: recipes.filter((r) => r.status === "accepted").length,
      edited: recipes.filter((r) => r.status === "edited").length,
      discarded: recipes.filter((r) => r.status === "discarded").length,
    };

    return NextResponse.json({
      session: updatedSession,
      stats,
      isComplete: newStatus === "completed",
    });
  } catch (error) {
    console.error("PATCH session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE: Delete/abandon a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("import_sessions")
      .update({ status: "abandoned" })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE session error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

