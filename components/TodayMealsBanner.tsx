"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  supabase,
  MEAL_PLAN_CELL_RECIPE_SELECT,
  type MealPlan,
  type Recipe,
} from "@/lib/supabase";
import { MEAL_LABELS } from "@/lib/meal-plan-types";
import { addCalendarDays } from "@/lib/meal-plan-portions";

type TodayMealPlan = Omit<MealPlan, "recipe"> & {
  recipe: Pick<Recipe, "id" | "title" | "image_url">;
};

const DISMISS_KEY = "todayBannerDismissedDate";

/**
 * Green "¡Hoy toca cocinar!" banner. Loads today's planned recipes and lets
 * the user dismiss it for the day. Dismissal is shared across screens via
 * sessionStorage, so closing it on /recipes also hides it on /planner.
 */
export default function TodayMealsBanner() {
  const [todayMealPlans, setTodayMealPlans] = useState<TodayMealPlan[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastDismissed = sessionStorage.getItem(DISMISS_KEY);
    if (lastDismissed === today) {
      setDismissed(true);
    } else if (lastDismissed) {
      sessionStorage.removeItem(DISMISS_KEY);
    }

    let cancelled = false;
    (async () => {
      try {
        // Pull yesterday too so we can detect the case where today is just a
        // leftover day of a consecutive-day plan (cooked previously). Same
        // recipe + same meal type the day before = today is not a cook day.
        const yesterday = addCalendarDays(today, -1);
        const { data, error } = await supabase
          .from("meal_plans")
          .select(`*, recipe:recipes(${MEAL_PLAN_CELL_RECIPE_SELECT})`)
          .gte("plan_date", yesterday)
          .lte("plan_date", today);

        if (cancelled) return;
        if (error) throw error;

        const allPlans = data || [];
        const yesterdayKeys = new Set(
          allPlans
            .filter(
              (p) => p.plan_date === yesterday && p.recipe_id != null
            )
            .map((p) => `${p.recipe_id}::${p.meal_type}`)
        );

        const plansWithRecipes = allPlans
          .filter((plan) => plan.plan_date === today)
          .filter(
            (plan): plan is TodayMealPlan =>
              plan.recipe !== null && plan.recipe_id !== null
          )
          .filter(
            (plan) =>
              !yesterdayKeys.has(`${plan.recipe_id}::${plan.meal_type}`)
          );
        setTodayMealPlans(plansWithRecipes);
      } catch (err) {
        console.error("Error checking today's meal plans:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const today = new Date().toISOString().split("T")[0];
    sessionStorage.setItem(DISMISS_KEY, today);
  };

  if (dismissed || todayMealPlans.length === 0) return null;

  return (
    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-300 rounded-xl animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center">
          <span className="text-xl">👨‍🍳</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-emerald-900">¡Hoy toca cocinar!</p>
          <p className="text-sm text-emerald-700 mt-0.5">
            {todayMealPlans.length === 1
              ? "Tienes 1 receta planeada para hoy"
              : `Tienes ${todayMealPlans.length} recetas planeadas para hoy`}
          </p>

          <div className="mt-3 space-y-2">
            {todayMealPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/recipes/${plan.recipe_id}`}
                className="flex items-center gap-3 p-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
              >
                {plan.recipe.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plan.recipe.image_url}
                    alt=""
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-900 truncate group-hover:text-emerald-700">
                    {plan.recipe.title}
                  </p>
                  <p className="text-xs text-emerald-600">
                    {MEAL_LABELS[plan.meal_type] || plan.meal_type}
                  </p>
                </div>
                <div className="flex-shrink-0 text-emerald-500 group-hover:text-emerald-700">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-emerald-400 hover:text-emerald-600 transition-colors"
          title="Ocultar por hoy"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
