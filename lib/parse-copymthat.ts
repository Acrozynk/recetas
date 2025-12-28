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
  // Variant labels for recipes with two sets of amounts (e.g., different mold sizes)
  variant_1_label: string | null;
  variant_2_label: string | null;
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

      // Extract ingredients with subheaders and variant detection
      const ingredients: Ingredient[] = [];
      let variant1Label: string | null = null;
      let variant2Label: string | null = null;
      
      // First, collect all ingredient text to detect variants
      const ingredientTexts: Array<{text: string, isSubheader: boolean}> = [];
      $recipe.find("#recipeIngredients").children().each((_, child) => {
        const $child = $(child);
        const text = $child.text().trim();

        if (!text) return;
        if ($child.hasClass("recipeIngredient_spacer")) return;

        if ($child.hasClass("recipeIngredient_subheader")) {
          ingredientTexts.push({ text, isSubheader: true });
        } else if ($child.hasClass("recipeIngredient") && $child.is("li")) {
          ingredientTexts.push({ text, isSubheader: false });
        }
      });
      
      // Detect if we have variant blocks (e.g., MOLDE GRANDE / MOLDE PEQUEÑO)
      const variantPattern = /^(MOLDE|MOLD[EO]S?|PAN|BANDEJA|FUENTE|RECIPIENTE)\s+(.+):?$/i;
      const variantBlocks: Array<{label: string, startIdx: number}> = [];
      
      ingredientTexts.forEach((item, idx) => {
        if (item.isSubheader) {
          const match = item.text.match(variantPattern);
          if (match) {
            variantBlocks.push({ label: item.text.replace(/:$/, ''), startIdx: idx });
          }
        }
      });
      
      // If we have exactly 2 variant blocks, merge ingredients from both
      if (variantBlocks.length === 2) {
        variant1Label = variantBlocks[0].label;
        variant2Label = variantBlocks[1].label;
        
        // Get ingredients from each block (between block headers)
        const block1Start = variantBlocks[0].startIdx + 1;
        const block1End = variantBlocks[1].startIdx;
        const block2Start = variantBlocks[1].startIdx + 1;
        const block2End = ingredientTexts.length;
        
        const block1Items = ingredientTexts.slice(block1Start, block1End);
        const block2Items = ingredientTexts.slice(block2Start, block2End);
        
        // Parse both blocks and merge by ingredient name
        const block1Ingredients = parseIngredientBlock(block1Items);
        const block2Ingredients = parseIngredientBlock(block2Items);
        
        // Merge: match by name within sections
        let currentSection = "";
        const mergedBySection: Map<string, Map<string, {ing1?: Ingredient, ing2?: Ingredient}>> = new Map();
        
        // Process block 1
        for (const ing of block1Ingredients) {
          if (ing.isHeader) {
            currentSection = ing.name;
            if (!mergedBySection.has(currentSection)) {
              mergedBySection.set(currentSection, new Map());
            }
          } else {
            if (!mergedBySection.has(currentSection)) {
              mergedBySection.set(currentSection, new Map());
            }
            const sectionMap = mergedBySection.get(currentSection)!;
            const key = normalizeIngredientName(ing.name);
            sectionMap.set(key, { ing1: ing });
          }
        }
        
        // Process block 2
        currentSection = "";
        for (const ing of block2Ingredients) {
          if (ing.isHeader) {
            currentSection = ing.name;
            if (!mergedBySection.has(currentSection)) {
              mergedBySection.set(currentSection, new Map());
            }
          } else {
            if (!mergedBySection.has(currentSection)) {
              mergedBySection.set(currentSection, new Map());
            }
            const sectionMap = mergedBySection.get(currentSection)!;
            const key = normalizeIngredientName(ing.name);
            const existing = sectionMap.get(key);
            if (existing) {
              existing.ing2 = ing;
            } else {
              sectionMap.set(key, { ing2: ing });
            }
          }
        }
        
        // Build final ingredients list
        for (const [sectionName, sectionIngredients] of mergedBySection) {
          // Add section header if not empty
          if (sectionName) {
            ingredients.push({
              amount: "",
              unit: "",
              name: sectionName,
              isHeader: true,
            });
          }
          
          for (const [, pair] of sectionIngredients) {
            const merged: Ingredient = {
              amount: pair.ing1?.amount || pair.ing2?.amount || "",
              unit: pair.ing1?.unit || pair.ing2?.unit || "",
              name: pair.ing1?.name || pair.ing2?.name || "",
            };
            
            // Add variant 2 amounts if different
            if (pair.ing2) {
              merged.amount2 = pair.ing2.amount;
              merged.unit2 = pair.ing2.unit;
            }
            
            ingredients.push(merged);
          }
        }
      } else {
        // No variant blocks - parse normally with section headers
        for (const item of ingredientTexts) {
          if (item.isSubheader) {
            // Check if it looks like a section header (e.g., "Para la base:")
            const sectionMatch = item.text.match(/^(Para\s+(?:la|el)|For\s+(?:the)?)?\s*(.+?):?$/i);
            if (sectionMatch) {
              ingredients.push({
                amount: "",
                unit: "",
                name: sectionMatch[0].replace(/:$/, ''),
                isHeader: true,
              });
            }
          } else {
            ingredients.push(parseIngredientLine(item.text));
          }
        }
      }

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
        variant_1_label: variant1Label,
        variant_2_label: variant2Label,
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
          variant_1_label: null,
          variant_2_label: null,
        });
      }
    }
  });

  return recipes;
}

/**
 * Normalize ingredient name for matching across variants
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a block of ingredient texts into Ingredient objects
 */
function parseIngredientBlock(items: Array<{text: string, isSubheader: boolean}>): Ingredient[] {
  const result: Ingredient[] = [];
  
  for (const item of items) {
    if (item.isSubheader) {
      // Check if it looks like a section header (e.g., "Para la base:")
      const sectionMatch = item.text.match(/^(Para\s+(?:la|el)|For\s+(?:the)?)?\s*(.+?):?$/i);
      if (sectionMatch) {
        result.push({
          amount: "",
          unit: "",
          name: sectionMatch[0].replace(/:$/, ''),
          isHeader: true,
        });
      }
    } else {
      result.push(parseIngredientLine(item.text));
    }
  }
  
  return result;
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
