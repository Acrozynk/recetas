import * as cheerio from "cheerio";
import type { Ingredient, Instruction } from "./supabase";

export interface ParsedRecipe {
  title: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  local_image_path: string | null; // For local images in export folder
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  servings_text: string | null; // Original servings text (e.g., "10 pancakes")
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[];
  notes: string | null;
  rating: number | null; // 1-3 scale (mapped from 1-5)
  made_it: boolean;
}

/**
 * Parse CopyMeThat HTML export file
 * CopyMeThat exports recipes with specific structure using IDs
 */
export function parseCopyMeThatExport(html: string): ParsedRecipe[] {
  const $ = cheerio.load(html);
  const recipes: ParsedRecipe[] = [];

  // CopyMeThat exports each recipe in a div with class "recipe"
  $(".recipe").each((_, element) => {
    try {
      const $recipe = $(element);

      // Extract title from #name div
      const title = $recipe.find("#name").first().text().trim();
      if (!title) return;

      // Extract image - check for local path in images/ folder
      const imgSrc = $recipe.find("img.recipeImage").first().attr("src");
      let imageUrl: string | null = null;
      let localImagePath: string | null = null;

      if (imgSrc) {
        if (imgSrc.startsWith("http")) {
          imageUrl = imgSrc;
        } else {
          // Local image path (e.g., "images/recipe_name.jpg")
          localImagePath = imgSrc;
        }
      }

      // Extract source URL
      const sourceUrl = $recipe.find("#original_link").attr("href") || null;

      // Extract description
      const description = $recipe.find("#description").text().trim() || null;

      // Extract tags/categories
      const tags: string[] = [];
      $recipe.find(".recipeCategory").each((_, tag) => {
        const text = $(tag).text().trim();
        if (text && text.length < 50) {
          tags.push(text);
        }
      });

      // Extract rating (map 1-5 to 1-3 scale)
      let rating: number | null = null;
      const ratingText = $recipe.find("#ratingValue").text().trim();
      if (ratingText) {
        const originalRating = parseInt(ratingText);
        if (!isNaN(originalRating) && originalRating >= 1 && originalRating <= 5) {
          // Map: 1-3 → 1, 4 → 2, 5 → 3
          if (originalRating <= 3) rating = 1;
          else if (originalRating === 4) rating = 2;
          else rating = 3; // 5 stars
        }
      }

      // Extract "made this" status
      const madeItText = $recipe.find("#made_this").text().trim().toLowerCase();
      const madeIt = madeItText.includes("made this");

      // Extract servings
      const servingsText = $recipe.find("#recipeYield").text().trim() || null;
      let servings: number | null = null;
      if (servingsText) {
        const servingsMatch = servingsText.match(/^(\d+)/);
        if (servingsMatch) {
          servings = parseInt(servingsMatch[1]);
        }
      }

      // Extract ingredients with subheaders
      const ingredients: Ingredient[] = [];
      $recipe.find("#recipeIngredients").children().each((_, child) => {
        const $child = $(child);
        const text = $child.text().trim();

        if (!text) return;

        // Skip spacer divs
        if ($child.hasClass("recipeIngredient_spacer")) return;

        // Handle subheaders - add as ingredient with empty amount/unit
        if ($child.hasClass("recipeIngredient_subheader")) {
          ingredients.push({
            amount: "",
            unit: "",
            name: `**${text}**`, // Mark as subheader with bold markdown
          });
          return;
        }

        // Regular ingredient
        if ($child.hasClass("recipeIngredient") && $child.is("li")) {
          ingredients.push(parseIngredientLine(text));
        }
      });

      // Extract instructions
      const instructions: Instruction[] = [];
      $recipe.find("#recipeInstructions .instruction").each((_, step) => {
        const text = $(step).text().trim();
        if (text) {
          // Remove step numbers if present at the beginning
          const cleanText = text.replace(/^\d+[\.\)]\s*/, "");
          instructions.push({
            text: cleanText,
            ingredientIndices: [],
          });
        }
      });

      // Also check for instruction subheaders
      $recipe.find("#recipeInstructions").children().each((_, child) => {
        const $child = $(child);
        if ($child.hasClass("instruction_subheader")) {
          const text = $child.text().trim();
          if (text) {
            // Find the position and insert as a step header
            instructions.push({
              text: `**${text}**`,
              ingredientIndices: [],
            });
          }
        }
      });

      // Extract notes
      const notes: string[] = [];
      $recipe.find("#recipeNotes .recipeNote").each((_, note) => {
        const text = $(note).text().trim();
        if (text) {
          notes.push(text);
        }
      });

      // Also check for note content in separate div
      const noteSection = $recipe.find("#recipeNotes").text().trim();
      if (noteSection && !notes.length) {
        // Remove header text if present
        const cleanNote = noteSection.replace(/^Notes?\s*/i, "").trim();
        if (cleanNote) {
          notes.push(cleanNote);
        }
      }

      // Extract time info
      const recipeText = $recipe.text().toLowerCase();
      const prepTime = extractTime(recipeText, ["prep", "preparation", "preparación"]);
      const cookTime = extractTime(recipeText, ["cook", "cooking", "bake", "baking", "cocción"]);

      recipes.push({
        title,
        description,
        source_url: sourceUrl,
        image_url: imageUrl,
        local_image_path: localImagePath,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        servings,
        servings_text: servingsText,
        tags,
        ingredients,
        instructions,
        notes: notes.length > 0 ? notes.join("\n\n") : null,
        rating,
        made_it: madeIt,
      });
    } catch (e) {
      console.error("Error parsing recipe:", e);
    }
  });

  // If the specific CopyMeThat format didn't work, try generic parsing
  if (recipes.length === 0) {
    return parseGenericHtml(html);
  }

  return recipes;
}

