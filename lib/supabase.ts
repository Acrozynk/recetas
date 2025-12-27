import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for the database
export interface Instruction {
  text: string;
  ingredientIndices: number[]; // Índices de los ingredientes usados en este paso
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
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[] | string[]; // Soporta ambos formatos para retrocompatibilidad
  notes: string | null;
  rating: number | null; // 1-3 stars, null = not rated
  made_it: boolean; // Whether user has made this recipe
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

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  // Optional secondary measurement (e.g., grams when primary is cups)
  amount2?: string;
  unit2?: string;
  category?: string;
}

export interface MealPlan {
  id: string;
  plan_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recipe_id: string;
  recipe?: Recipe;
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
  "Otros",
] as const;

export type CategoryName = typeof DEFAULT_CATEGORIES[number];

