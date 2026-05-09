/**
 * One-shot migration that removes the "lotes" (batches) concept from recipes.
 *
 * Background
 * ----------
 * A recipe used to be defined by `personas_batch_count × (adults + ½ children)`,
 * with the recipe's stored ingredients corresponding to that *total*.
 * For example a recipe saved as `3 lotes × 4 adultos = 12 porciones` had its
 * ingredients written for 12 portions (e.g. 300 g de harina).
 *
 * We're collapsing the model to a single "1 lote" concept, where the recipe
 * stores ingredients for one cooking session and multi-day cooking is handled
 * via consecutive day plans. To preserve the meaning of existing data we:
 *
 *  1. For every recipe with `personas_batch_count > 1`, divide every ingredient
 *     amount (`amount`, `amount2`, alternative.amount, alternative.amount2) by
 *     the old batch count. The recipe now represents one batch.
 *  2. Set `personas_batch_count = 1`.
 *  3. For every existing meal plan that points at one of those recipes,
 *     multiply `servings_multiplier` by the old batch count so that the total
 *     amount of food planned (and therefore the shopping list) stays the same.
 *
 * The migration is idempotent: once a recipe's `personas_batch_count` is 1 (or
 * null), re-running the migration is a no-op.
 */

import { supabase, type Ingredient } from "@/lib/supabase";
import { parseAmount, formatAmount } from "@/lib/unit-conversion";

export interface LotesMigrationPreview {
  /** Number of recipes that still have `personas_batch_count > 1`. */
  recipesToFix: number;
  /** Total meal plans that point to those recipes (their multiplier will be scaled). */
  plansToFix: number;
  /** Sample of recipe titles for display in the confirmation UI. */
  sampleRecipes: { id: string; title: string; batchCount: number }[];
}

export interface LotesMigrationResult {
  recipesUpdated: number;
  plansUpdated: number;
  skippedRecipes: { id: string; title: string; reason: string }[];
}

interface RecipeRow {
  id: string;
  title: string;
  ingredients: Ingredient[] | null;
  personas_batch_count: number | null;
}

/**
 * Divide a textual amount (e.g. "300", "1/2", "1 ½", "150,5") by `divisor`,
 * preserving the original style as much as possible. Non-numeric amounts
 * ("al gusto", "a ojo") are returned unchanged.
 */
function divideAmount(amount: string | undefined | null, divisor: number): string {
  if (!amount || !amount.trim()) return amount ?? "";
  if (divisor === 1) return amount;
  const parsed = parseAmount(amount);
  if (parsed === null || parsed === 0 || !Number.isFinite(parsed)) return amount;
  const result = parsed / divisor;
  // Round to a reasonable precision so 0.333... and friends stay clean.
  const rounded = Math.round(result * 10000) / 10000;
  return formatAmount(rounded);
}

function divideIngredients(
  ingredients: Ingredient[] | null | undefined,
  divisor: number
): Ingredient[] {
  if (!Array.isArray(ingredients)) return [];
  if (divisor === 1) return ingredients;
  return ingredients.map((ing) => {
    if (ing.isHeader) return ing;
    const next: Ingredient = {
      ...ing,
      amount: divideAmount(ing.amount, divisor),
    };
    if (ing.amount2 !== undefined) {
      next.amount2 = divideAmount(ing.amount2, divisor);
    }
    if (ing.alternative) {
      next.alternative = {
        ...ing.alternative,
        amount: divideAmount(ing.alternative.amount, divisor),
      };
      if (ing.alternative.amount2 !== undefined) {
        next.alternative.amount2 = divideAmount(ing.alternative.amount2, divisor);
      }
    }
    return next;
  });
}

/** Inspect the database and report what would change without modifying anything. */
export async function previewLotesMigration(): Promise<LotesMigrationPreview> {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, personas_batch_count")
    .gt("personas_batch_count", 1);

  if (error) throw error;

  const recipeIds = (recipes ?? []).map((r) => r.id);

  let plansToFix = 0;
  if (recipeIds.length > 0) {
    const { count, error: countErr } = await supabase
      .from("meal_plans")
      .select("id", { count: "exact", head: true })
      .in("recipe_id", recipeIds);
    if (countErr) throw countErr;
    plansToFix = count ?? 0;
  }

  return {
    recipesToFix: recipes?.length ?? 0,
    plansToFix,
    sampleRecipes: (recipes ?? []).slice(0, 5).map((r) => ({
      id: r.id,
      title: r.title,
      batchCount: r.personas_batch_count as number,
    })),
  };
}

/**
 * Run the migration. Operates recipe-by-recipe so a partial failure leaves the
 * rest in a consistent state. Returns counts plus any recipes that had to be
 * skipped (e.g. unparseable ingredients).
 */
export async function runLotesMigration(): Promise<LotesMigrationResult> {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, ingredients, personas_batch_count")
    .gt("personas_batch_count", 1);

  if (error) throw error;

  const result: LotesMigrationResult = {
    recipesUpdated: 0,
    plansUpdated: 0,
    skippedRecipes: [],
  };

  for (const recipe of (recipes ?? []) as RecipeRow[]) {
    const oldBatch = recipe.personas_batch_count;
    if (!oldBatch || oldBatch <= 1) continue;

    const newIngredients = divideIngredients(recipe.ingredients, oldBatch);

    // 1. Bump existing meal plans BEFORE the recipe is rewritten, so if the
    //    recipe update fails partway we don't end up with double-scaled plans.
    const { data: plans, error: planErr } = await supabase
      .from("meal_plans")
      .select("id, servings_multiplier")
      .eq("recipe_id", recipe.id);

    if (planErr) {
      result.skippedRecipes.push({
        id: recipe.id,
        title: recipe.title,
        reason: planErr.message || "No se pudieron leer los planes de comida.",
      });
      continue;
    }

    let plansThisRecipe = 0;
    for (const plan of plans ?? []) {
      const currentMultiplier = plan.servings_multiplier ?? 1;
      const nextMultiplier =
        Math.round(currentMultiplier * oldBatch * 10000) / 10000;
      const { error: planUpdateErr } = await supabase
        .from("meal_plans")
        .update({ servings_multiplier: nextMultiplier })
        .eq("id", plan.id);
      if (planUpdateErr) {
        result.skippedRecipes.push({
          id: recipe.id,
          title: recipe.title,
          reason: `Error actualizando plan ${plan.id}: ${planUpdateErr.message}`,
        });
        // Best effort: continue with the rest. We won't update the recipe in
        // this case to avoid making the data inconsistent.
        plansThisRecipe = -1;
        break;
      }
      plansThisRecipe += 1;
    }

    if (plansThisRecipe < 0) continue;

    // 2. Now update the recipe itself.
    const { error: recipeUpdateErr } = await supabase
      .from("recipes")
      .update({
        ingredients: newIngredients,
        personas_batch_count: 1,
      })
      .eq("id", recipe.id);

    if (recipeUpdateErr) {
      result.skippedRecipes.push({
        id: recipe.id,
        title: recipe.title,
        reason: `Receta no actualizada: ${recipeUpdateErr.message}. Los planes ya se reescalaron; vuelve a lanzar la migración.`,
      });
      continue;
    }

    result.recipesUpdated += 1;
    result.plansUpdated += plansThisRecipe;
  }

  return result;
}
