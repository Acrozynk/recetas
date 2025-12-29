import { NextResponse } from "next/server";
import { searchGroceries, getProductsByCategory, GROCERY_CATEGORIES } from "@/lib/spanish-groceries";

// GET search grocery products
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // If a query is provided, search across all products
    if (query) {
      const results = searchGroceries(query, limit);
      return NextResponse.json({
        results,
        total: results.length,
      });
    }

    // If a category is provided, return products in that category
    if (category) {
      const products = getProductsByCategory(category);
      return NextResponse.json({
        results: products.slice(0, limit),
        total: products.length,
      });
    }

    // If no query or category, return categories
    return NextResponse.json({
      categories: GROCERY_CATEGORIES,
    });
  } catch (error) {
    console.error("Error searching groceries:", error);
    return NextResponse.json(
      { error: "Failed to search groceries" },
      { status: 500 }
    );
  }
}


