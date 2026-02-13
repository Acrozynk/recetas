import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET all shopping items for a week
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start");

    if (!weekStart) {
      return NextResponse.json(
        { error: "week_start is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("week_start", weekStart)
      .order("category")
      .order("checked")
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shopping items:", error);
    return NextResponse.json(
      { error: "Failed to fetch shopping items" },
      { status: 500 }
    );
  }
}

// POST create a new shopping item
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from("shopping_items")
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating shopping item:", error);
    return NextResponse.json(
      { error: "Failed to create shopping item" },
      { status: 500 }
    );
  }
}

// PATCH update a shopping item
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
      .from("shopping_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating shopping item:", error);
    return NextResponse.json(
      { error: "Failed to update shopping item" },
      { status: 500 }
    );
  }
}

// DELETE a shopping item
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

    const { error } = await supabase.from("shopping_items").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shopping item:", error);
    return NextResponse.json(
      { error: "Failed to delete shopping item" },
      { status: 500 }
    );
  }
}
























