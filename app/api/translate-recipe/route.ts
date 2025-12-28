import { NextRequest, NextResponse } from "next/server";
import { 
  detectRecipeLanguage, 
  translateText, 
  translateTexts,
  translateRecipeWithDictionary,
  translateWithDictionary,
} from "@/lib/translate";
import type { ParsedRecipe } from "@/lib/parse-copymthat";

/**
 * Ensure all ingredients have valid names (never empty)
 */
function ensureValidIngredients(
  translatedIngredients: ParsedRecipe["ingredients"], 
  originalIngredients: ParsedRecipe["ingredients"]
): ParsedRecipe["ingredients"] {
  return translatedIngredients.map((ing, i) => {
    const original = originalIngredients[i];
    
    // Ensure name is never empty
    let name = ing.name;
    if (!name || name.trim().length === 0) {
      // Try dictionary translation of original
      name = translateWithDictionary(original?.name || "") || original?.name || "";
    }
    
    // Ensure unit is valid
    let unit = ing.unit;
    if (!unit && original?.unit) {
      unit = translateWithDictionary(original.unit) || original.unit;
    }
    
    return {
      ...ing,
      name: name || original?.name || "",
      unit: unit || "",
      amount: ing.amount || original?.amount || "",
    };
  });
}

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
      // Ensure ingredients are valid
      translatedRecipe.ingredients = ensureValidIngredients(
        translatedRecipe.ingredients, 
        recipe.ingredients
      );
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
      const ingredientNames = recipe.ingredients.map(i => i.name || "");
      const ingredientUnits = recipe.ingredients.map(i => i.unit || "");
      
      console.log("Translating ingredient names:", ingredientNames);
      
      const [translatedIngredientNames, translatedIngredientUnits] = await Promise.all([
        translateTexts(ingredientNames),
        translateTexts(ingredientUnits),
      ]);
      
      console.log("Translated ingredient names:", translatedIngredientNames);
      
      // Build translated ingredients with fallbacks
      const translatedIngredients = recipe.ingredients.map((ing, i) => ({
        ...ing,
        // Use translated name, fallback to dictionary, fallback to original
        name: (translatedIngredientNames[i] && translatedIngredientNames[i].trim().length > 0) 
          ? translatedIngredientNames[i] 
          : (translateWithDictionary(ing.name) || ing.name),
        unit: (translatedIngredientUnits[i] && translatedIngredientUnits[i].trim().length > 0)
          ? translatedIngredientUnits[i]
          : (translateWithDictionary(ing.unit) || ing.unit),
      }));

      // Translate instructions
      const instructionTexts = recipe.instructions.map(i => 
        typeof i === "string" ? i : i.text
      );
      const translatedInstructionTexts = await translateTexts(instructionTexts);
      
      const translatedInstructions = recipe.instructions.map((inst, i) => {
        const originalText = typeof inst === "string" ? inst : inst.text;
        const translatedText = (translatedInstructionTexts[i] && translatedInstructionTexts[i].trim().length > 0)
          ? translatedInstructionTexts[i]
          : (translateWithDictionary(originalText) || originalText);
        
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

      let translatedRecipe: ParsedRecipe = {
        ...recipe,
        title: (translatedTitle && translatedTitle.trim().length > 0) 
          ? translatedTitle 
          : (translateWithDictionary(recipe.title) || recipe.title),
        description: translatedDescription,
        ingredients: translatedIngredients,
        instructions: translatedInstructions,
        notes: translatedNotes || recipe.notes,
        tags: translatedTags.map((t, i) => (t && t.trim().length > 0) ? t : recipe.tags[i]),
      };

      // Final validation - ensure all ingredients have valid names
      translatedRecipe.ingredients = ensureValidIngredients(
        translatedRecipe.ingredients,
        recipe.ingredients
      );

      // Verify translation worked (check if at least title changed or ingredients have values)
      const hasValidIngredients = translatedRecipe.ingredients.every(
        ing => ing.name && ing.name.trim().length > 0
      );

      if (!hasValidIngredients) {
        console.warn("Translation still has empty ingredients after fallback, using full dictionary");
        const fallbackRecipe = translateRecipeWithDictionary(recipe) as ParsedRecipe;
        fallbackRecipe.ingredients = ensureValidIngredients(
          fallbackRecipe.ingredients, 
          recipe.ingredients
        );
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
      // Ensure ingredients are valid
      translatedRecipe.ingredients = ensureValidIngredients(
        translatedRecipe.ingredients, 
        recipe.ingredients
      );
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

