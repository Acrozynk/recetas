"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  supabase,
  type Recipe,
  type MealPlan,
  RECIPE_LIST_SELECT,
  MEAL_PLAN_CELL_RECIPE_SELECT,
} from "@/lib/supabase";
import { recipeTextMatchesQuery } from "@/lib/recipe-search";
import { addCalendarDays } from "@/lib/meal-plan-portions";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type MealType,
  type VariantSelection,
} from "@/lib/meal-plan-types";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import TodayMealsBanner from "@/components/TodayMealsBanner";
import Link from "next/link";

// Heavy modal: only ship its JS when the user actually opens it.
const RecipeOptionsModal = dynamic(
  () => import("@/components/RecipeOptionsModal"),
  { ssr: false, loading: () => null }
);


interface Suggestion {
  recipe_id: string;
  title: string;
  tags: string[];
  image_url: string | null;
  times_planned: number;
  days_since_last: number | null;
  reason: string;
}

function getWeekDates(offset: number = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  // getDay() returns 0 for Sunday, but we want Sunday to be day 7
  // so that the week starts on Monday
  const dayOfWeek = today.getDay() || 7;
  monday.setDate(today.getDate() - dayOfWeek + 1 + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Supabase returns PostgrestError objects which are NOT instances of Error.
// This helper extracts a useful message + code for user-facing alerts and logging.
function describeSupabaseError(error: unknown): { message: string; code: string | null } {
  if (!error) return { message: "Error desconocido", code: null };
  if (typeof error === "string") return { message: error, code: null };
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const msg =
      (typeof e.message === "string" && e.message) ||
      (typeof e.details === "string" && e.details) ||
      (typeof e.hint === "string" && e.hint) ||
      JSON.stringify(error);
    const code = typeof e.code === "string" ? e.code : null;
    return { message: msg || "Error desconocido", code };
  }
  return { message: String(error), code: null };
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
  // Drag and drop state
  const [draggingPlan, setDraggingPlan] = useState<MealPlan | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; mealType: MealType } | null>(null);
  
  // Touch drag state for mobile
  const [touchDragging, setTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const draggingPlanRef = useRef<MealPlan | null>(null);
  const dragOverSlotRef = useRef<{ date: string; mealType: MealType } | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Horizontal-scroll container for the *current* week's grid. Used to snap
  // today's column into view on narrow screens (the grid has a 640px min-width
  // so it overflows on mobile).
  const currentWeekScrollRef = useRef<HTMLDivElement | null>(null);
  const todayScrolledRef = useRef(false);

  const weekDates = getWeekDates(weekOffset);
  const weekDatesNext = getWeekDates(weekOffset + 1);
  const weekStart = formatDateKey(weekDates[0]);
  const weekEnd = formatDateKey(weekDates[6]);
  // Wider screens render the next week too; load enough data to cover both.
  const loadEnd = formatDateKey(weekDatesNext[6]);

  const loadData = useCallback(async () => {
    try {
      // Load recipes (omits the heavy `instructions` JSON column)
      const { data: recipesData } = await supabase
        .from("recipes")
        .select(RECIPE_LIST_SELECT)
        .order("title");

      // Load meal plans for the visible window (current week + next week).
      // Embedded recipe is intentionally tiny (id/title/image_url): cells
      // never need more, and edit-time data is looked up from `recipesData`.
      const { data: plansData } = await supabase
        .from("meal_plans")
        .select(`*, recipe:recipes(${MEAL_PLAN_CELL_RECIPE_SELECT})`)
        .gte("plan_date", weekStart)
        .lte("plan_date", loadEnd);

      setRecipes((recipesData ?? []) as unknown as Recipe[]);
      setMealPlans((plansData ?? []) as unknown as MealPlan[]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart, loadEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset the "already scrolled to today" guard whenever the user changes week.
  useEffect(() => {
    todayScrolledRef.current = false;
  }, [weekOffset]);

  // Snap the horizontal grid to today's column on narrow screens.
  // Only fires for the current week and only the first time the grid renders
  // for that week, so manual scrolling by the user isn't overridden.
  useLayoutEffect(() => {
    if (loading) return;
    if (weekOffset !== 0) return;
    if (todayScrolledRef.current) return;

    const container = currentWeekScrollRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;

    const todayEl = container.querySelector<HTMLElement>('[data-today="true"]');
    if (!todayEl) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = todayEl.getBoundingClientRect();
    const offsetLeft =
      targetRect.left - containerRect.left + container.scrollLeft;
    // Leave a small left margin so today's column isn't flush against the edge.
    container.scrollLeft = Math.max(0, offsetLeft - 8);
    todayScrolledRef.current = true;
  }, [loading, weekOffset]);

  const getMealPlans = (date: string, mealType: MealType): MealPlan[] => {
    return mealPlans.filter(
      (mp) => mp.plan_date === date && mp.meal_type === mealType
    );
  };

  // Free-text note editor state
  const [noteEditor, setNoteEditor] = useState<{
    planId?: string;
    date: string;
    mealType: MealType;
    text: string;
  } | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const openNoteEditor = (
    date: string,
    mealType: MealType,
    plan?: MealPlan
  ) => {
    setNoteEditor({
      planId: plan?.id,
      date,
      mealType,
      text: plan?.note ?? "",
    });
  };

  const closeNoteEditor = () => setNoteEditor(null);

  const saveNote = async () => {
    if (!noteEditor) return;
    const text = noteEditor.text.trim();
    if (!text) {
      closeNoteEditor();
      return;
    }
    setSavingNote(true);
    try {
      if (noteEditor.planId) {
        const { error } = await supabase
          .from("meal_plans")
          .update({
            note: text,
            plan_date: noteEditor.date,
            meal_type: noteEditor.mealType,
          })
          .eq("id", noteEditor.planId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_plans").insert([
          {
            plan_date: noteEditor.date,
            meal_type: noteEditor.mealType,
            recipe_id: null,
            note: text,
            selected_variant: 1,
            alternative_selections: {},
            servings_multiplier: 1,
          },
        ]);
        if (error) throw error;
      }
      closeNoteEditor();
      loadData();
    } catch (error) {
      console.error("Error saving note:", error);
      const { message, code } = describeSupabaseError(error);
      const looksLikeMigrationMissing =
        /column .*note/i.test(message) ||
        /recipe_id/i.test(message) ||
        /null value in column/i.test(message) ||
        code === "23502" ||
        code === "42703";
      alert(
        looksLikeMigrationMissing
          ? `No se pudo guardar la nota.\n\nAplica la migración 021_meal_plans_notes.sql en Supabase (SQL Editor) y vuelve a intentarlo.\n\nDetalle: ${message}`
          : `No se pudo guardar la nota: ${message}`
      );
    } finally {
      setSavingNote(false);
    }
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
      // Add a new plan to the slot. Multiple plans per (date, meal_type) are allowed.
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
    const targetDate = selection.newDate || date;
    const targetMealType = selection.newMealType || mealType;
    
    try {
      const days = Math.min(
        14,
        Math.max(1, Math.floor(selection.consecutiveDayCount || 1))
      );

      if (existingPlanId) {
        // Update the edited plan in place. If we're moving to a different slot,
        // any existing plans there are kept — multiple recipes can coexist now.
        const { error } = await supabase
          .from("meal_plans")
          .update({
            selected_variant: selection.selectedVariant,
            alternative_selections: selection.alternativeSelections,
            servings_multiplier: selection.servingsMultiplier,
            plan_date: targetDate,
            meal_type: targetMealType,
          })
          .eq("id", existingPlanId);

        if (error) throw error;

        if (days > 1) {
          const extraRows = Array.from({ length: days - 1 }, (_, i) => ({
            plan_date: addCalendarDays(targetDate, i + 1),
            meal_type: targetMealType,
            recipe_id: recipe.id,
            selected_variant: selection.selectedVariant,
            alternative_selections: selection.alternativeSelections,
            servings_multiplier: selection.servingsMultiplier,
          }));

          if (extraRows.length > 0) {
            const { error: insertError } = await supabase
              .from("meal_plans")
              .insert(extraRows);
            if (insertError) throw insertError;
          }
        }
      } else {
        const rows = Array.from({ length: days }, (_, i) => ({
          plan_date: addCalendarDays(date, i),
          meal_type: mealType,
          recipe_id: recipe.id,
          selected_variant: selection.selectedVariant,
          alternative_selections: selection.alternativeSelections,
          servings_multiplier: selection.servingsMultiplier,
        }));

        const { error } = await supabase.from("meal_plans").insert(rows);
        if (error) throw error;
      }
      
      setShowRecipeSelector(null);
      setShowRecipeOptions(null);
      loadData();
    } catch (error) {
      console.error("Error saving meal plan:", error);
      const { message, code } = describeSupabaseError(error);
      const looksLikeUnique =
        /unique|duplicate|conflict/i.test(message) || code === "23505";
      alert(
        looksLikeUnique
          ? `No se pudo guardar porque la base de datos sigue exigiendo una receta única por hueco. Aplica la migración 020_meal_plans_allow_multiple.sql en Supabase y vuelve a intentarlo.\n\nDetalle: ${message}`
          : `No se pudo guardar el menú: ${message}`
      );
    }
  };

  // Open edit modal for existing plan
  const openEditPlanOptions = (plan: MealPlan) => {
    if (!plan.recipe || !plan.recipe_id) return;

    // The embedded `plan.recipe` only carries id/title/image_url; the modal
    // needs the full recipe (ingredients, container, variant labels…). Look it
    // up from the already-loaded recipes array.
    const fullRecipe = recipes.find((r) => r.id === plan.recipe_id) ?? plan.recipe;

    setShowRecipeOptions({
      recipe: fullRecipe,
      date: plan.plan_date,
      mealType: plan.meal_type as MealType,
      existingPlanId: plan.id,
      initialSelection: {
        selectedVariant: (plan.selected_variant as 1 | 2) || 1,
        alternativeSelections: (plan.alternative_selections as Record<string, boolean>) || {},
        servingsMultiplier: plan.servings_multiplier || 1,
        consecutiveDayCount: 1,
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

  // Drag and drop handlers
  useEffect(() => {
    draggingPlanRef.current = draggingPlan;
  }, [draggingPlan]);

  useEffect(() => {
    dragOverSlotRef.current = dragOverSlot;
  }, [dragOverSlot]);

  const getSlotKey = (date: string, mealType: MealType) => `${date}-${mealType}`;

  const findSlotUnderTouch = (x: number, y: number): { date: string; mealType: MealType } | null => {
    for (const [key, element] of slotRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const [date, mealType] = key.split(/-(?=[^-]+$)/);
        return { date, mealType: mealType as MealType };
      }
    }
    return null;
  };

  const removeDragGhost = () => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  };

  const createDragGhost = (plan: MealPlan, x: number, y: number) => {
    removeDragGhost();
    const ghost = document.createElement("div");
    ghost.className =
      "fixed pointer-events-none z-[100] bg-white rounded-lg shadow-xl border-2 border-[var(--color-purple)] p-2 opacity-90 max-w-[140px]";
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.style.transform = "translate(-50%, -50%)";
    const label = document.createElement("p");
    label.className = "text-xs font-medium line-clamp-2";
    label.textContent = plan.recipe?.title || plan.note || "Nota";
    ghost.appendChild(label);
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
  };

  const movePlanToSlot = async (
    plan: MealPlan,
    targetDate: string,
    targetMealType: MealType
  ) => {
    if (plan.plan_date === targetDate && plan.meal_type === targetMealType) return;

    try {
      await supabase
        .from("meal_plans")
        .update({
          plan_date: targetDate,
          meal_type: targetMealType,
        })
        .eq("id", plan.id);

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      loadData();
    } catch (error) {
      console.error("Error moving meal plan:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, plan: MealPlan) => {
    setDraggingPlan(plan);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", plan.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingPlan(null);
    setDragOverSlot(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, date: string, mealType: MealType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ date, mealType });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string, targetMealType: MealType) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggingPlan) return;

    await movePlanToSlot(draggingPlan, targetDate, targetMealType);
    setDraggingPlan(null);
  };

  const handleTouchStart = (e: React.TouchEvent, plan: MealPlan) => {
    if ((e.target as HTMLElement).closest("[data-plan-action]")) return;

    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    const timer = setTimeout(() => {
      setDraggingPlan(plan);
      setTouchDragging(true);
      createDragGhost(plan, touch.clientX, touch.clientY);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 200);

    (e.currentTarget as HTMLElement).dataset.touchTimer = String(timer);
  };

  const handleTouchEndCleanup = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const timer = el.dataset.touchTimer;
    if (timer) {
      clearTimeout(Number(timer));
      delete el.dataset.touchTimer;
    }
  };

  useEffect(() => {
    if (!touchDragging) return;

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;

      if (dragGhostRef.current) {
        dragGhostRef.current.style.left = `${touch.clientX}px`;
        dragGhostRef.current.style.top = `${touch.clientY}px`;
      }

      setDragOverSlot(findSlotUnderTouch(touch.clientX, touch.clientY));
    };

    const onEnd = async () => {
      const plan = draggingPlanRef.current;
      const targetSlot = dragOverSlotRef.current;

      removeDragGhost();
      setTouchDragging(false);
      setDragOverSlot(null);
      setDraggingPlan(null);
      touchStartPos.current = null;

      if (!plan || !targetSlot) return;
      await movePlanToSlot(plan, targetSlot.date, targetSlot.mealType);
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);

    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [touchDragging, loadData]);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipeTextMatchesQuery(
      {
        title: recipe.title,
        description: recipe.description,
        tags: recipe.tags,
      },
      search
    );

    const matchesTags =
      selectedFilterTags.length === 0 ||
      selectedFilterTags.every((tag) => recipe.tags?.includes(tag));

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

  const renderWeekGrid = (
    dates: Date[],
    scrollRef?: React.RefObject<HTMLDivElement | null>
  ) => (
    <div ref={scrollRef} className="overflow-x-auto -mx-4 px-4">
      <div className="grid grid-cols-7 gap-2 min-w-[640px]">
        {/* Day Headers */}
        {dates.map((date) => (
          <div
            key={date.toISOString()}
            data-today={isToday(date) ? "true" : undefined}
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
          <React.Fragment key={mealType}>
            {dates.map((date) => {
              const dateKey = formatDateKey(date);
              const slotItems = getMealPlans(dateKey, mealType).filter(
                (p) => p.recipe || p.note
              );

              const isDragOver =
                dragOverSlot?.date === dateKey && dragOverSlot?.mealType === mealType;
              const isDraggingThis =
                draggingPlan?.plan_date === dateKey && draggingPlan?.meal_type === mealType;
              const slotKey = getSlotKey(dateKey, mealType);
              const compact = slotItems.length > 1;

              return (
                <div
                  key={slotKey}
                  ref={(el) => {
                    if (el) slotRefs.current.set(slotKey, el);
                  }}
                  className={`min-h-[100px] rounded-lg border-2 p-2 transition-all flex flex-col gap-1.5 ${
                    slotItems.length > 0
                      ? `meal-${mealType} border-solid`
                      : "border-dashed border-[var(--border-color)] hover:border-[var(--color-purple)]"
                  } ${
                    isDragOver
                      ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)] scale-[1.02]"
                      : ""
                  } ${isDraggingThis ? "opacity-90" : ""}`}
                  onDragOver={(e) => handleDragOver(e, dateKey, mealType)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateKey, mealType)}
                >
                  {slotItems.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <button
                        onClick={() => openRecipeSelector(dateKey, mealType)}
                        className="flex flex-col items-center text-[var(--color-slate-light)] hover:text-[var(--color-purple)]"
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
                        <span className="text-[10px] mt-1">{MEAL_LABELS[mealType]}</span>
                      </button>
                      <button
                        onClick={() => openNoteEditor(dateKey, mealType)}
                        className="text-[10px] text-[var(--color-slate-light)] hover:text-amber-700 flex items-center gap-1"
                        title="Añadir una nota (p. ej. cumpleaños)"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Nota
                      </button>
                    </div>
                  ) : (
                    <>
                      {slotItems.map((plan) => {
                        const isThisDragging = draggingPlan?.id === plan.id;
                        const isNote = !plan.recipe && !!plan.note;

                        if (isNote) {
                          return (
                            <div
                              key={plan.id}
                              className={`relative group/plan rounded-md bg-amber-100 border border-amber-300 p-1.5 ${
                                isThisDragging ? "opacity-50" : ""
                              } cursor-grab active:cursor-grabbing touch-none select-none`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, plan)}
                              onDragEnd={handleDragEnd}
                              onTouchStart={(e) => handleTouchStart(e, plan)}
                              onTouchEnd={handleTouchEndCleanup}
                            >
                              <button
                                type="button"
                                data-plan-action
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMealPlan(plan.id);
                                }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-70 sm:opacity-0 sm:group-hover/plan:opacity-100 hover:opacity-100 transition-opacity z-10"
                              >
                                ×
                              </button>
                              <button
                                type="button"
                                data-plan-action
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  openNoteEditor(dateKey, mealType, plan);
                                }}
                                className="absolute -top-1 left-0 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs opacity-70 sm:opacity-0 sm:group-hover/plan:opacity-100 hover:opacity-100 transition-opacity z-10"
                                title="Editar nota"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <div className="w-full text-left flex items-start gap-1.5 pr-4">
                                <span className="text-base leading-none shrink-0">📝</span>
                                <p
                                  className={`font-medium leading-tight whitespace-pre-wrap select-none ${
                                    compact
                                      ? "text-[11px] line-clamp-2"
                                      : "text-xs line-clamp-4"
                                  } text-amber-900`}
                                >
                                  {plan.note}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={plan.id}
                            className={`relative group/plan cursor-grab active:cursor-grabbing touch-none rounded-md ${
                              compact ? "bg-white/40" : ""
                            } ${isThisDragging ? "opacity-50" : ""}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, plan)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, plan)}
                            onTouchEnd={handleTouchEndCleanup}
                          >
                            <button
                              type="button"
                              data-plan-action
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMealPlan(plan.id);
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-70 sm:opacity-0 sm:group-hover/plan:opacity-100 hover:opacity-100 transition-opacity z-10"
                            >
                              ×
                            </button>
                            <button
                              type="button"
                              data-plan-action
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                openEditPlanOptions(plan);
                              }}
                              className="absolute -top-1 left-0 w-5 h-5 bg-[var(--color-purple)] text-white rounded-full flex items-center justify-center text-xs opacity-70 sm:opacity-0 sm:group-hover/plan:opacity-100 hover:opacity-100 transition-opacity z-10"
                              title="Editar porciones"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {compact ? (
                              <Link
                                href={`/recipes/${plan.recipe!.id}`}
                                className="flex items-center gap-2 p-1"
                              >
                                {plan.recipe!.image_url ? (
                                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/40">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={plan.recipe!.image_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded bg-white/40 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium leading-tight line-clamp-2">
                                    {plan.recipe!.title}
                                  </p>
                                </div>
                              </Link>
                            ) : (
                              <Link
                                href={`/recipes/${plan.recipe!.id}`}
                                className="w-full h-full text-left flex flex-col"
                              >
                                {plan.recipe!.image_url && (
                                  <div className="w-full aspect-[4/3] rounded-md overflow-hidden mb-1.5 flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={plan.recipe!.image_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">
                                  {MEAL_LABELS[mealType]}
                                </span>
                                <p className="text-xs font-medium line-clamp-2 mt-0.5">
                                  {plan.recipe!.title}
                                </p>
                              </Link>
                            )}
                          </div>
                        );
                      })}
                      <div className="mt-auto self-stretch flex flex-col sm:flex-row sm:justify-center sm:flex-wrap gap-1">
                        <button
                          onClick={() => openRecipeSelector(dateKey, mealType)}
                          className="text-[10px] flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-white/60 text-[var(--color-slate)] hover:bg-white hover:text-[var(--color-purple)] transition-colors min-w-0"
                          title="Añadir otra receta"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          <span className="truncate">Receta</span>
                        </button>
                        <button
                          onClick={() => openNoteEditor(dateKey, mealType)}
                          className="text-[10px] flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-white/60 text-[var(--color-slate)] hover:bg-white hover:text-amber-700 transition-colors min-w-0"
                          title="Añadir una nota"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="truncate">Nota</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

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
        <TodayMealsBanner />

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
          <>
            {renderWeekGrid(weekDates, currentWeekScrollRef)}

            {/* Next week below on wider screens */}
            <div className="hidden lg:block mt-8">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Próxima semana
                </h3>
                <span className="text-sm text-[var(--color-slate)]">
                  {weekDatesNext[0].toLocaleDateString("es-ES", { month: "long", day: "numeric" })}
                  {" – "}
                  {weekDatesNext[6].toLocaleDateString("es-ES", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {renderWeekGrid(weekDatesNext)}
            </div>
          </>
        )}

      </main>

      {/* Recipe Selector Modal */}
      {showRecipeSelector && !showRecipeOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[70vh] sm:max-h-[80vh] flex flex-col animate-fade-in">
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
                      className="w-full text-left p-3 rounded-lg hover:bg-[var(--color-purple-bg-dark)] transition-colors flex items-center gap-3"
                    >
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[var(--color-purple-bg)] flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-[var(--color-slate-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--foreground)] truncate">
                          {recipe.title}
                        </p>
                        {recipe.tags && recipe.tags.length > 0 && (
                          <p className="text-xs text-[var(--color-slate-light)] mt-0.5 truncate">
                            {recipe.tags.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </div>
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
          currentDate={showRecipeOptions.date}
          currentMealType={showRecipeOptions.mealType}
          weekDates={weekDates}
          isEditing={!!showRecipeOptions.existingPlanId}
        />
      )}

      {/* Free-text note editor */}
      {noteEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md flex flex-col animate-fade-in">
            <div className="flex-shrink-0 p-4 border-b border-[var(--border-color)] bg-amber-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <span>📝</span>
                    {noteEditor.planId ? "Editar nota" : "Añadir nota"}
                  </h3>
                  <p className="text-sm text-[var(--color-slate)] mt-1">
                    {new Date(noteEditor.date + "T00:00:00").toLocaleDateString(
                      "es-ES",
                      { weekday: "long", day: "numeric", month: "long" }
                    )}{" "}
                    · {MEAL_LABELS[noteEditor.mealType]}
                  </p>
                </div>
                <button
                  onClick={closeNoteEditor}
                  className="p-2 hover:bg-white/50 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium text-[var(--color-slate)]">
                Texto libre
              </label>
              <textarea
                value={noteEditor.text}
                onChange={(e) =>
                  setNoteEditor((prev) =>
                    prev ? { ...prev, text: e.target.value } : prev
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveNote();
                  }
                }}
                placeholder="Cumpleaños, fuera de casa, sobras…"
                rows={3}
                autoFocus
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-y"
              />
              <p className="text-[11px] text-[var(--color-slate-light)]">
                Las notas no añaden ingredientes a la lista de la compra.
              </p>
            </div>
            <div className="flex-shrink-0 p-4 pt-2 border-t border-[var(--border-color)] flex gap-2">
              {noteEditor.planId && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!noteEditor.planId) return;
                    await removeMealPlan(noteEditor.planId);
                    closeNoteEditor();
                  }}
                  className="px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={closeNoteEditor}
                className="ml-auto px-4 py-2.5 rounded-lg bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={savingNote || !noteEditor.text.trim()}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {savingNote ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

