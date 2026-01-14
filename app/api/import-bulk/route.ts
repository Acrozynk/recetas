import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseCopyMeThatExport, type ParsedRecipe } from "@/lib/parse-copymthat";

// Max file sizes
const MAX_HTML_SIZE = 50 * 1024 * 1024; // 50MB for HTML (can be large with many recipes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const htmlFile = formData.get("html") as File | null;
    const action = formData.get("action") as string;

    // Step 1: Parse HTML and return recipe list for preview
    if (action === "parse") {
      if (!htmlFile) {
        return NextResponse.json({ error: "No HTML file provided" }, { status: 400 });
      }

      if (htmlFile.size > MAX_HTML_SIZE) {
        return NextResponse.json(
          { error: "HTML file too large. Maximum size is 50MB." },
          { status: 400 }
        );
      }

      const htmlText = await htmlFile.text();
      const recipes = parseCopyMeThatExport(htmlText);

      if (recipes.length === 0) {
        return NextResponse.json(
          { error: "No recipes found in the HTML file" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        recipes,
        total: recipes.length,
      });
    }

    // Step 2: Import selected recipes with images
    if (action === "import") {
      const recipesJson = formData.get("recipes") as string;
      const selectedIndices = formData.get("selectedIndices") as string;

      if (!recipesJson || !selectedIndices) {
        return NextResponse.json(
          { error: "Missing recipes or selection data" },
          { status: 400 }
        );
      }

      const allRecipes: ParsedRecipe[] = JSON.parse(recipesJson);
      const indices: number[] = JSON.parse(selectedIndices);
      const selectedRecipes = indices.map((i) => allRecipes[i]);

      // Collect all image files from formData
      const imageFiles = new Map<string, File>();
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("image:") && value instanceof File) {
          const imagePath = key.replace("image:", "");
          imageFiles.set(imagePath, value);
        }
      }

      const results: { success: boolean; title: string; error?: string }[] = [];

      for (const recipe of selectedRecipes) {
        try {
          let finalImageUrl = recipe.image_url;

          // If recipe has a local image path, try to upload it
          if (recipe.local_image_path && imageFiles.has(recipe.local_image_path)) {
            const imageFile = imageFiles.get(recipe.local_image_path)!;

            // Validate image
            if (ALLOWED_IMAGE_TYPES.includes(imageFile.type) && imageFile.size <= MAX_IMAGE_SIZE) {
              // Generate unique filename
              const timestamp = Date.now();
              const randomString = Math.random().toString(36).substring(2, 8);
              const extension = imageFile.name.split(".").pop() || "jpg";
              const filename = `${timestamp}-${randomString}.${extension}`;

              // Upload to Supabase Storage
              const arrayBuffer = await imageFile.arrayBuffer();
              const buffer = new Uint8Array(arrayBuffer);

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from("recipe-images")
                .upload(filename, buffer, {
                  contentType: imageFile.type,
                  cacheControl: "3600",
                  upsert: false,
                });

              if (!uploadError && uploadData) {
                const { data: urlData } = supabase.storage
                  .from("recipe-images")
                  .getPublicUrl(uploadData.path);
                finalImageUrl = urlData.publicUrl;
              } else {
                console.error("Image upload error:", uploadError);
              }
            }
          }

          // Prepare recipe for database
          const recipeData = {
            title: recipe.title,
            description: recipe.description,
            source_url: recipe.source_url,
            image_url: finalImageUrl,
            prep_time_minutes: recipe.prep_time_minutes,
            cook_time_minutes: recipe.cook_time_minutes,
            servings: recipe.servings,
            tags: recipe.tags,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            notes: recipe.notes,
            rating: recipe.rating,
            made_it: recipe.made_it,
          };

          const { error: insertError } = await supabase.from("recipes").insert([recipeData]);

          if (insertError) {
            console.error("Insert error for recipe:", recipe.title, insertError);
            results.push({ success: false, title: recipe.title, error: insertError.message });
          } else {
            results.push({ success: true, title: recipe.title });
          }
        } catch (err) {
          console.error("Error importing recipe:", recipe.title, err);
          results.push({
            success: false,
            title: recipe.title,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      return NextResponse.json({
        success: true,
        imported: successCount,
        failed: failedCount,
        results,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}














