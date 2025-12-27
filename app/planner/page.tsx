"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Recipe, type MealPlan } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function getWeekDates(offset: number = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDayNumber(date: Date): string {
  return date.getDate().toString();
}

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecipeSelector, setShowRecipeSelector] = useState<{
    date: string;
    mealType: MealType;
  } | null>(null);
  const [search, setSearch] = useState("");

  const weekDates = getWeekDates(weekOffset);
  const weekStart = formatDateKey(weekDates[0]);
  const weekEnd = formatDateKey(weekDates[6]);

  const loadData = useCallback(async () => {
    try {
      // Load recipes
      const { data: recipesData } = await supabase
        .from("recipes")
        .select("*")
        .order("title");

      // Load meal plans for this week
      const { data: plansData } = await supabase
        .from("meal_plans")
        .select("*, recipe:recipes(*)")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd);

      setRecipes(recipesData || []);
      setMealPlans(plansData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMealPlan = (date: string, mealType: MealType): MealPlan | undefined => {
    return mealPlans.find(
      (mp) => mp.plan_date === date && mp.meal_type === mealType
    );
  };

  const addMealPlan = async (recipeId: string) => {
    if (!showRecipeSelector) return;

    const { date, mealType } = showRecipeSelector;

    try {
      // Delete existing plan for this slot if any
      await supabase
        .from("meal_plans")
        .delete()
        .eq("plan_date", date)
        .eq("meal_type", mealType);

      // Insert new plan
      const { error } = await supabase.from("meal_plans").insert([
        {
          plan_date: date,
          meal_type: mealType,
          recipe_id: recipeId,
        },
      ]);

      if (error) throw error;

      setShowRecipeSelector(null);
      loadData();
    } catch (error) {
      console.error("Error adding meal plan:", error);
    }
  };

  const removeMealPlan = async (planId: string) => {
    try {
      await supabase.from("meal_plans").delete().eq("id", planId);
      loadData();
    } catch (error) {
      console.error("Error removing meal plan:", error);
    }
  };

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(search.toLowerCase())
  );

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="min-h-screen pb-20">
      <Header
        title="Meal Planner"
        rightAction={
          <Link
            href="/shopping"
            className="p-2 text-[var(--color-amber)] hover:bg-[var(--color-cream-dark)] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </Link>
        }
      />

      <main className="max-w-4xl mx-auto p-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 text-[var(--color-warm-gray)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
              {weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} -{" "}
              {weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-sm text-[var(--color-amber)] hover:underline"
              >
                Go to current week
              </button>
            )}
          </div>

          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 text-[var(--color-warm-gray)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-[var(--color-cream-dark)] rounded mb-2" />
                <div className="space-y-2">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-16 bg-[var(--color-cream-dark)] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="grid grid-cols-7 gap-2 min-w-[640px]">
              {/* Day Headers */}
              {weekDates.map((date) => (
                <div
                  key={date.toISOString()}
                  className={`text-center p-2 rounded-lg ${
                    isToday(date)
                      ? "bg-[var(--color-amber)] text-white"
                      : "bg-[var(--color-cream-dark)]"
                  }`}
                >
                  <div className="text-xs font-medium opacity-80">
                    {formatDayName(date)}
                  </div>
                  <div className="text-lg font-semibold">{formatDayNumber(date)}</div>
                </div>
              ))}

              {/* Meal Slots */}
              {MEAL_TYPES.map((mealType) => (
                <>
                  {weekDates.map((date) => {
                    const dateKey = formatDateKey(date);
                    const plan = getMealPlan(dateKey, mealType);

                    return (
                      <div
                        key={`${dateKey}-${mealType}`}
                        className={`min-h-[80px] rounded-lg border-2 border-dashed p-2 transition-colors ${
                          plan
                            ? `meal-${mealType} border-solid`
                            : "border-[var(--border-color)] hover:border-[var(--color-amber)]"
                        }`}
                      >
                        {plan && plan.recipe ? (
                          <div className="relative h-full">
                            <button
                              onClick={() => removeMealPlan(plan.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                              style={{ opacity: 1 }}
                            >
                              ×
                            </button>
                            <Link
                              href={`/recipes/${plan.recipe.id}`}
                              className="block h-full"
                            >
                              <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">
                                {MEAL_LABELS[mealType]}
                              </span>
                              <p className="text-xs font-medium line-clamp-2 mt-1">
                                {plan.recipe.title}
                              </p>
                            </Link>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setShowRecipeSelector({ date: dateKey, mealType })
                            }
                            className="w-full h-full flex flex-col items-center justify-center text-[var(--color-warm-gray-light)] hover:text-[var(--color-amber)]"
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
                                strokeWidth={1.5}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            <span className="text-[10px] mt-1">
                              {MEAL_LABELS[mealType]}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Recipe Selector Modal */}
      {showRecipeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] flex flex-col animate-fade-in">
            <div className="p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-semibold">
                  Add {MEAL_LABELS[showRecipeSelector.mealType]}
                </h3>
                <button
                  onClick={() => setShowRecipeSelector(null)}
                  className="p-1 text-[var(--color-warm-gray-light)] hover:text-[var(--foreground)]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                placeholder="Search recipes..."
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredRecipes.length > 0 ? (
                <div className="space-y-1">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => addMealPlan(recipe.id)}
                      className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-cream-dark)] transition-colors"
                    >
                      <p className="font-medium text-[var(--foreground)]">
                        {recipe.title}
                      </p>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <p className="text-xs text-[var(--color-warm-gray-light)] mt-1">
                          {recipe.tags.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-warm-gray-light)]">
                  {recipes.length === 0 ? (
                    <>
                      <p>No recipes yet</p>
                      <Link
                        href="/recipes/new"
                        className="text-[var(--color-amber)] hover:underline mt-2 inline-block"
                      >
                        Add your first recipe
                      </Link>
                    </>
                  ) : (
                    <p>No recipes match your search</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

