import type { Recipe } from "@/lib/supabase";

/** Baseline adult-equivalent portions the recipe ingredients are written for (same logic as recipe detail). */
export function getRecipePortionsBaseline(recipe: Recipe): number {
  const usesContainer = !!recipe.container_id;
  const usesUnits = !!recipe.servings_unit;
  if (usesContainer) return recipe.container_quantity || 1;
  if (usesUnits) return recipe.servings || 1;
  const hasStoredPersonas =
    recipe.personas_batch_count != null &&
    recipe.personas_adults_per_batch != null &&
    recipe.personas_children_per_batch != null;
  if (hasStoredPersonas) {
    return (
      recipe.personas_batch_count! *
      (recipe.personas_adults_per_batch! + 0.5 * recipe.personas_children_per_batch!)
    );
  }
  return recipe.servings || 1;
}

/** Person-based portion UI (lotes, adultos, niños) — not for containers, unit-based, or variant size recipes. */
export function isPersonasPortionRecipe(recipe: Recipe): boolean {
  return (
    !!recipe.servings &&
    !recipe.container_id &&
    !recipe.variant_1_label &&
    !recipe.servings_unit
  );
}

export function computeServingsMultiplierPersonas(
  recipe: Recipe,
  batchCount: number,
  adultsPerBatch: number,
  childrenPerBatch: number
): number {
  const orig = getRecipePortionsBaseline(recipe);
  if (orig <= 0) return 1;
  const total = batchCount * (adultsPerBatch + 0.5 * childrenPerBatch);
  if (total <= 0) return 0.25;
  return Math.round((total / orig) * 10000) / 10000;
}

/** Add calendar days to YYYY-MM-DD without UTC drift. */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Best-effort inverse when editing a plan: match stored multiplier with integer cook batches + recipe-shaped adults/children. */
export function inferPersonasStateFromMultiplier(
  recipe: Recipe,
  servingsMultiplier: number
): { batchCount: number; adultsPerBatch: number; childrenPerBatch: number } {
  const orig = getRecipePortionsBaseline(recipe);
  const target = Math.max(0.25, servingsMultiplier * orig);

  const hasPersonas =
    recipe.personas_adults_per_batch != null &&
    recipe.personas_children_per_batch != null;

  const adultsPerBatch = hasPersonas
    ? Math.max(0, recipe.personas_adults_per_batch!)
    : Math.max(1, recipe.servings || 4);
  const childrenPerBatch = hasPersonas ? Math.max(0, recipe.personas_children_per_batch!) : 0;

  const equiv = adultsPerBatch + 0.5 * childrenPerBatch;
  if (equiv <= 0) {
    return { batchCount: 1, adultsPerBatch: Math.max(1, adultsPerBatch), childrenPerBatch };
  }
  const raw = target / equiv;
  const batchCount = Math.max(1, Math.round(raw * 4) / 4);
  return { batchCount, adultsPerBatch, childrenPerBatch };
}
