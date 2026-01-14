import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SupermarketName } from "@/lib/supabase";

// GET item suggestions for a supermarket based on purchase history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supermarket = searchParams.get("supermarket") as SupermarketName | null;
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!supermarket) {
      return NextResponse.json(
        { error: "supermarket is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("item_supermarket_history")
      .select("*")
      .eq("supermarket", supermarket)
      .order("frequency", { ascending: false })
      .order("last_used_at", { ascending: false })
      .limit(limit);

    // If there's a search term, filter by it
    if (search) {
      query = query.ilike("item_name_normalized", `%${search.toLowerCase()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}














