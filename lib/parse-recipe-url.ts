import * as cheerio from "cheerio";
import type { Ingredient } from "./supabase";

export interface ParsedRecipe {
  title: string;
  description: string | null;
  source_url: string;
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
}

/**
 * Fetch and parse a recipe from a URL
 */
export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RecetasBot/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return parseRecipeHtml(html, url);
}

/**
 * Parse recipe from HTML content
 */
export function parseRecipeHtml(html: string, sourceUrl: string): ParsedRecipe {
  const $ = cheerio.load(html);

  // Try JSON-LD first (most recipe sites use this)
  const jsonLdRecipe = extractJsonLd($);
  if (jsonLdRecipe) {
    return {
      ...jsonLdRecipe,
      source_url: sourceUrl,
    };
  }

  // Fallback to meta tags and HTML parsing
  return extractFromHtml($, sourceUrl);
}

/**
 * Extract recipe from JSON-LD structured data
 */
function extractJsonLd($: cheerio.CheerioAPI): Omit<ParsedRecipe, "source_url"> | null {
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const content = $(scripts[i]).html();
      if (!content) continue;

      const data = JSON.parse(content);
      const recipe = findRecipeInJsonLd(data);

      if (recipe) {
        return {
          title: recipe.name || "Untitled Recipe",
          description: recipe.description || null,
          image_url: extractImage(recipe.image),
          prep_time_minutes: parseDuration(recipe.prepTime),
          cook_time_minutes: parseDuration(recipe.cookTime),
          servings: parseServings(recipe.recipeYield),
          tags: extractTags(recipe),
          ingredients: parseIngredients(recipe.recipeIngredient || []),
          instructions: parseInstructions(recipe.recipeInstructions || []),
        };
      }
    } catch {
      // Continue to next script
    }
  }

  return null;
}

/**
 * Recursively find recipe object in JSON-LD data
 */
function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  // Check if this is a Recipe
  const obj = data as Record<string, unknown>;
  if (obj["@type"] === "Recipe" || (Array.isArray(obj["@type"]) && obj["@type"].includes("Recipe"))) {
    return obj;
  }

  // Check @graph array
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  // Check if it's an array
  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

/**
 * Extract image URL from various formats
 */
function extractImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      return (first as { url: string }).url;
    }
  }
  if (typeof image === "object" && "url" in image) {
    return (image as { url: string }).url;
  }
  return null;
}

/**
 * Parse ISO 8601 duration to minutes
 */
function parseDuration(duration: unknown): number | null {
  if (!duration || typeof duration !== "string") return null;

  // Match ISO 8601 duration format: PT1H30M, PT45M, PT2H, etc.
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    return hours * 60 + minutes;
  }

  // Try simple number
  const num = parseInt(duration);
  if (!isNaN(num)) return num;

  return null;
}

/**
 * Parse servings from various formats
 */
function parseServings(yield_: unknown): number | null {
  if (!yield_) return null;

  if (typeof yield_ === "number") return yield_;

  const str = Array.isArray(yield_) ? yield_[0] : yield_;
  if (typeof str !== "string") return null;

  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract tags/keywords from recipe
 */
function extractTags(recipe: Record<string, unknown>): string[] {
  const tags: string[] = [];

  // Recipe category
  if (recipe.recipeCategory) {
    if (Array.isArray(recipe.recipeCategory)) {
      tags.push(...recipe.recipeCategory.filter((t): t is string => typeof t === "string"));
    } else if (typeof recipe.recipeCategory === "string") {
      tags.push(recipe.recipeCategory);
    }
  }

  // Recipe cuisine
  if (recipe.recipeCuisine) {
    if (Array.isArray(recipe.recipeCuisine)) {
      tags.push(...recipe.recipeCuisine.filter((t): t is string => typeof t === "string"));
    } else if (typeof recipe.recipeCuisine === "string") {
      tags.push(recipe.recipeCuisine);
    }
  }

  // Keywords
  if (recipe.keywords) {
    if (typeof recipe.keywords === "string") {
      tags.push(...recipe.keywords.split(",").map((k) => k.trim()));
    }
  }

  return [...new Set(tags)].slice(0, 10); // Dedupe and limit
}

/**
 * Parse ingredients from JSON-LD
 */
function parseIngredients(ingredients: unknown[]): Ingredient[] {
  return ingredients
    .filter((i): i is string => typeof i === "string")
    .map((text) => {
      // Try to parse amount and unit
      const match = text.match(/^([\d\/\.\s]+)\s*(cups?|tbsp?|tsp?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|l|pinch|dash|cloves?|pieces?|slices?|cans?|packages?|pkg)?\.?\s*(.+)$/i);

      if (match && match[3]) {
        return {
          amount: match[1]?.trim() || "",
          unit: match[2]?.trim() || "",
          name: match[3].trim(),
        };
      }

      return {
        amount: "",
        unit: "",
        name: text.trim(),
      };
    });
}

/**
 * Parse instructions from JSON-LD
 */
function parseInstructions(instructions: unknown[]): string[] {
  const steps: string[] = [];

  for (const instruction of instructions) {
    if (typeof instruction === "string") {
      steps.push(instruction.trim());
    } else if (instruction && typeof instruction === "object") {
      const obj = instruction as Record<string, unknown>;
      
      // HowToStep
      if (obj.text && typeof obj.text === "string") {
        steps.push(obj.text.trim());
      }
      
      // HowToSection with itemListElement
      if (Array.isArray(obj.itemListElement)) {
        for (const item of obj.itemListElement) {
          if (typeof item === "string") {
            steps.push(item.trim());
          } else if (item && typeof item === "object" && "text" in item) {
            steps.push((item as { text: string }).text.trim());
          }
        }
      }
    }
  }

  return steps;
}

/**
 * Fallback: Extract recipe from HTML elements
 */
function extractFromHtml($: cheerio.CheerioAPI, sourceUrl: string): ParsedRecipe {
  // Title
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled Recipe";

  // Description
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    null;

  // Image
  const image_url =
    $('meta[property="og:image"]').attr("content") ||
    $(".recipe-image img, .hero-image img, [class*='recipe'] img").first().attr("src") ||
    null;

  // Ingredients - look for common patterns
  const ingredients: Ingredient[] = [];
  $(".ingredient, [class*='ingredient'] li, .ingredients li, [itemprop='recipeIngredient']").each(
    (_, el) => {
      const text = $(el).text().trim();
      if (text) {
        ingredients.push({
          amount: "",
          unit: "",
          name: text,
        });
      }
    }
  );

  // Instructions
  const instructions: string[] = [];
  $(
    ".instruction, .step, [class*='instruction'] li, .directions li, .steps li, [itemprop='recipeInstructions'] li"
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      instructions.push(text.replace(/^\d+[\.\)]\s*/, ""));
    }
  });

  return {
    title: title.substring(0, 200),
    description: description?.substring(0, 500) || null,
    source_url: sourceUrl,
    image_url,
    prep_time_minutes: null,
    cook_time_minutes: null,
    servings: null,
    tags: [],
    ingredients,
    instructions,
  };
}

