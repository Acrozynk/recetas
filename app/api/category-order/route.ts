import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SupermarketName } from "@/lib/supabase";

// GET category order for a supermarket
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supermarket = searchParams.get("supermarket") as SupermarketName | null;

    let query = supabase
      .from("supermarket_category_order")
      .select("*")
      .order("sort_order", { ascending: true });

    if (supermarket) {
      query = query.eq("supermarket", supermarket);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching category order:", error);
    return NextResponse.json(
      { error: "Failed to fetch category order" },
      { status: 500 }
    );
  }
}

// PUT update category order for a supermarket
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { supermarket, categories } = body as {
      supermarket: SupermarketName;
      categories: string[];
    };

    if (!supermarket || !categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "Supermarket and categories array are required" },
        { status: 400 }
      );
    }

    // Update each category's sort order
    const updates = categories.map((category, index) => ({
      supermarket,
      category,
      sort_order: index + 1,
    }));

    // Use upsert to update or insert
    const { error } = await supabase
      .from("supermarket_category_order")
      .upsert(updates, {
        onConflict: "supermarket,category",
      });

    if (error) throw error;

    // Fetch and return the updated order
    const { data, error: fetchError } = await supabase
      .from("supermarket_category_order")
      .select("*")
      .eq("supermarket", supermarket)
      .order("sort_order", { ascending: true });

    if (fetchError) throw fetchError;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating category order:", error);
    return NextResponse.json(
      { error: "Failed to update category order" },
      { status: 500 }
    );
  }
}




















