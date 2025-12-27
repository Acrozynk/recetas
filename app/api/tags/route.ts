import { NextResponse } from "next/server";
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

