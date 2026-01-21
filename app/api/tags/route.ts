import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET all unique tags from recipes
export async function GET() {
  try {
    const { data: recipes, error } = await supabase
      .from("recipes")
      .select("tags");

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }

    // Flatten and deduplicate tags
    const allTags = new Set<string>();
    recipes?.forEach((recipe) => {
      if (recipe.tags && Array.isArray(recipe.tags)) {
        recipe.tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim());
          }
        });
      }
    });

    // Return sorted array
    const sortedTags = Array.from(allTags).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return NextResponse.json({ tags: sortedTags });
  } catch (error) {
    console.error("Error in tags API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a tag across all recipes
export async function PUT(request: NextRequest) {
  try {
    const { oldTag, newTag } = await request.json();

    if (!oldTag || typeof oldTag !== "string" || !oldTag.trim()) {
      return NextResponse.json(
        { error: "Old tag is required" },
        { status: 400 }
      );
    }

    if (!newTag || typeof newTag !== "string" || !newTag.trim()) {
      return NextResponse.json(
        { error: "New tag is required" },
        { status: 400 }
      );
    }

    const oldTagTrimmed = oldTag.trim();
    const newTagTrimmed = newTag.trim();

    if (oldTagTrimmed === newTagTrimmed) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // Find all recipes with the old tag
    const { data: recipes, error: fetchError } = await supabase
      .from("recipes")
      .select("id, tags")
      .contains("tags", [oldTagTrimmed]);

    if (fetchError) throw fetchError;

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // Update each recipe, replacing the old tag with the new one
    let updatedCount = 0;
    for (const recipe of recipes) {
      const newTags = (recipe.tags as string[]).map((tag: string) =>
        tag === oldTagTrimmed ? newTagTrimmed : tag
      );

      // Remove duplicates in case new tag already exists
      const uniqueTags = [...new Set(newTags)];

      const { error: updateError } = await supabase
        .from("recipes")
        .update({ tags: uniqueTags })
        .eq("id", recipe.id);

      if (updateError) {
        console.error(`Error updating recipe ${recipe.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error("Error updating tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a tag from all recipes
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");

    if (!tag || !tag.trim()) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    const tagTrimmed = tag.trim();

    // Find all recipes with this tag
    const { data: recipes, error: fetchError } = await supabase
      .from("recipes")
      .select("id, tags")
      .contains("tags", [tagTrimmed]);

    if (fetchError) throw fetchError;

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Update each recipe, removing the tag
    let deletedCount = 0;
    for (const recipe of recipes) {
      const newTags = (recipe.tags as string[]).filter(
        (t: string) => t !== tagTrimmed
      );

      const { error: updateError } = await supabase
        .from("recipes")
        .update({ tags: newTags })
        .eq("id", recipe.id);

      if (updateError) {
        console.error(`Error updating recipe ${recipe.id}:`, updateError);
      } else {
        deletedCount++;
      }
    }

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}

