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

