/**
 * Translation utilities for recipe import
 * Uses LibreTranslate (free, open-source translation API)
 */

// Common English words to detect language
const ENGLISH_INDICATORS = [
  // Common recipe words
  "cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
  "tbsp", "tsp", "ounce", "ounces", "pound", "pounds", "oz", "lb", "lbs",
  "chopped", "minced", "diced", "sliced", "grated", "melted", "beaten",
  "fresh", "dried", "ground", "large", "medium", "small", "optional",
  // Common instruction words
  "preheat", "oven", "bake", "cook", "stir", "mix", "combine", "add",
  "pour", "heat", "boil", "simmer", "fry", "sauté", "serve", "let",
  "minutes", "hours", "until", "about", "degrees", "temperature",
  // Common ingredients
  "butter", "sugar", "flour", "salt", "pepper", "water", "milk", "cream",
  "eggs", "egg", "chicken", "beef", "pork", "fish", "onion", "garlic",
  "oil", "olive", "vegetable", "cheese", "bread", "rice", "pasta",
  // Articles and prepositions
  "the", "and", "with", "into", "from", "for", "then", "when",
];

// Common Spanish words to confirm it's Spanish
const SPANISH_INDICATORS = [
  "taza", "tazas", "cucharada", "cucharadas", "cucharadita", "cucharaditas",
  "gramos", "litros", "mililitros", "picado", "picada", "cortado", "rallado",
  "fresco", "seco", "molido", "grande", "mediano", "pequeño", "opcional",
  "precalentar", "horno", "hornear", "cocinar", "mezclar", "añadir", "agregar",
  "verter", "calentar", "hervir", "freír", "servir", "dejar", "minutos",
  "horas", "hasta", "grados", "temperatura", "mantequilla", "azúcar", "harina",
  "sal", "pimienta", "agua", "leche", "nata", "huevos", "huevo", "pollo",
  "carne", "cerdo", "pescado", "cebolla", "ajo", "aceite", "queso", "pan",
  "arroz", "el", "la", "los", "las", "con", "para", "luego", "cuando", "sobre",
];

/**
 * Detect if text is likely in English
 */
export function detectLanguage(text: string): "en" | "es" | "unknown" {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let englishScore = 0;
  let spanishScore = 0;
  
  for (const word of words) {
    // Clean punctuation
    const cleanWord = word.replace(/[.,!?;:'"()]/g, "");
    
    if (ENGLISH_INDICATORS.includes(cleanWord)) {
      englishScore++;
    }
    if (SPANISH_INDICATORS.includes(cleanWord)) {
      spanishScore++;
    }
  }
  
  // Need at least some indicators to make a decision
  const totalIndicators = englishScore + spanishScore;
  if (totalIndicators < 3) {
    return "unknown";
  }
  
  // If significantly more English indicators, it's English
  if (englishScore > spanishScore * 1.5) {
    return "en";
  }
  
  // If significantly more Spanish indicators, it's Spanish
  if (spanishScore > englishScore * 1.5) {
    return "es";
  }
  
  return "unknown";
}

/**
 * Detect language of a recipe by analyzing all its text content
 */
export function detectRecipeLanguage(recipe: {
  title: string;
  description?: string | null;
  ingredients: { name: string }[];
  instructions: { text: string }[] | string[];
}): "en" | "es" | "unknown" {
  // Combine all text for analysis
  const allText = [
    recipe.title,
    recipe.description || "",
    ...recipe.ingredients.map((i) => i.name),
    ...recipe.instructions.map((i) => (typeof i === "string" ? i : i.text)),
  ].join(" ");
  
  return detectLanguage(allText);
}

// LibreTranslate public instances (fallback chain)
const LIBRETRANSLATE_INSTANCES = [
  "https://libretranslate.com",
  "https://translate.argosopentech.com",
  "https://translate.terraprint.co",
];

/**
 * Translate text from English to Spanish using LibreTranslate
 * Falls back to dictionary translation if API fails
 */
export async function translateText(
  text: string,
  from: string = "en",
  to: string = "es"
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }
  
  // Try each LibreTranslate instance
  for (const baseUrl of LIBRETRANSLATE_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const response = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          source: from,
          target: to,
          format: "text",
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const translated = data.translatedText;
        // Make sure we got a valid translation
        if (translated && translated.trim().length > 0) {
          return translated;
        }
      }
    } catch (error) {
      console.warn(`Translation failed with ${baseUrl}:`, error);
      continue;
    }
  }
  
  // If all API instances fail, try dictionary-based translation
  console.log("API translation failed, using dictionary fallback for:", text);
  return translateWithDictionary(text);
}

