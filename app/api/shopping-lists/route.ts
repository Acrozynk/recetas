import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SupermarketName } from "@/lib/supabase";

// GET all shopping lists (with optional status filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'active', 'archived', or null for all
    const includeItems = searchParams.get("include_items") === "true";

    let query = supabase
      .from("shopping_lists")
      .select(includeItems ? "*, items:shopping_list_items(*)" : "*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shopping lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch shopping lists" },
      { status: 500 }
    );
  }
}

// POST create a new shopping list
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supermarket, name } = body as { supermarket: SupermarketName; name?: string };

    if (!supermarket) {
      return NextResponse.json(
        { error: "Supermarket is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert([{ supermarket, name: name || null }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating shopping list:", error);
    return NextResponse.json(
      { error: "Failed to create shopping list" },
      { status: 500 }
    );
  }
}

// PATCH update a shopping list (archive/unarchive)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, name } = body;

    if (!id) {
      return NextResponse.json(
        { error: "List ID is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      updates.status = status;
      updates.archived_at = status === "archived" ? new Date().toISOString() : null;
    }
    if (name !== undefined) {
      updates.name = name;
    }

    const { data, error } = await supabase
      .from("shopping_lists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating shopping list:", error);
    return NextResponse.json(
      { error: "Failed to update shopping list" },
      { status: 500 }
    );
  }
}

// DELETE a shopping list
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const deleteOld = searchParams.get("delete_old") === "true"; // Delete archived lists older than 30 days

    if (deleteOld) {
      // Delete all archived lists older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase
        .from("shopping_lists")
        .delete()
        .eq("status", "archived")
        .lt("archived_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      return NextResponse.json({ success: true, message: "Old archived lists deleted" });
    }

    if (!id) {
      return NextResponse.json(
        { error: "List ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("shopping_lists")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shopping list:", error);
    return NextResponse.json(
      { error: "Failed to delete shopping list" },
      { status: 500 }
    );
  }
}


















