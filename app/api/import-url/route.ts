import { NextResponse } from "next/server";
import { parseRecipeFromUrl } from "@/lib/parse-recipe-url";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const recipe = await parseRecipeFromUrl(url);

    // Validate that we got some content
    if (!recipe.title || recipe.title === "Untitled Recipe") {
      return NextResponse.json(
        { error: "Could not extract recipe from this URL. The page may not contain recipe data." },
        { status: 422 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Error importing from URL:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to import recipe from URL" },
      { status: 500 }
    );
  }
}