/**
 * Fallback parser for generic HTML with recipes
 */
function parseGenericHtml(html: string): ParsedRecipe[] {
  const $ = cheerio.load(html);
  const recipes: ParsedRecipe[] = [];

  // Look for any structure that might contain recipes
  $("article, .card, [class*='recipe'], section").each((_, element) => {
    const $el = $(element);
    const title = $el.find("h1, h2, h3").first().text().trim();

    if (title && title.length > 2 && title.length < 200) {
      const ingredients: Ingredient[] = [];
      const instructions: Instruction[] = [];

      // Try to find lists
      $el.find("ul li").each((_, li) => {
        const text = $(li).text().trim();
        if (text && text.length < 200) {
          ingredients.push(parseIngredientLine(text));
        }
      });

      $el.find("ol li").each((_, li) => {
        const text = $(li).text().trim();
        if (text) {
          instructions.push({
            text: text.replace(/^\d+[\.\)]\s*/, ""),
            ingredientIndices: [],
          });
        }
      });

      if (ingredients.length > 0 || instructions.length > 0) {
        recipes.push({
          title,
          description: null,
          source_url: $el.find("a[href*='http']").first().attr("href") || null,
          image_url: $el.find("img").first().attr("src") || null,
          local_image_path: null,
          prep_time_minutes: null,
          cook_time_minutes: null,
          servings: extractServings($el.text()),
          servings_text: null,
          tags: [],
          ingredients,
          instructions,
          notes: null,
          rating: null,
          made_it: false,
        });
      }
    }
  });

  return recipes;
}

/**
 * Parse a single ingredient line into structured data
 */
function parseIngredientLine(text: string): Ingredient {
  // Common patterns with optional secondary measurement in parentheses
  // e.g., "100 g flour (⅔ cups)" or "2 eggs"

  // First, try to extract secondary measurement in parentheses
  let secondaryMatch: RegExpMatchArray | null = null;
  let mainText = text;

  const parenMatch = text.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    mainText = text.replace(/\s*\([^)]+\)\s*$/, "").trim();
    secondaryMatch = parenMatch[1].match(/^([\d\/\.\s¼½¾⅓⅔⅛⅜⅝⅞]+)\s*(.+)$/);
  }

  // Common unit patterns (Spanish and English)
  const unitPattern =
    /^([\d\/\.\s¼½¾⅓⅔⅛⅜⅝⅞]+)\s*(cups?|tbsp?|tsp?|tablespoons?|teaspoons?|cucharadas?|cucharaditas?|oz|ounces?|onzas?|lbs?|pounds?|libras?|g|grams?|gramos?|kg|ml|mL|liters?|litros?|l|L|pinch|pizca|dash|cloves?|dientes?|pieces?|piezas?|trozos?|slices?|rebanadas?|rodajas?|cans?|latas?|botes?|packages?|paquetes?|pkg|sobres?|unidades?)?\.?\s+(.+)$/i;

  const patterns = [
    unitPattern,
    /^([\d\/\.\s¼½¾⅓⅔⅛⅜⅝⅞]+)\s+(.+)$/, // Just number and name
    /^(.+)$/, // Just name
  ];

  for (const pattern of patterns) {
    const match = mainText.match(pattern);
    if (match) {
      const ingredient: Ingredient = {
        amount: "",
        unit: "",
        name: text, // Default to full text
      };

      if (match.length === 4) {
        ingredient.amount = normalizeAmount(match[1].trim());
        ingredient.unit = match[2]?.trim() || "";
        ingredient.name = match[3].trim();
      } else if (match.length === 3) {
        ingredient.amount = normalizeAmount(match[1].trim());
        ingredient.name = match[2].trim();
      } else if (match.length === 2) {
        ingredient.name = match[1].trim();
      }

      // Add secondary measurement if found
      if (secondaryMatch && secondaryMatch.length >= 2) {
        ingredient.amount2 = normalizeAmount(secondaryMatch[1].trim());
        ingredient.unit2 = secondaryMatch[2]?.trim() || "";
      }

      return ingredient;
    }
  }

  return { amount: "", unit: "", name: text };
}

/**
 * Normalize fraction characters to regular fractions
 */
function normalizeAmount(amount: string): string {
  return amount
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8")
    .trim();
}

/**
 * Extract time in minutes from text
 */
function extractTime(text: string, keywords: string[]): number | null {
  for (const keyword of keywords) {
    // Match patterns like "prep time: 15 min" or "15 minutes prep"
    const patterns = [
      new RegExp(`${keyword}[^\\d]*(\\d+)\\s*(min|minutes?|mins?|hrs?|hours?|horas?)`, "i"),
      new RegExp(`(\\d+)\\s*(min|minutes?|mins?|hrs?|hours?|horas?)\\s*${keyword}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let time = parseInt(match[1]);
        if (match[2].toLowerCase().startsWith("h")) {
          time *= 60;
        }
        return time;
      }
    }
  }
  return null;
}

/**
 * Extract servings from text
 */
function extractServings(text: string): number | null {
  const match = text.match(/(?:serves?|servings?|yield|makes?|raciones?|porciones?)[:\s]*(\d+)/i);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

/**
 * Get all local image paths from parsed recipes
 */
export function getLocalImagePaths(recipes: ParsedRecipe[]): string[] {
  return recipes
    .filter((r) => r.local_image_path)
    .map((r) => r.local_image_path as string);
}