/**
 * Translate text using local dictionary (fallback when API fails)
 */
export function translateWithDictionary(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // Sort dictionary entries by length (longest first) to avoid partial replacements
  const sortedEntries = Object.entries(COOKING_TRANSLATIONS)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [english, spanish] of sortedEntries) {
    // Case-insensitive replacement with word boundaries
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return spanish.charAt(0).toUpperCase() + spanish.slice(1);
      }
      return spanish;
    });
  }
  
  return result;
}

/**
 * Translate an array of texts efficiently (batch when possible)
 */
export async function translateTexts(
  texts: string[],
  from: string = "en",
  to: string = "es"
): Promise<string[]> {
  // Filter out empty strings and track their positions
  const nonEmptyTexts: { index: number; text: string }[] = [];
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      nonEmptyTexts.push({ index, text });
    }
  });
  
  if (nonEmptyTexts.length === 0) {
    return texts;
  }
  
  // Translate in smaller batches to avoid timeouts
  const BATCH_SIZE = 5; // Smaller batches for reliability
  const results = [...texts];
  
  for (let i = 0; i < nonEmptyTexts.length; i += BATCH_SIZE) {
    const batch = nonEmptyTexts.slice(i, i + BATCH_SIZE);
    
    // Translate batch items in parallel
    const translations = await Promise.all(
      batch.map(({ text }) => translateText(text, from, to))
    );
    
    // Put translations back in correct positions, ensuring no empty strings
    batch.forEach(({ index, text }, batchIndex) => {
      const translated = translations[batchIndex];
      // Never return empty - fall back to original if translation is empty
      results[index] = (translated && translated.trim().length > 0) ? translated : text;
    });
  }
  
  return results;
}

/**
 * Quick translate using only the dictionary (synchronous, no API)
 * Useful when API is not available
 */
export function translateRecipeWithDictionary(recipe: {
  title: string;
  description?: string | null;
  ingredients: { amount: string; unit: string; name: string }[];
  instructions: { text: string }[] | string[];
  notes?: string | null;
  tags: string[];
}): typeof recipe {
  return {
    ...recipe,
    title: translateWithDictionary(recipe.title),
    description: recipe.description ? translateWithDictionary(recipe.description) : null,
    ingredients: recipe.ingredients.map(ing => ({
      ...ing,
      name: translateWithDictionary(ing.name),
      unit: translateWithDictionary(ing.unit),
    })),
    instructions: recipe.instructions.map(inst => 
      typeof inst === 'string' 
        ? { text: translateWithDictionary(inst), ingredientIndices: [] }
        : { ...inst, text: translateWithDictionary(inst.text) }
    ),
    notes: recipe.notes ? translateWithDictionary(recipe.notes) : null,
    tags: recipe.tags.map(tag => translateWithDictionary(tag)),
  };
}

/**
 * Common cooking term translations (for quick/offline translation)
 * Can be used as fallback or for ingredient names
 */
