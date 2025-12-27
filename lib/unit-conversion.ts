// Unit Conversion Utility for Recipe Ingredients
// Supports volume-to-weight conversions for common ingredients

export type VolumeUnit = 'cup' | 'cups' | 'taza' | 'tazas' | 
                          'tbsp' | 'tablespoon' | 'cucharada' | 'cucharadas' | 'cda' | 'cdas' |
                          'tsp' | 'teaspoon' | 'cucharadita' | 'cucharaditas' | 'cdta' | 'cdtas' |
                          'ml' | 'mL' | 'milliliter' | 'milliliters' |
                          'l' | 'L' | 'liter' | 'liters' | 'litro' | 'litros' |
                          'fl oz' | 'fluid ounce' | 'fluid ounces' | 'onza líquida';

export type WeightUnit = 'g' | 'gram' | 'grams' | 'gramo' | 'gramos' |
                          'kg' | 'kilogram' | 'kilograms' | 'kilo' | 'kilos' |
                          'oz' | 'ounce' | 'ounces' | 'onza' | 'onzas' |
                          'lb' | 'lbs' | 'pound' | 'pounds' | 'libra' | 'libras';

export type CountUnit = 'piece' | 'pieces' | 'pieza' | 'piezas' | 'unidad' | 'unidades' | 
                         'whole' | 'entero' | 'enteros' | '';

export type Unit = VolumeUnit | WeightUnit | CountUnit;

// Normalize unit to a standard form
export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  
  // Volume units
  if (['cup', 'cups', 'taza', 'tazas'].includes(u)) return 'cup';
  if (['tbsp', 'tablespoon', 'tablespoons', 'cucharada', 'cucharadas', 'cda', 'cdas'].includes(u)) return 'tbsp';
  if (['tsp', 'teaspoon', 'teaspoons', 'cucharadita', 'cucharaditas', 'cdta', 'cdtas'].includes(u)) return 'tsp';
  if (['ml', 'milliliter', 'milliliters', 'mililitro', 'mililitros'].includes(u)) return 'ml';
  if (['l', 'liter', 'liters', 'litro', 'litros'].includes(u)) return 'l';
  if (['fl oz', 'fluid ounce', 'fluid ounces', 'onza líquida'].includes(u)) return 'fl oz';
  
  // Weight units
  if (['g', 'gram', 'grams', 'gramo', 'gramos'].includes(u)) return 'g';
  if (['kg', 'kilogram', 'kilograms', 'kilo', 'kilos'].includes(u)) return 'kg';
  if (['oz', 'ounce', 'ounces', 'onza', 'onzas'].includes(u)) return 'oz';
  if (['lb', 'lbs', 'pound', 'pounds', 'libra', 'libras'].includes(u)) return 'lb';
  
  return u;
}

// Check if unit is a volume unit
export function isVolumeUnit(unit: string): boolean {
  const normalized = normalizeUnit(unit);
  return ['cup', 'tbsp', 'tsp', 'ml', 'l', 'fl oz'].includes(normalized);
}

// Check if unit is a weight unit
export function isWeightUnit(unit: string): boolean {
  const normalized = normalizeUnit(unit);
  return ['g', 'kg', 'oz', 'lb'].includes(normalized);
}

// Convert volume units to ml
export function toMilliliters(amount: number, unit: string): number | null {
  const normalized = normalizeUnit(unit);
  const conversions: Record<string, number> = {
    'ml': 1,
    'l': 1000,
    'cup': 236.588,
    'tbsp': 14.787,
    'tsp': 4.929,
    'fl oz': 29.574,
  };
  return conversions[normalized] ? amount * conversions[normalized] : null;
}

// Convert ml to other volume units
export function fromMilliliters(ml: number, targetUnit: string): number | null {
  const normalized = normalizeUnit(targetUnit);
  const conversions: Record<string, number> = {
    'ml': 1,
    'l': 1000,
    'cup': 236.588,
    'tbsp': 14.787,
    'tsp': 4.929,
    'fl oz': 29.574,
  };
  return conversions[normalized] ? ml / conversions[normalized] : null;
}

// Convert weight units to grams
export function toGrams(amount: number, unit: string): number | null {
  const normalized = normalizeUnit(unit);
  const conversions: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'oz': 28.3495,
    'lb': 453.592,
  };
  return conversions[normalized] ? amount * conversions[normalized] : null;
}

