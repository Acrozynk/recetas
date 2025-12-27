import { NextRequest, NextResponse } from "next/server";
import { 
  detectRecipeLanguage, 
  translateText, 
  translateTexts,
  translateRecipeWithDictionary,
} from "@/lib/translate";
import type { ParsedRecipe } from "@/lib/parse-copymthat";

export async function POST(request: NextRequest) {
  try {
    const { recipe, useDictionaryOnly } = await request.json() as { 
      recipe: ParsedRecipe;
      useDictionaryOnly?: boolean;
    };

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
        message: "La receta ya está en español" 
      });
    }

    // If dictionary-only mode is requested, use fast local translation
    if (useDictionaryOnly) {
      const translatedRecipe = translateRecipeWithDictionary(recipe) as ParsedRecipe;
      return NextResponse.json({ 
        recipe: translatedRecipe, 
        translated: true,
        method: "dictionary",
        originalLanguage: language,
        message: "Receta traducida con diccionario local" 
      });
    }

    console.log("Starting translation for:", recipe.title);

    // Try API translation with timeout
    try {
      // Translate recipe fields
      const [
        translatedTitle,
        translatedDescription,
      ] = await Promise.all([
        translateText(recipe.title),
        recipe.description ? translateText(recipe.description) : Promise.resolve(null),
      ]);

      // Translate ingredients (names and units)
      const ingredientNames = recipe.ingredients.map(i => i.name);
      const ingredientUnits = recipe.ingredients.map(i => i.unit);
      
      const [translatedIngredientNames, translatedIngredientUnits] = await Promise.all([
        translateTexts(ingredientNames),
        translateTexts(ingredientUnits),
      ]);
      
      const translatedIngredients = recipe.ingredients.map((ing, i) => ({
        ...ing,
        name: translatedIngredientNames[i] || ing.name, // Fallback to original
        unit: translatedIngredientUnits[i] || ing.unit,
      }));

      // Translate instructions
      const instructionTexts = recipe.instructions.map(i => 
        typeof i === "string" ? i : i.text
      );
      const translatedInstructionTexts = await translateTexts(instructionTexts);
      
      const translatedInstructions = recipe.instructions.map((inst, i) => {
        const translatedText = translatedInstructionTexts[i] || 
          (typeof inst === "string" ? inst : inst.text); // Fallback
        
        if (typeof inst === "string") {
          return { text: translatedText, ingredientIndices: [] };
        }
        return {
          ...inst,
          text: translatedText,
        };
      });

      // Translate notes if present
      const translatedNotes = recipe.notes 
        ? await translateText(recipe.notes)
        : null;

      // Translate tags
      const translatedTags = await translateTexts(recipe.tags);

      const translatedRecipe: ParsedRecipe = {
        ...recipe,
        title: translatedTitle || recipe.title,
        description: translatedDescription,
        ingredients: translatedIngredients,
        instructions: translatedInstructions,
        notes: translatedNotes || recipe.notes,
        tags: translatedTags.map((t, i) => t || recipe.tags[i]),
      };

      // Verify translation worked (check if at least title changed or ingredients have values)
      const hasValidIngredients = translatedRecipe.ingredients.every(
        ing => ing.name && ing.name.trim().length > 0
      );

      if (!hasValidIngredients) {
        console.warn("Translation produced empty ingredients, falling back to dictionary");
        const fallbackRecipe = translateRecipeWithDictionary(recipe) as ParsedRecipe;
        return NextResponse.json({ 
          recipe: fallbackRecipe, 
          translated: true,
          method: "dictionary",
          originalLanguage: language,
          message: "Traducido con diccionario (API no disponible)" 
        });
      }

      return NextResponse.json({ 
        recipe: translatedRecipe, 
        translated: true,
        method: "api",
        originalLanguage: language,
        message: "Receta traducida al español" 
      });

    } catch (apiError) {
      console.error("API translation failed, using dictionary:", apiError);
      
      // Fallback to dictionary translation
      const translatedRecipe = translateRecipeWithDictionary(recipe) as ParsedRecipe;
      return NextResponse.json({ 
        recipe: translatedRecipe, 
        translated: true,
        method: "dictionary",
        originalLanguage: language,
        message: "Traducido con diccionario (API no disponible)" 
      });
    }

  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Error al traducir la receta" },
      { status: 500 }
    );
  }
}

