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

/** Person-based portion UI (adultos, niños) — not for containers, unit-based, or variant size recipes. */
export function isPersonasPortionRecipe(recipe: Recipe): boolean {
  return (
    !!recipe.servings &&
    !recipe.container_id &&
    !recipe.variant_1_label &&
    !recipe.servings_unit
  );
}

/**
 * Default adults/children for a personas-mode recipe, collapsing any legacy
 * `personas_batch_count > 1` into the per-batch counts. This way recipes that
 * haven't been migrated yet still show a sensible default (e.g. a recipe saved
 * as 3 lotes × 4 adults reads as 12 adults until the user runs the migration).
 */
export function getRecipeDefaultPersonas(recipe: Recipe): {
  adults: number;
  children: number;
} {
  const hasPersonas =
    recipe.personas_adults_per_batch != null &&
    recipe.personas_children_per_batch != null;
  if (!hasPersonas) {
    return { adults: Math.max(1, recipe.servings || 4), children: 0 };
  }
  const batches = Math.max(1, recipe.personas_batch_count ?? 1);
  return {
    adults: Math.max(0, batches * recipe.personas_adults_per_batch!),
    children: Math.max(0, batches * recipe.personas_children_per_batch!),
  };
}

export function computeServingsMultiplierPersonas(
  recipe: Recipe,
  adultsPerBatch: number,
  childrenPerBatch: number
): number {
  const orig = getRecipePortionsBaseline(recipe);
  if (orig <= 0) return 1;
  const total = adultsPerBatch + 0.5 * childrenPerBatch;
  if (total <= 0) return 0.25;
  return Math.round((total / orig) * 10000) / 10000;
}

/** Add calendar days to YYYY-MM-DD without UTC drift. */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Best-effort inverse when editing a plan: turn a stored servings multiplier
 * back into adults/children, preserving the recipe's adult-to-child ratio.
 */
export function inferPersonasStateFromMultiplier(
  recipe: Recipe,
  servingsMultiplier: number
): { adultsPerBatch: number; childrenPerBatch: number } {
  const orig = getRecipePortionsBaseline(recipe);
  const target = Math.max(0.25, servingsMultiplier * orig);

  const defaults = getRecipeDefaultPersonas(recipe);
  const defaultEquiv = defaults.adults + 0.5 * defaults.children;
  if (defaultEquiv <= 0) {
    return {
      adultsPerBatch: Math.max(1, Math.round(target)),
      childrenPerBatch: 0,
    };
  }

  const scale = target / defaultEquiv;
  return {
    adultsPerBatch: Math.max(0, Math.round(defaults.adults * scale)),
    childrenPerBatch: Math.max(0, Math.round(defaults.children * scale)),
  };
}
