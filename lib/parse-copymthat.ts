import * as cheerio from "cheerio";
import type { Ingredient } from "./supabase";

export interface ParsedRecipe {
  title: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
}

/**
 * Parse CopyMeThat HTML export file
 * CopyMeThat exports recipes in a specific HTML format with recipe cards
 */
export function parseCopyMeThatExport(html: string): ParsedRecipe[] {
  const $ = cheerio.load(html);
  const recipes: ParsedRecipe[] = [];

  // CopyMeThat exports each recipe in a div with class "recipe"
  $(".recipe, .recipeCard, [class*='recipe']").each((_, element) => {
    try {
      const $recipe = $(element);

      // Extract title
      const title =
        $recipe.find("h1, h2, .title, .recipe-title, [class*='title']").first().text().trim() ||
        $recipe.find("a").first().text().trim();

      if (!title) return; // Skip if no title found

      // Extract image
      const imageUrl =
        $recipe.find("img").first().attr("src") ||
        $recipe.find("[style*='background-image']").css("background-image")?.replace(/url\(['"]?([^'"]+)['"]?\)/, "$1") ||
        null;

      // Extract source URL
      const sourceUrl =
        $recipe.find("a[href*='http']").first().attr("href") ||
        null;

      // Extract description
      const description =
        $recipe.find(".description, .summary, [class*='desc']").first().text().trim() ||
        null;

      // Extract ingredients
      const ingredients: Ingredient[] = [];
      $recipe.find(".ingredient, li[class*='ingredient'], .ingredients li").each((_, ing) => {
        const text = $(ing).text().trim();
        if (text) {
          const parsed = parseIngredientLine(text);
          ingredients.push(parsed);
        }
      });

      // If no ingredients found in specific elements, try to find them in text blocks
      if (ingredients.length === 0) {
        const ingredientsSection = $recipe.find(":contains('Ingredients')").nextAll("ul, ol").first();
        ingredientsSection.find("li").each((_, ing) => {
          const text = $(ing).text().trim();
          if (text) {
            ingredients.push(parseIngredientLine(text));
          }
        });
      }

      // Extract instructions
      const instructions: string[] = [];
      $recipe.find(".instruction, .step, .directions li, .instructions li, [class*='step']").each((_, step) => {
        const text = $(step).text().trim();
        if (text) {
          // Remove step numbers if present
          instructions.push(text.replace(/^\d+[\.\)]\s*/, ""));
        }
      });

      // If no instructions found in specific elements, try ordered lists
      if (instructions.length === 0) {
        const directionsSection = $recipe.find(":contains('Directions'), :contains('Instructions')").nextAll("ol").first();
        directionsSection.find("li").each((_, step) => {
          const text = $(step).text().trim();
          if (text) {
            instructions.push(text.replace(/^\d+[\.\)]\s*/, ""));
          }
        });
      }

      // Extract time info
      const timeText = $recipe.text().toLowerCase();
      const prepTime = extractTime(timeText, ["prep", "preparation"]);
      const cookTime = extractTime(timeText, ["cook", "cooking", "bake", "baking"]);

      // Extract servings
      const servings = extractServings($recipe.text());

      // Extract tags/categories
      const tags: string[] = [];
      $recipe.find(".tag, .category, [class*='tag'], [class*='category']").each((_, tag) => {
        const text = $(tag).text().trim();
        if (text && text.length < 30) {
          tags.push(text);
        }
      });

      recipes.push({
        title,
        description,
        source_url: sourceUrl,
        image_url: imageUrl,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        servings,
        tags,
        ingredients,
        instructions,
      });
    } catch (e) {
      console.error("Error parsing recipe:", e);
    }
  });

  // If the generic approach didn't work, try a more aggressive parsing
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
      const instructions: string[] = [];

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
          instructions.push(text.replace(/^\d+[\.\)]\s*/, ""));
        }
      });

      if (ingredients.length > 0 || instructions.length > 0) {
        recipes.push({
          title,
          description: null,
          source_url: $el.find("a[href*='http']").first().attr("href") || null,
          image_url: $el.find("img").first().attr("src") || null,
          prep_time_minutes: null,
          cook_time_minutes: null,
          servings: extractServings($el.text()),
          tags: [],
          ingredients,
          instructions,
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
  // Common patterns: "1 cup flour", "1/2 tsp salt", "2 large eggs"
  const patterns = [
    /^([\d\/\.\s]+)\s*(cups?|tbsp?|tsp?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|l|pinch|dash|cloves?|pieces?|slices?|cans?|packages?|pkg)\.?\s+(.+)$/i,
    /^([\d\/\.\s]+)\s+(.+)$/,
    /^(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length === 4) {
        return {
          amount: match[1].trim(),
          unit: match[2].trim(),
          name: match[3].trim(),
        };
      } else if (match.length === 3) {
        return {
          amount: match[1].trim(),
          unit: "",
          name: match[2].trim(),
        };
      } else {
        return {
          amount: "",
          unit: "",
          name: match[1].trim(),
        };
      }
    }
  }

  return { amount: "", unit: "", name: text };
}

/**
 * Extract time in minutes from text
 */
function extractTime(text: string, keywords: string[]): number | null {
  for (const keyword of keywords) {
    // Match patterns like "prep time: 15 min" or "15 minutes prep"
    const patterns = [
      new RegExp(`${keyword}[^\\d]*(\\d+)\\s*(min|minutes?|hrs?|hours?)`, "i"),
      new RegExp(`(\\d+)\\s*(min|minutes?|hrs?|hours?)\\s*${keyword}`, "i"),
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
  const match = text.match(/(?:serves?|servings?|yield|makes?)[:\s]*(\d+)/i);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