// Convert grams to other weight units
export function fromGrams(grams: number, targetUnit: string): number | null {
  const normalized = normalizeUnit(targetUnit);
  const conversions: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'oz': 28.3495,
    'lb': 453.592,
  };
  return conversions[normalized] ? grams / conversions[normalized] : null;
}

// Ingredient densities (grams per cup) for common ingredients
// This allows volume-to-weight conversion
const INGREDIENT_DENSITIES: Record<string, number> = {
  // Flours
  'flour': 125,
  'harina': 125,
  'all-purpose flour': 125,
  'harina de trigo': 125,
  'bread flour': 127,
  'harina de fuerza': 127,
  'whole wheat flour': 120,
  'harina integral': 120,
  'almond flour': 96,
  'harina de almendra': 96,
  'coconut flour': 112,
  'harina de coco': 112,
  
  // Sugars
  'sugar': 200,
  'azúcar': 200,
  'white sugar': 200,
  'azúcar blanco': 200,
  'brown sugar': 220,
  'azúcar moreno': 220,
  'powdered sugar': 120,
  'azúcar glas': 120,
  'azúcar glass': 120,
  'icing sugar': 120,
  'honey': 340,
  'miel': 340,
  'maple syrup': 322,
  'sirope de arce': 322,
  
  // Fats
  'butter': 227,
  'mantequilla': 227,
  'oil': 218,
  'aceite': 218,
  'olive oil': 216,
  'aceite de oliva': 216,
  'vegetable oil': 218,
  'aceite vegetal': 218,
  'coconut oil': 218,
  'aceite de coco': 218,
  
  // Dairy
  'milk': 245,
  'leche': 245,
  'cream': 238,
  'nata': 238,
  'crema': 238,
  'heavy cream': 238,
  'nata para montar': 238,
  'sour cream': 242,
  'crema agria': 242,
  'yogurt': 245,
  'greek yogurt': 284,
  'yogur griego': 284,
  'cream cheese': 232,
  'queso crema': 232,
  
  // Liquids
  'water': 237,
  'agua': 237,
  
  // Grains & Starches
  'rice': 185,
  'arroz': 185,
  'oats': 80,
  'avena': 80,
  'rolled oats': 80,
  'copos de avena': 80,
  'cornstarch': 128,
  'maicena': 128,
  'almidón de maíz': 128,
  
  // Nuts & Seeds
  'almonds': 143,
  'almendras': 143,
  'walnuts': 120,
  'nueces': 120,
  'pecans': 109,
  'nueces pecanas': 109,
  'peanuts': 146,
  'cacahuetes': 146,
  'maní': 146,
  'cashews': 137,
  'anacardos': 137,
  
  // Chocolate & Cocoa
  'cocoa powder': 86,
  'cacao en polvo': 86,
  'chocolate chips': 170,
  'chispas de chocolate': 170,
  
  // Other common ingredients
  'salt': 288,
  'sal': 288,
  'baking powder': 230,
  'polvo de hornear': 230,
  'levadura química': 230,
  'baking soda': 288,
  'bicarbonato': 288,
  'yeast': 128,
  'levadura': 128,
  
  // Default fallback (water-like density)
  'default': 237,
};

// Find ingredient density (grams per cup)
export function getIngredientDensity(ingredientName: string): number {
  const name = ingredientName.toLowerCase().trim();
  
  // Try exact match first
  if (INGREDIENT_DENSITIES[name]) {
    return INGREDIENT_DENSITIES[name];
  }
  
  // Try partial match
  for (const [key, density] of Object.entries(INGREDIENT_DENSITIES)) {
    if (name.includes(key) || key.includes(name)) {
      return density;
    }
  }
  
  // Return default
  return INGREDIENT_DENSITIES['default'];
}

// Parse amount string to number (handles fractions)
export function parseAmount(amount: string): number | null {
  if (!amount || !amount.trim()) return null;
  
  const cleaned = amount.trim();
  
  // Handle mixed numbers like "1 1/2"
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    return whole + (num / den);
  }
  
  // Handle fractions like "1/2"
  const fractionMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }
  
  // Handle decimals
  const numMatch = cleaned.match(/^[\d.]+/);
  if (numMatch) {
    return parseFloat(numMatch[0]);
  }
  
  return null;
}

