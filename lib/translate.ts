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
    
    try {
      // Translate batch items in parallel
      const translations = await Promise.all(
        batch.map(({ text }) => translateText(text, from, to))
      );
      
      // Put translations back in correct positions, ensuring no empty strings
      batch.forEach(({ index, text }, batchIndex) => {
        const translated = translations[batchIndex];
        // Never return empty - fall back to original if translation is empty
        if (translated && translated.trim().length > 0) {
          results[index] = translated;
        } else {
          // Use dictionary fallback for this specific text
          results[index] = translateWithDictionary(text) || text;
        }
      });
    } catch (error) {
      // If batch translation fails, fall back to dictionary for each item
      console.error("Batch translation failed, using dictionary:", error);
      batch.forEach(({ index, text }) => {
        results[index] = translateWithDictionary(text) || text;
      });
    }
  }
  
  // Final safety check - ensure no empty strings
  return results.map((result, i) => {
    if (!result || result.trim().length === 0) {
      return texts[i] || "";
    }
    return result;
  });
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
  // Common words and phrases
  "all": "todos",
  "the": "los",
  "ingredients": "ingredientes",
  "together": "juntos",
  "until": "hasta",
  "about": "aproximadamente",
  "or": "o",
  "and": "y",
  "with": "con",
  "into": "en",
  "from": "de",
  "for": "para",
  "then": "luego",
  "when": "cuando",
  "if": "si",
  "well": "bien",
  "very": "muy",
  "more": "más",
  "less": "menos",
  "some": "algo de",
  "any": "cualquier",
  "other": "otro",
  "each": "cada",
  "both": "ambos",
  "over": "sobre",
  "under": "debajo",
  "before": "antes",
  "after": "después",
  "during": "durante",
  
  // Recipe titles common words
  "pancakes": "tortitas",
  "pancake": "tortita",
  "zucchini pancakes": "tortitas de calabacín",
  "zucchini": "calabacín",
  "courgette": "calabacín",
  "breakfast": "desayuno",
  "lunch": "almuerzo", 
  "dinner": "cena",
  "snack": "merienda",
  "dessert": "postre",
  "appetizer": "aperitivo",
  "salad": "ensalada",
  "soup": "sopa",
  "stew": "estofado",
  "casserole": "cazuela",
  "roast": "asado",
  "grilled": "a la parrilla",
  "fried": "frito",
  "baked": "horneado",
  "steamed": "al vapor",
  "stuffed": "relleno",
  "creamy": "cremoso",
  "spicy": "picante",
  "sweet": "dulce",
  "savory": "salado",
  "homemade": "casero",
  "easy": "fácil",
  "quick": "rápido",
  "simple": "simple",
  "delicious": "delicioso",
  
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
  "handful": "puñado",
  "bunch": "manojo",
  
  // Common ingredients
  "butter": "mantequilla",
  "sugar": "azúcar",
  "brown sugar": "azúcar moreno",
  "powdered sugar": "azúcar glas",
  "flour": "harina",
  "all-purpose flour": "harina de trigo",
  "self-rising flour": "harina con levadura",
  "salt": "sal",
  "pepper": "pimienta",
  "black pepper": "pimienta negra",
  "water": "agua",
  "milk": "leche",
  "cream": "nata",
  "heavy cream": "nata para montar",
  "sour cream": "crema agria",
  "yogurt": "yogur",
  "yoghurt": "yogur",
  "natural yogurt": "yogur natural",
  "natural yoghurt": "yogur natural",
  "greek yogurt": "yogur griego",
  "egg": "huevo",
  "eggs": "huevos",
  "egg white": "clara de huevo",
  "egg yolk": "yema de huevo",
  "chicken": "pollo",
  "chicken breast": "pechuga de pollo",
  "chicken thigh": "muslo de pollo",
  "beef": "carne de res",
  "ground beef": "carne picada",
  "pork": "cerdo",
  "bacon": "bacon",
  "ham": "jamón",
  "sausage": "salchicha",
  "fish": "pescado",
  "salmon": "salmón",
  "tuna": "atún",
  "shrimp": "gambas",
  "prawns": "langostinos",
  "onion": "cebolla",
  "onions": "cebollas",
  "garlic": "ajo",
  "garlic cloves": "dientes de ajo",
  "clove": "diente",
  "cloves": "dientes",
  "olive oil": "aceite de oliva",
  "vegetable oil": "aceite vegetal",
  "oil": "aceite",
  "cheese": "queso",
  "grated cheese": "queso rallado",
  "parmesan": "parmesano",
  "mozzarella": "mozzarella",
  "cheddar": "cheddar",
  "cream cheese": "queso crema",
  "bread": "pan",
  "breadcrumbs": "pan rallado",
  "rice": "arroz",
  "pasta": "pasta",
  "noodles": "fideos",
  "spaghetti": "espaguetis",
  "tomato": "tomate",
  "tomatoes": "tomates",
  "cherry tomatoes": "tomates cherry",
  "tomato sauce": "salsa de tomate",
  "tomato paste": "concentrado de tomate",
  "potato": "patata",
  "potatoes": "patatas",
  "sweet potato": "boniato",
  "carrot": "zanahoria",
  "carrots": "zanahorias",
  "celery": "apio",
  "bell pepper": "pimiento",
  "bell peppers": "pimientos",
  "red pepper": "pimiento rojo",
  "green pepper": "pimiento verde",
  "mushroom": "champiñón",
  "mushrooms": "champiñones",
  "spinach": "espinacas",
  "broccoli": "brócoli",
  "cauliflower": "coliflor",
  "cabbage": "col",
  "lettuce": "lechuga",
  "cucumber": "pepino",
  "avocado": "aguacate",
  "corn": "maíz",
  "peas": "guisantes",
  "green beans": "judías verdes",
  "beans": "alubias",
  "lentils": "lentejas",
  "chickpeas": "garbanzos",
  "herbs": "hierbas",
  "herb": "hierba",
  "fresh herbs": "hierbas frescas",
  "dried herbs": "hierbas secas",
  "parsley": "perejil",
  "cilantro": "cilantro",
  "coriander": "cilantro",
  "basil": "albahaca",
  "oregano": "orégano",
  "thyme": "tomillo",
  "rosemary": "romero",
  "mint": "menta",
  "dill": "eneldo",
  "bay leaf": "hoja de laurel",
  "bay leaves": "hojas de laurel",
  "lemon": "limón",
  "lemon juice": "zumo de limón",
  "lemon zest": "ralladura de limón",
  "lime": "lima",
  "orange": "naranja",
  "apple": "manzana",
  "banana": "plátano",
  "strawberry": "fresa",
  "strawberries": "fresas",
  "blueberries": "arándanos",
  "raspberries": "frambuesas",
  "peach": "melocotón",
  "pear": "pera",
  "grapes": "uvas",
  "mango": "mango",
  "pineapple": "piña",
  "vanilla": "vainilla",
  "vanilla extract": "extracto de vainilla",
  "cinnamon": "canela",
  "nutmeg": "nuez moscada",
  "ginger": "jengibre",
  "cumin": "comino",
  "paprika": "pimentón",
  "cayenne": "cayena",
  "chili": "chile",
  "curry": "curry",
  "turmeric": "cúrcuma",
  "baking powder": "polvo de hornear",
  "baking soda": "bicarbonato de sodio",
  "yeast": "levadura",
  "honey": "miel",
  "maple syrup": "sirope de arce",
  "chocolate": "chocolate",
  "dark chocolate": "chocolate negro",
  "chocolate chips": "pepitas de chocolate",
  "cocoa powder": "cacao en polvo",
  "cocoa": "cacao",
  "nuts": "frutos secos",
  "almonds": "almendras",
  "walnuts": "nueces",
  "peanuts": "cacahuetes",
  "cashews": "anacardos",
  "hazelnuts": "avellanas",
  "peanut butter": "mantequilla de cacahuete",
  "soy sauce": "salsa de soja",
  "vinegar": "vinagre",
  "balsamic vinegar": "vinagre balsámico",
  "wine": "vino",
  "white wine": "vino blanco",
  "red wine": "vino tinto",
  "broth": "caldo",
  "chicken broth": "caldo de pollo",
  "beef broth": "caldo de carne",
  "vegetable broth": "caldo de verduras",
  "stock": "caldo",
  "mustard": "mostaza",
  "mayonnaise": "mayonesa",
  "ketchup": "ketchup",
  "hot sauce": "salsa picante",
  "worcestershire sauce": "salsa worcestershire",
  
  // Cooking actions
  "preheat": "precalentar",
  "bake": "hornear",
  "cook": "cocinar",
  "fry": "freír",
  "deep fry": "freír en abundante aceite",
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
  "let cool": "dejar enfriar",
  "set aside": "reservar",
  "cover": "tapar",
  "uncover": "destapar",
  "turn": "dar la vuelta",
  "flip": "dar la vuelta",
  "remove": "retirar",
  "place": "colocar",
  "put": "poner",
  "spread": "extender",
  "brush": "pincelar",
  "coat": "cubrir",
  "sprinkle": "espolvorear",
  "taste": "probar",
  "adjust": "ajustar",
  "blend": "batir",
  "puree": "triturar",
  "mash": "machacar",
  "crush": "machacar",
  "grind": "moler",
  "roast": "asar",
  "grill": "asar a la parrilla",
  "broil": "gratinar",
  "steam": "cocer al vapor",
  "braise": "estofar",
  "sear": "sellar",
  "brown": "dorar",
  "caramelize": "caramelizar",
  "reduce": "reducir",
  "thicken": "espesar",
  "dissolve": "disolver",
  "melt": "derretir",
  "soften": "ablandar",
  "toss": "mezclar",
  "layer": "colocar en capas",
  "arrange": "disponer",
  "transfer": "transferir",
  "line": "forrar",
  "grease": "engrasar",
  
  // Descriptors
  "chopped": "picado",
  "diced": "en cubos",
  "sliced": "en rodajas",
  "minced": "picado finamente",
  "grated": "rallado",
  "shredded": "rallado",
  "melted": "derretido",
  "softened": "ablandado",
  "beaten": "batido",
  "fresh": "fresco",
  "dried": "seco",
  "ground": "molido",
  "crushed": "machacado",
  "whole": "entero",
  "halved": "a la mitad",
  "quartered": "en cuartos",
  "large": "grande",
  "medium": "mediano",
  "small": "pequeño",
  "thin": "fino",
  "thick": "grueso",
  "hot": "caliente",
  "cold": "frío",
  "warm": "templado",
  "room temperature": "a temperatura ambiente",
  "optional": "opcional",
  "to taste": "al gusto",
  "as needed": "según sea necesario",
  "divided": "dividido",
  "packed": "compactado",
  "sifted": "tamizado",
  "peeled": "pelado",
  "seeded": "sin semillas",
  "cored": "sin corazón",
  "trimmed": "recortado",
  "rinsed": "enjuagado",
  "drained": "escurrido",
  "cooked": "cocido",
  "raw": "crudo",
  "ripe": "maduro",
  "firm": "firme",
  "tender": "tierno",
  "crispy": "crujiente",
  "golden": "dorado",
  "golden brown": "dorado",
  
  // Time and temperature
  "minutes": "minutos",
  "minute": "minuto",
  "hours": "horas",
  "hour": "hora",
  "seconds": "segundos",
  "overnight": "durante la noche",
  "degrees": "grados",
  "celsius": "centígrados",
  "fahrenheit": "fahrenheit",
  "oven": "horno",
  "pan": "sartén",
  "pot": "olla",
  "bowl": "bol",
  "mixing bowl": "bol para mezclar",
  "baking sheet": "bandeja de horno",
  "baking dish": "fuente de horno",
  "skillet": "sartén",
  "wok": "wok",
  "saucepan": "cacerola",
  "dutch oven": "olla de hierro",
  "pressure cooker": "olla a presión",
  "slow cooker": "olla de cocción lenta",
  "blender": "batidora",
  "food processor": "procesador de alimentos",
  "mixer": "batidora",
  "whisk": "batidor",
  "spatula": "espátula",
  "ladle": "cucharón",
  "tongs": "pinzas",
  "knife": "cuchillo",
  "cutting board": "tabla de cortar",
  "colander": "colador",
  "strainer": "colador",
  "measuring cup": "taza medidora",
  "measuring spoon": "cuchara medidora",
};

/**
 * Quick translation using dictionary (for common cooking terms)
 * Falls back to original if not found
 */
export function quickTranslate(text: string): string {
  const lower = text.toLowerCase().trim();
  return COOKING_TRANSLATIONS[lower] || text;
}