export const COOKING_TRANSLATIONS: Record<string, string> = {
  // Measurements
  "cup": "taza",
  "cups": "tazas",
  "tablespoon": "cucharada",
  "tablespoons": "cucharadas",
  "teaspoon": "cucharadita",
  "teaspoons": "cucharaditas",
  "ounce": "onza",
  "ounces": "onzas",
  "pound": "libra",
  "pounds": "libras",
  "pinch": "pizca",
  "dash": "pizca",
  
  // Common ingredients
  "butter": "mantequilla",
  "sugar": "azúcar",
  "flour": "harina",
  "salt": "sal",
  "pepper": "pimienta",
  "black pepper": "pimienta negra",
  "water": "agua",
  "milk": "leche",
  "cream": "nata",
  "heavy cream": "nata para montar",
  "egg": "huevo",
  "eggs": "huevos",
  "chicken": "pollo",
  "chicken breast": "pechuga de pollo",
  "beef": "carne de res",
  "pork": "cerdo",
  "fish": "pescado",
  "onion": "cebolla",
  "onions": "cebollas",
  "garlic": "ajo",
  "garlic cloves": "dientes de ajo",
  "olive oil": "aceite de oliva",
  "vegetable oil": "aceite vegetal",
  "oil": "aceite",
  "cheese": "queso",
  "bread": "pan",
  "rice": "arroz",
  "pasta": "pasta",
  "tomato": "tomate",
  "tomatoes": "tomates",
  "potato": "patata",
  "potatoes": "patatas",
  "carrot": "zanahoria",
  "carrots": "zanahorias",
  "celery": "apio",
  "bell pepper": "pimiento",
  "mushroom": "champiñón",
  "mushrooms": "champiñones",
  "spinach": "espinacas",
  "broccoli": "brócoli",
  "lemon": "limón",
  "lemon juice": "zumo de limón",
  "orange": "naranja",
  "apple": "manzana",
  "banana": "plátano",
  "strawberry": "fresa",
  "strawberries": "fresas",
  "vanilla": "vainilla",
  "vanilla extract": "extracto de vainilla",
  "cinnamon": "canela",
  "baking powder": "polvo de hornear",
  "baking soda": "bicarbonato de sodio",
  "yeast": "levadura",
  "honey": "miel",
  "maple syrup": "sirope de arce",
  "chocolate": "chocolate",
  "cocoa powder": "cacao en polvo",
  "nuts": "frutos secos",
  "almonds": "almendras",
  "walnuts": "nueces",
  "peanuts": "cacahuetes",
  "peanut butter": "mantequilla de cacahuete",
  "soy sauce": "salsa de soja",
  "vinegar": "vinagre",
  "wine": "vino",
  "white wine": "vino blanco",
  "red wine": "vino tinto",
  "broth": "caldo",
  "chicken broth": "caldo de pollo",
  "beef broth": "caldo de carne",
  "stock": "caldo",
  
  // Cooking actions
  "preheat": "precalentar",
  "bake": "hornear",
  "cook": "cocinar",
  "fry": "freír",
  "sauté": "saltear",
  "boil": "hervir",
  "simmer": "cocer a fuego lento",
  "stir": "remover",
  "mix": "mezclar",
  "combine": "combinar",
  "add": "añadir",
  "pour": "verter",
  "heat": "calentar",
  "chop": "picar",
  "dice": "cortar en cubos",
  "slice": "cortar en rodajas",
  "mince": "picar finamente",
  "grate": "rallar",
  "whisk": "batir",
  "beat": "batir",
  "fold": "incorporar",
  "knead": "amasar",
  "marinate": "marinar",
  "season": "sazonar",
  "serve": "servir",
  "garnish": "decorar",
  "drain": "escurrir",
  "strain": "colar",
  "refrigerate": "refrigerar",
  "freeze": "congelar",
  "thaw": "descongelar",
  "rest": "reposar",
  "cool": "enfriar",
  
  // Descriptors
  "chopped": "picado",
  "diced": "en cubos",
  "sliced": "en rodajas",
  "minced": "picado finamente",
  "grated": "rallado",
  "melted": "derretido",
  "softened": "ablandado",
  "beaten": "batido",
  "fresh": "fresco",
  "dried": "seco",
  "ground": "molido",
  "crushed": "machacado",
  "whole": "entero",
  "large": "grande",
  "medium": "mediano",
  "small": "pequeño",
  "optional": "opcional",
  "to taste": "al gusto",
  
  // Time and temperature
  "minutes": "minutos",
  "minute": "minuto",
  "hours": "horas",
  "hour": "hora",
  "degrees": "grados",
  "oven": "horno",
  "pan": "sartén",
  "pot": "olla",
  "bowl": "bol",
  "baking sheet": "bandeja de horno",
  "skillet": "sartén",
};

/**
 * Quick translation using dictionary (for common cooking terms)
 * Falls back to original if not found
 */
export function quickTranslate(text: string): string {
  const lower = text.toLowerCase().trim();
  return COOKING_TRANSLATIONS[lower] || text;
}