// Format amount for display (convert to fraction if appropriate)
export function formatAmount(num: number): string {
  // Common fractions
  const fractions: Record<number, string> = {
    0.125: '⅛',
    0.25: '¼',
    0.333: '⅓',
    0.375: '⅜',
    0.5: '½',
    0.625: '⅝',
    0.667: '⅔',
    0.75: '¾',
    0.875: '⅞',
  };
  
  const whole = Math.floor(num);
  const decimal = num - whole;
  
  // Check if decimal part matches a common fraction
  let fractionPart = '';
  for (const [value, symbol] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(value)) < 0.02) {
      fractionPart = symbol;
      break;
    }
  }
  
  if (fractionPart) {
    return whole > 0 ? `${whole} ${fractionPart}` : fractionPart;
  }
  
  // Round to 2 decimal places and remove trailing zeros
  return num.toFixed(2).replace(/\.?0+$/, '');
}

export interface ConversionResult {
  amount: string;
  unit: string;
  success: boolean;
  approximate?: boolean;
}

// Convert between units for an ingredient
export function convertIngredient(
  amount: string,
  fromUnit: string,
  toUnit: string,
  ingredientName?: string
): ConversionResult {
  const parsedAmount = parseAmount(amount);
  if (parsedAmount === null) {
    return { amount: '', unit: toUnit, success: false };
  }
  
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);
  
  // Same unit type - direct conversion
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const ml = toMilliliters(parsedAmount, fromUnit);
    if (ml !== null) {
      const converted = fromMilliliters(ml, toUnit);
      if (converted !== null) {
        return { amount: formatAmount(converted), unit: toUnit, success: true };
      }
    }
  }
  
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    const grams = toGrams(parsedAmount, fromUnit);
    if (grams !== null) {
      const converted = fromGrams(grams, toUnit);
      if (converted !== null) {
        return { amount: formatAmount(converted), unit: toUnit, success: true };
      }
    }
  }
  
  // Cross-type conversion (volume <-> weight) requires ingredient density
  if (isVolumeUnit(fromUnit) && isWeightUnit(toUnit)) {
    const density = getIngredientDensity(ingredientName || '');
    const ml = toMilliliters(parsedAmount, fromUnit);
    if (ml !== null) {
      // Convert ml to cups, then multiply by density to get grams
      const cups = ml / 236.588;
      const grams = cups * density;
      const converted = fromGrams(grams, toUnit);
      if (converted !== null) {
        return { amount: formatAmount(converted), unit: toUnit, success: true, approximate: true };
      }
    }
  }
  
  if (isWeightUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const density = getIngredientDensity(ingredientName || '');
    const grams = toGrams(parsedAmount, fromUnit);
    if (grams !== null) {
      // Convert grams to cups using density
      const cups = grams / density;
      const ml = cups * 236.588;
      const converted = fromMilliliters(ml, toUnit);
      if (converted !== null) {
        return { amount: formatAmount(converted), unit: toUnit, success: true, approximate: true };
      }
    }
  }
  
  return { amount: '', unit: toUnit, success: false };
}

// Get suggested conversion unit based on current unit
export function getSuggestedConversionUnit(currentUnit: string): string {
  const normalized = normalizeUnit(currentUnit);
  
  // Volume -> Weight (prefer grams)
  if (isVolumeUnit(currentUnit)) return 'g';
  
  // Weight -> Volume (prefer cups or ml based on amount)
  if (isWeightUnit(currentUnit)) return 'ml';
  
  return 'g'; // Default
}

// Get list of common units for dropdowns
export const COMMON_UNITS = {
  volume: [
    { value: 'cup', label: 'taza' },
    { value: 'tbsp', label: 'cucharada' },
    { value: 'tsp', label: 'cucharadita' },
    { value: 'ml', label: 'ml' },
    { value: 'l', label: 'litro' },
  ],
  weight: [
    { value: 'g', label: 'g' },
    { value: 'kg', label: 'kg' },
    { value: 'oz', label: 'oz' },
    { value: 'lb', label: 'lb' },
  ],
  all: [
    { value: 'cup', label: 'taza' },
    { value: 'tbsp', label: 'cucharada' },
    { value: 'tsp', label: 'cucharadita' },
    { value: 'ml', label: 'ml' },
    { value: 'l', label: 'litro' },
    { value: 'g', label: 'g' },
    { value: 'kg', label: 'kg' },
    { value: 'oz', label: 'oz' },
    { value: 'lb', label: 'lb' },
    { value: '', label: 'unidad' },
  ],
};

