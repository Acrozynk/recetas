import { NextRequest, NextResponse } from "next/server";
import { 
  detectRecipeLanguage, 
  translateText, 
  translateTexts 
} from "@/lib/translate";
import type { ParsedRecipe } from "@/lib/parse-copymthat";

export async function POST(request: NextRequest) {
  try {
    const { recipe } = await request.json() as { recipe: ParsedRecipe };

    if (!recipe) {
      return NextResponse.json({ error: "No recipe provided" }, { status: 400 });
    }

    // Detect language
    const language = detectRecipeLanguage(recipe);
    
    if (language === "es") {
      // Already in Spanish, return as-is
      return NextResponse.json({ 
        recipe, 
        translated: false,
        message: "Recipe is already in Spanish" 
      });
    }

    if (language === "unknown") {
      // Can't determine language, try translating anyway
      console.log("Unknown language, attempting translation anyway");
    }

    // Translate recipe fields
    const [
      translatedTitle,
      translatedDescription,
    ] = await Promise.all([
      translateText(recipe.title),
      recipe.description ? translateText(recipe.description) : Promise.resolve(null),
    ]);

    // Translate ingredients
    const ingredientNames = recipe.ingredients.map(i => i.name);
    const translatedIngredientNames = await translateTexts(ingredientNames);
    
    const translatedIngredients = recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: translatedIngredientNames[i],
    }));

    // Translate instructions
    const instructionTexts = recipe.instructions.map(i => 
      typeof i === "string" ? i : i.text
    );
    const translatedInstructionTexts = await translateTexts(instructionTexts);
    
    const translatedInstructions = recipe.instructions.map((inst, i) => {
      if (typeof inst === "string") {
        return { text: translatedInstructionTexts[i], ingredientIndices: [] };
      }
      return {
        ...inst,
        text: translatedInstructionTexts[i],
      };
    });

    // Translate notes if present
    const translatedNotes = recipe.notes 
      ? await translateText(recipe.notes)
      : null;

    // Translate tags (common cooking tags)
    const translatedTags = await translateTexts(recipe.tags);

    const translatedRecipe: ParsedRecipe = {
      ...recipe,
      title: translatedTitle,
      description: translatedDescription,
      ingredients: translatedIngredients,
      instructions: translatedInstructions,
      notes: translatedNotes,
      tags: translatedTags,
    };

    return NextResponse.json({ 
      recipe: translatedRecipe, 
      translated: true,
      originalLanguage: language,
      message: "Recipe translated to Spanish" 
    });

  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Failed to translate recipe" },
      { status: 500 }
    );
  }
}

