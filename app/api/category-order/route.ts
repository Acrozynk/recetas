import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SupermarketName } from "@/lib/supabase";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

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
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}

// PUT update category order for a supermarket (replace all rows for that store)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { supermarket, categories } = body as {
      supermarket: SupermarketName;
      categories: string[];
    };

    if (!supermarket || !categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: "Supermarket and categories array are required" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("supermarket_category_order")
      .delete()
      .eq("supermarket", supermarket);

    if (deleteError) throw deleteError;

    const rows = categories.map((category, index) => ({
      supermarket,
      category,
      sort_order: index + 1,
    }));

    const { data, error: insertError } = await supabase
      .from("supermarket_category_order")
      .insert(rows)
      .select("*");

    if (insertError) throw insertError;

    const sorted = (data || []).sort((a, b) => a.sort_order - b.sort_order);
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Error updating category order:", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}
