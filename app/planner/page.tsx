"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Recipe, type MealPlan, type Ingredient } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

// Modal para seleccionar variantes de ingredientes y porciones
interface VariantSelection {
  selectedVariant: 1 | 2;
  alternativeSelections: Record<string, boolean>;
  servingsMultiplier: number;
}

function RecipeOptionsModal({
  isOpen,
  onClose,
  recipe,
  onConfirm,
  initialSelection,
}: {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  onConfirm: (selection: VariantSelection) => void;
  initialSelection?: VariantSelection;
}) {
  const [selectedVariant, setSelectedVariant] = useState<1 | 2>(initialSelection?.selectedVariant ?? 1);
  const [alternativeSelections, setAlternativeSelections] = useState<Record<string, boolean>>(initialSelection?.alternativeSelections ?? {});
  const [servingsMultiplier, setServingsMultiplier] = useState(initialSelection?.servingsMultiplier ?? 1);

  // Reset state when modal opens with new recipe/initial values
  useEffect(() => {
    if (isOpen) {
      setSelectedVariant(initialSelection?.selectedVariant ?? 1);
      setAlternativeSelections(initialSelection?.alternativeSelections ?? {});
      setServingsMultiplier(initialSelection?.servingsMultiplier ?? 1);
    }
  }, [isOpen, initialSelection]);

  // Check what options this recipe has
  const hasVariants = !!(recipe.variant_1_label && recipe.variant_2_label);
  const ingredients = recipe.ingredients as Ingredient[];
  const ingredientsWithAlternatives = ingredients
    .map((ing, idx) => ({ ingredient: ing, index: idx }))
    .filter(({ ingredient }) => ingredient.alternative?.name && !ingredient.isHeader);

  const hasAlternatives = ingredientsWithAlternatives.length > 0;

  // Get servings display
  const baseServings = recipe.servings || 4;
  const servingsUnit = recipe.servings_unit || "personas";
  const calculatedServings = Math.round(baseServings * servingsMultiplier * 10) / 10;

  const toggleAlternative = (index: number) => {
    setAlternativeSelections(prev => ({
      ...prev,
      [index.toString()]: !prev[index.toString()]
    }));
  };

  const handleConfirm = async () => {
    await onConfirm({
      selectedVariant,
      alternativeSelections,
      servingsMultiplier
    });
    onClose();
  };

  // Quick multiplier buttons
  const quickMultipliers = [0.5, 1, 1.5, 2, 3];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                {initialSelection ? "Editar Porciones" : "Ajustar Porciones"}
              </h3>
              <p className="text-sm text-[var(--color-slate)] mt-1 line-clamp-1">
                {recipe.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Servings/Portions Selector */}
          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
              <span className="text-lg">👥</span>
              Porciones
            </h4>
            <div className="bg-[var(--color-purple-bg)] rounded-xl p-4">
              <div className="text-center mb-3">
                <span className="text-3xl font-bold text-[var(--color-purple)]">
                  {calculatedServings}
                </span>
                <span className="text-[var(--color-slate)] ml-2">
                  {servingsUnit}
                </span>
                {servingsMultiplier !== 1 && (
                  <span className="text-sm text-[var(--color-slate-light)] block mt-1">
                    (Original: {baseServings} {servingsUnit})
                  </span>
                )}
              </div>
              
              {/* Quick multiplier buttons */}
              <div className="flex gap-2 justify-center flex-wrap">
                {quickMultipliers.map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setServingsMultiplier(mult)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      servingsMultiplier === mult
                        ? "bg-[var(--color-purple)] text-white"
                        : "bg-white border border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple)]"
                    }`}
                  >
                    {mult === 1 ? "×1" : mult < 1 ? `×${mult}` : `×${mult}`}
                  </button>
                ))}
              </div>
              
              {/* Custom input */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => setServingsMultiplier(Math.max(0.25, servingsMultiplier - 0.25))}
                  className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center hover:border-[var(--color-purple)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  value={servingsMultiplier}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setServingsMultiplier(val);
                    }
                  }}
                  step="0.25"
                  min="0.25"
                  className="w-20 text-center border border-[var(--border-color)] rounded-lg py-1 px-2 text-sm"
                />
                <button
                  onClick={() => setServingsMultiplier(servingsMultiplier + 0.25)}
                  className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center hover:border-[var(--color-purple)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Variant Selection (size variants like "molde grande" vs "molde pequeño") */}
          {hasVariants && (
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <span className="text-lg">📏</span>
                Tamaño de la receta
              </h4>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVariant === 1
                      ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                      : "border-[var(--border-color)] hover:border-[var(--color-purple-light)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="variant"
                    checked={selectedVariant === 1}
                    onChange={() => setSelectedVariant(1)}
                    className="w-4 h-4 text-[var(--color-purple)]"
                  />
                  <span className="font-medium">{recipe.variant_1_label}</span>
                </label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVariant === 2
                      ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                      : "border-[var(--border-color)] hover:border-[var(--color-purple-light)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="variant"
                    checked={selectedVariant === 2}
                    onChange={() => setSelectedVariant(2)}
                    className="w-4 h-4 text-[var(--color-purple)]"
                  />
                  <span className="font-medium">{recipe.variant_2_label}</span>
                </label>
              </div>
            </div>
          )}

          {/* Alternative Ingredients Selection */}
          {hasAlternatives && (
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <span className="text-lg">🔄</span>
                Ingredientes alternativos
              </h4>
              <p className="text-sm text-[var(--color-slate)] mb-3">
                Algunos ingredientes tienen alternativas. Elige cuál prefieres:
              </p>
              <div className="space-y-3">
                {ingredientsWithAlternatives.map(({ ingredient, index }) => {
                  const useAlternative = alternativeSelections[index.toString()] || false;
                  const alt = ingredient.alternative!;
                  
                  // Format ingredient display
                  const primaryText = `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`.trim();
                  const altText = `${alt.amount} ${alt.unit} ${alt.name}`.trim();
                  
                  return (
                    <div key={index} className="bg-[var(--color-purple-bg)] rounded-xl p-3">
                      <div className="space-y-2">
                        <label
                          className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                            !useAlternative
                              ? "bg-white border-2 border-[var(--color-purple)]"
                              : "hover:bg-white/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`alt-${index}`}
                            checked={!useAlternative}
                            onChange={() => setAlternativeSelections(prev => ({
                              ...prev,
                              [index.toString()]: false
                            }))}
                            className="mt-0.5 w-4 h-4 text-[var(--color-purple)]"
                          />
                          <span className={!useAlternative ? "font-medium" : "text-[var(--color-slate)]"}>
                            {primaryText}
                          </span>
                        </label>
                        <label
                          className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                            useAlternative
                              ? "bg-white border-2 border-[var(--color-purple)]"
                              : "hover:bg-white/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`alt-${index}`}
                            checked={useAlternative}
                            onChange={() => toggleAlternative(index)}
                            className="mt-0.5 w-4 h-4 text-[var(--color-purple)]"
                          />
                          <span className={useAlternative ? "font-medium" : "text-[var(--color-slate)]"}>
                            {altText}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

interface Suggestion {
  recipe_id: string;
  title: string;
  tags: string[];
  image_url: string | null;
  times_planned: number;
  days_since_last: number | null;
  reason: string;
}

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
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
  return date.toLocaleDateString("es-ES", { weekday: "short" });
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // Tag filtering state
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  // Recipe options modal state (for servings, variants, alternatives)
  const [showRecipeOptions, setShowRecipeOptions] = useState<{
    recipe: Recipe;
    date: string;
    mealType: MealType;
    existingPlanId?: string;
    initialSelection?: VariantSelection;
  } | null>(null);

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

  const addMealPlan = async (recipeId: string, variantSelection?: VariantSelection) => {
    if (!showRecipeSelector) return;

    const { date, mealType } = showRecipeSelector;
    
    // Find the recipe
    const recipe = recipes.find(r => r.id === recipeId);
    
    // Always show options modal to allow adjusting servings
    if (recipe && !variantSelection) {
      setShowRecipeOptions({ recipe, date, mealType });
      return;
    }

    try {
      // Delete existing plan for this slot if any
      await supabase
        .from("meal_plans")
        .delete()
        .eq("plan_date", date)
        .eq("meal_type", mealType);

      // Insert new plan with all options
      const { error } = await supabase.from("meal_plans").insert([
        {
          plan_date: date,
          meal_type: mealType,
          recipe_id: recipeId,
          selected_variant: variantSelection?.selectedVariant ?? 1,
          alternative_selections: variantSelection?.alternativeSelections ?? {},
          servings_multiplier: variantSelection?.servingsMultiplier ?? 1,
        },
      ]);

      if (error) throw error;

      setShowRecipeSelector(null);
      setShowRecipeOptions(null);
      loadData();
    } catch (error) {
      console.error("Error adding meal plan:", error);
    }
  };
  
  // Handle recipe options confirmation
  const handleRecipeOptionsConfirm = async (selection: VariantSelection) => {
    if (!showRecipeOptions) return;
    
    const { recipe, date, mealType, existingPlanId } = showRecipeOptions;
    
    try {
      if (existingPlanId) {
        // Update existing meal plan
        const { error } = await supabase
          .from("meal_plans")
          .update({
            selected_variant: selection.selectedVariant,
            alternative_selections: selection.alternativeSelections,
            servings_multiplier: selection.servingsMultiplier,
          })
          .eq("id", existingPlanId);

        if (error) throw error;
      } else {
        // Add new meal plan - handle directly here instead of delegating to addMealPlan
        // to avoid race condition with showRecipeSelector being cleared
        
        // Delete existing plan for this slot if any
        await supabase
          .from("meal_plans")
          .delete()
          .eq("plan_date", date)
          .eq("meal_type", mealType);

        // Insert new plan with all options
        const { error } = await supabase.from("meal_plans").insert([
          {
            plan_date: date,
            meal_type: mealType,
            recipe_id: recipe.id,
            selected_variant: selection.selectedVariant,
            alternative_selections: selection.alternativeSelections,
            servings_multiplier: selection.servingsMultiplier,
          },
        ]);

        if (error) throw error;
      }
      
      setShowRecipeSelector(null);
      setShowRecipeOptions(null);
      loadData();
    } catch (error) {
      console.error("Error saving meal plan:", error);
    }
  };

  // Open edit modal for existing plan
  const openEditPlanOptions = (plan: MealPlan) => {
    if (!plan.recipe) return;
    
    setShowRecipeOptions({
      recipe: plan.recipe,
      date: plan.plan_date,
      mealType: plan.meal_type as MealType,
      existingPlanId: plan.id,
      initialSelection: {
        selectedVariant: (plan.selected_variant as 1 | 2) || 1,
        alternativeSelections: (plan.alternative_selections as Record<string, boolean>) || {},
        servingsMultiplier: plan.servings_multiplier || 1,
      },
    });
  };

  const removeMealPlan = async (planId: string) => {
    try {
      await supabase.from("meal_plans").delete().eq("id", planId);
      loadData();
    } catch (error) {
      console.error("Error removing meal plan:", error);
    }
  };

  const filteredRecipes = recipes.filter((recipe) => {
    // Filter by search text
    const matchesSearch = recipe.title.toLowerCase().includes(search.toLowerCase());
    
    // Filter by selected tags (recipe must have ALL selected tags)
    const matchesTags = selectedFilterTags.length === 0 || 
      selectedFilterTags.every(tag => recipe.tags?.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  const fetchSuggestions = useCallback(
    async (date: string, mealType: MealType) => {
      setLoadingSuggestions(true);
      try {
        const params = new URLSearchParams({
          date,
          meal_type: mealType,
          week_start: weekStart,
          week_end: weekEnd,
        });

        const response = await fetch(`/api/planner/suggestions?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setExcludedTags(data.excluded_tags || []);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [weekStart, weekEnd]
  );

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setAllTags(data.tags || []);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  }, []);

  const openRecipeSelector = (date: string, mealType: MealType) => {
    setShowRecipeSelector({ date, mealType });
    setSearch("");
    setSuggestions([]);
    setSelectedFilterTags([]);
    fetchSuggestions(date, mealType);
    fetchTags();
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedFilterTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

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
        title="Menús"
        rightAction={
          <Link
            href="/shopping"
            className="p-2 text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
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

      <main className="max-w-7xl mx-auto p-4 lg:px-8">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
              {weekDates[0].toLocaleDateString("es-ES", { month: "long", day: "numeric" })} -{" "}
              {weekDates[6].toLocaleDateString("es-ES", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-sm text-[var(--color-purple)] hover:underline"
              >
                Ir a la semana actual
              </button>
            )}
          </div>

          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors"
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
                <div className="h-8 bg-[var(--color-purple-bg-dark)] rounded mb-2" />
                <div className="space-y-2">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-16 bg-[var(--color-purple-bg-dark)] rounded" />
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
                      ? "bg-[var(--color-purple)] text-white"
                      : "bg-[var(--color-purple-bg-dark)]"
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
                            : "border-[var(--border-color)] hover:border-[var(--color-purple)]"
                        }`}
                      >
                        {plan && plan.recipe ? (
                          <div className="relative h-full group/plan">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMealPlan(plan.id);
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-70 sm:opacity-0 sm:group-hover/plan:opacity-100 hover:opacity-100 transition-opacity z-10"
                            >
                              ×
                            </button>
                            <button
                              onClick={() => openEditPlanOptions(plan)}
                              className="w-full h-full text-left"
                            >
                              <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">
                                {MEAL_LABELS[mealType]}
                              </span>
                              <p className="text-xs font-medium line-clamp-2 mt-1">
                                {plan.recipe.title}
                              </p>
                              {/* Show servings info if different from default */}
                              {plan.servings_multiplier && plan.servings_multiplier !== 1 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[10px] bg-[var(--color-purple)] text-white px-1.5 py-0.5 rounded-full">
                                    ×{plan.servings_multiplier}
                                  </span>
                                </div>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              openRecipeSelector(dateKey, mealType)
                            }
                            className="w-full h-full flex flex-col items-center justify-center text-[var(--color-slate-light)] hover:text-[var(--color-purple)]"
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
      {showRecipeSelector && !showRecipeOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] flex flex-col animate-fade-in">
            <div className="p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-semibold">
                  Añadir {MEAL_LABELS[showRecipeSelector.mealType]}
                </h3>
                <button
                  onClick={() => setShowRecipeSelector(null)}
                  className="p-1 text-[var(--color-slate-light)] hover:text-[var(--foreground)]"
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
                placeholder="Buscar recetas..."
                autoFocus
              />
              
              {/* Tag Filters */}
              {allTags.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-[var(--color-slate)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="text-xs font-medium text-[var(--color-slate)]">
                      Filtrar por etiquetas
                    </span>
                    {selectedFilterTags.length > 0 && (
                      <button
                        onClick={() => setSelectedFilterTags([])}
                        className="text-xs text-[var(--color-purple)] hover:underline ml-auto"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {allTags.map((tag) => {
                      const isSelected = selectedFilterTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTagFilter(tag)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-[var(--color-purple)] text-white"
                              : "bg-[var(--color-purple-bg)] text-[var(--color-slate)] hover:bg-[var(--color-purple-bg-dark)]"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {/* Smart Suggestions Section */}
              {!search && suggestions.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <svg className="w-4 h-4 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--color-purple)]">
                      Sugerencias para ti
                    </span>
                  </div>

                  {loadingSuggestions ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.recipe_id}
                          onClick={() => addMealPlan(suggestion.recipe_id)}
                          className="w-full text-left p-3 rounded-lg bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] transition-colors border border-[var(--color-purple)]/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[var(--foreground)] truncate">
                                {suggestion.title}
                              </p>
                              <p className="text-xs text-[var(--color-purple)] mt-0.5">
                                {suggestion.reason}
                              </p>
                            </div>
                            {suggestion.image_url && (
                              <img
                                src={suggestion.image_url}
                                alt=""
                                className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                              />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show excluded tags notice */}
                  {excludedTags.length > 0 && (
                    <div className="mt-2 px-2">
                      <p className="text-xs text-[var(--color-slate-light)]">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Ya tienes planeado esta semana:
                        </span>{" "}
                        {excludedTags.join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 border-t border-[var(--border-color)] pt-3">
                    <p className="text-xs text-[var(--color-slate-light)] px-2 mb-2">
                      Todas las recetas
                    </p>
                  </div>
                </div>
              )}

              {filteredRecipes.length > 0 ? (
                <div className="space-y-1">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => addMealPlan(recipe.id)}
                      className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-purple-bg-dark)] transition-colors"
                    >
                      <p className="font-medium text-[var(--foreground)]">
                        {recipe.title}
                      </p>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <p className="text-xs text-[var(--color-slate-light)] mt-1">
                          {recipe.tags.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-slate-light)]">
                  {recipes.length === 0 ? (
                    <>
                      <p>Aún no hay recetas</p>
                      <Link
                        href="/recipes/new"
                        className="text-[var(--color-purple)] hover:underline mt-2 inline-block"
                      >
                        Añade tu primera receta
                      </Link>
                    </>
                  ) : (
                    <p>Ninguna receta coincide con tu búsqueda</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recipe Options Modal (servings, variants, alternatives) */}
      {showRecipeOptions && (
        <RecipeOptionsModal
          isOpen={true}
          onClose={() => {
            setShowRecipeOptions(null);
            setShowRecipeSelector(null);
          }}
          recipe={showRecipeOptions.recipe}
          onConfirm={handleRecipeOptionsConfirm}
          initialSelection={showRecipeOptions.initialSelection}
        />
      )}

      <BottomNav />
    </div>
  );
}

