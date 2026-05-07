/**
 * Shared, lightweight constants/types for meal-plan UI.
 *
 * Living in their own module keeps the planner page module from being a hard
 * dependency for the modals that we lazy-load with `next/dynamic`.
 */

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
};

export interface VariantSelection {
  selectedVariant: 1 | 2;
  alternativeSelections: Record<string, boolean>;
  servingsMultiplier: number;
  /** Solo al añadir: número de días consecutivos con la misma comida y mismas opciones. */
  consecutiveDayCount: number;
  newDate?: string;
  newMealType?: string;
}
