import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Common SELECT projections
// ---------------------------------------------------------------------------
// Avoid pulling the heaviest column (`instructions`) on list/grid views; the
// detail page is the only surface that actually renders it and it can be
// fetched on demand from there.

/**
 * SELECT projection for recipe lists/grids (planner picker, recipes page).
 * Drops the `instructions` JSON column (the heaviest one) to reduce payload
 * size dramatically. Includes the `container` join so modals can read
 * `recipe.container?.name`.
 */
export const RECIPE_LIST_SELECT =
  "id, title, description, source_url, image_url, prep_time_minutes, cook_time_minutes, servings, personas_batch_count, personas_adults_per_batch, personas_children_per_batch, servings_unit, tags, ingredients, notes, rating, made_it, container_id, container_quantity, variant_1_label, variant_2_label, created_at, container:containers(*)";

/**
 * SELECT projection for recipes embedded inside `meal_plans`. Cells only need
 * a thumbnail and a title. The rest is looked up from the loaded recipes
 * map (or fetched on demand) when the user opens a modal.
 */
export const MEAL_PLAN_CELL_RECIPE_SELECT = "id, title, image_url";

/**
 * SELECT projection used to generate the shopping list. We need `ingredients`
 * and the portion-related fields, but `instructions` (the heavy field) is
 * useless here.
 */
export const RECIPE_SHOPPING_SELECT =
  "id, title, ingredients, servings, personas_batch_count, personas_adults_per_batch, personas_children_per_batch, servings_unit, container_id, container_quantity, variant_1_label, variant_2_label";

// Types for the database
export interface Instruction {
  text: string;
  ingredientIndices: number[]; // Índices de los ingredientes usados en este paso
  // Section header (e.g., "Para la base:", "Para el relleno:")
  isHeader?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  /** Personas mode: optional batch breakdown (null = legacy: 1 × servings adult-equivalent) */
  personas_batch_count: number | null;
  personas_adults_per_batch: number | null;
  personas_children_per_batch: number | null;
  servings_unit: string | null; // Custom unit for servings (e.g., "tortitas", "galletas"). Null = personas
  tags: string[];
  ingredients: Ingredient[];
  // Optional because list queries omit the heavy `instructions` JSON to keep
  // payload small. Detail pages and importers still select it explicitly.
  instructions?: Instruction[] | string[];
  notes: string | null;
  rating: number | null; // 1-3 stars, null = not rated
  made_it: boolean; // Whether user has made this recipe
  // Container-based portions (for baking recipes)
  container_id: string | null;
  container_quantity: number | null; // How many containers the recipe makes
  container?: Container; // Joined container data
  // Variant labels for ingredients with two sets of amounts
  // e.g., "Molde grande (26cm)" and "Molde pequeño (16cm)"
  variant_1_label: string | null;
  variant_2_label: string | null;
  created_at: string;
}

export interface Container {
  id: string;
  name: string;
  created_at: string;
}

// Helper para normalizar instrucciones (convierte strings a objetos Instruction)
export function normalizeInstructions(
  instructions: Instruction[] | string[] | null | undefined
): Instruction[] {
  if (!instructions || instructions.length === 0) return [];
  
  // Si ya son objetos Instruction, devolverlos
  if (typeof instructions[0] === 'object' && 'text' in instructions[0]) {
    return instructions as Instruction[];
  }
  
  // Si son strings, convertirlos
  return (instructions as string[]).map(text => ({
    text,
    ingredientIndices: []
  }));
}

export interface AlternativeIngredient {
  name: string;
  amount: string;
  unit: string;
  // Secondary/variant amounts for alternative ingredient
  amount2?: string;
  unit2?: string;
}

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  // Optional secondary measurement - can be used for:
  // 1. Alternative units (e.g., grams when primary is cups)
  // 2. Different variant amounts (e.g., "molde grande" vs "molde pequeño")
  amount2?: string;
  unit2?: string;
  category?: string;
  // Section header (e.g., "Para la base:", "Para el relleno:")
  isHeader?: boolean;
  /**
   * @deprecated Use `alternatives`. Single alternative kept for backwards
   * compatibility. New code should read via `getAlternativeIngredients()`.
   */
  alternative?: AlternativeIngredient;
  /**
   * Mixture of ingredients that together substitute this one
   * (e.g. 2 eggs → 6 g chía + 6 g lino + 70 g agua + 70 g yogur).
   * When this exists, it takes precedence over `alternative`.
   */
  alternatives?: AlternativeIngredient[];
}

