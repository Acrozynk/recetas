import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET items for a shopping list
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("list_id");

    if (!listId) {
      return NextResponse.json(
        { error: "list_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("category")
      .order("checked")
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shopping list items:", error);
    return NextResponse.json(
      { error: "Failed to fetch shopping list items" },
      { status: 500 }
    );
  }
}

// POST create a new shopping list item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { list_id, name, quantity, category, recipe_id } = body;

    if (!list_id || !name) {
      return NextResponse.json(
        { error: "list_id and name are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert([{
        list_id,
        name: name.trim(),
        quantity: quantity || null,
        category: category || "Otros",
        recipe_id: recipe_id || null,
        checked: false,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating shopping list item:", error);
    return NextResponse.json(
      { error: "Failed to create shopping list item" },
      { status: 500 }
    );
  }
}

// PATCH update a shopping list item
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating shopping list item:", error);
    return NextResponse.json(
      { error: "Failed to update shopping list item" },
      { status: 500 }
    );
  }
}

// DELETE a shopping list item
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shopping list item:", error);
    return NextResponse.json(
      { error: "Failed to delete shopping list item" },
      { status: 500 }
    );
  }
}
















