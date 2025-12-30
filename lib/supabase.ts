import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  servings_unit: string | null; // Custom unit for servings (e.g., "tortitas", "galletas"). Null = personas
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[] | string[]; // Soporta ambos formatos para retrocompatibilidad
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
export function normalizeInstructions(instructions: Instruction[] | string[]): Instruction[] {
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
  // Alternative ingredient that can substitute this one
  // e.g., "½ tsp baking powder" can be replaced by "⅛ tsp baking soda"
  alternative?: AlternativeIngredient;
}

export interface MealPlan {
  id: string;
  plan_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recipe_id: string;
  recipe?: Recipe;
  // Variant selection for recipes with ingredient variants
  selected_variant: 1 | 2; // 1 = primary amounts, 2 = secondary amounts
  // Alternative ingredient selections: { "ingredientIndex": true } means use alternative
  alternative_selections: Record<string, boolean>;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  recipe_id: string | null;
  week_start: string;
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