/**
 * Returns the effective list of alternative ingredients for `ing`, merging
 * the legacy singular `alternative` field with the new `alternatives` array.
 */
export function getAlternativeIngredients(
  ing: Ingredient | null | undefined
): AlternativeIngredient[] {
  if (!ing) return [];
  if (Array.isArray(ing.alternatives) && ing.alternatives.length > 0) {
    return ing.alternatives.filter(
      (a) => a && ((a.name && a.name.trim()) || (a.amount && a.amount.trim()))
    );
  }
  if (ing.alternative && (ing.alternative.name || ing.alternative.amount)) {
    return [ing.alternative];
  }
  return [];
}

export interface MealPlan {
  id: string;
  plan_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recipe_id: string | null;
  recipe?: Recipe | null;
  // Variant selection for recipes with ingredient variants
  selected_variant: 1 | 2; // 1 = primary amounts, 2 = secondary amounts
  // Alternative ingredient selections: { "ingredientIndex": true } means use alternative
  alternative_selections: Record<string, boolean>;
  // Servings multiplier (1 = recipe default, 2 = double, 0.5 = half, etc.)
  servings_multiplier: number;
  // Free-text note (e.g. "Cumpleaños"). When set without a recipe the slot is a reminder.
  note?: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  /** When true, shown in the fixed "Fijados" section at the top of the list. */
  pinned?: boolean;
  recipe_id: string | null;
  week_start: string;
  recipe_sources: string[]; // Recipe titles that contributed to this item
  supermarket: SupermarketName; // Which supermarket this item belongs to
}

// Supermarket types
export type SupermarketName = 'DIA' | 'Consum' | 'Mercadona';

export const SUPERMARKETS: SupermarketName[] = ['DIA', 'Consum', 'Mercadona'];

export const SUPERMARKET_COLORS: Record<SupermarketName, { bg: string; text: string; border: string }> = {
  'DIA': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Consum': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Mercadona': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

export interface ShoppingList {
  id: string;
  name: string | null;
  supermarket: SupermarketName;
  status: 'active' | 'archived';
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  items?: ShoppingListItem[];
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  pinned?: boolean;
  recipe_id: string | null;
  created_at: string;
}

export interface ItemSupermarketHistory {
  id: string;
  item_name: string;
  item_name_normalized: string;
  supermarket: SupermarketName;
  frequency: number;
  last_used_at: string;
  created_at: string;
}

export interface SupermarketCategoryOrder {
  id: string;
  supermarket: SupermarketName;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Default categories in their default order
export const DEFAULT_CATEGORIES = [
  "Frutas y Verduras",
  "Lácteos",
  "Carnes y Mariscos",
  "Panadería",
  "Despensa",
  "Congelados",
  "Bebidas",
  "Comida Preparada",
  "Droguería",
  "Otros",
] as const;

export type CategoryName = typeof DEFAULT_CATEGORIES[number];

// Custom products added by the user
export interface CustomProduct {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  created_at: string;
}

// Fetch all custom products
export async function getCustomProducts(): Promise<CustomProduct[]> {
  const { data, error } = await supabase
    .from('custom_products')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching custom products:', error);
    return [];
  }
  
  return data || [];
}

// Add a new custom product
export async function addCustomProduct(
  name: string, 
  category: string
): Promise<CustomProduct | null> {
  const { data, error } = await supabase
    .from('custom_products')
    .insert({ 
      name: name.trim(), 
      category 
    })
    .select()
    .single();
  
  if (error) {
    // Si el error es de duplicado, no es un error crítico
    if (error.code === '23505') {
      console.log('Product already exists:', name);
      return null;
    }
    console.error('Error adding custom product:', error);
    return null;
  }
  
  return data;
}

// Search custom products by name
export async function searchCustomProducts(query: string): Promise<CustomProduct[]> {
  if (!query.trim()) return [];
  
  const { data, error } = await supabase
    .from('custom_products')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(30);
  
  if (error) {
    console.error('Error searching custom products:', error);
    return [];
  }
  
  return data || [];
}

