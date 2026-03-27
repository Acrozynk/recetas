"use client";

import { useState, useEffect } from "react";
import { supabase, type Recipe, type Ingredient } from "@/lib/supabase";
import {
  addCalendarDays,
  computeServingsMultiplierPersonas,
  getRecipePortionsBaseline,
  isPersonasPortionRecipe,
} from "@/lib/meal-plan-portions";

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
};

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  snack: "🍪",
  dinner: "🌙",
};

interface AddToPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  onSuccess?: () => void;
}

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

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function AddToPlannerModal({
  isOpen,
  onClose,
  recipe,
  onSuccess,
}: AddToPlannerModalProps) {
  const [step, setStep] = useState<"date" | "options">("date");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [saving, setSaving] = useState(false);

  // Options state
  const [selectedVariant, setSelectedVariant] = useState<1 | 2>(1);
  const [alternativeSelections, setAlternativeSelections] = useState<Record<string, boolean>>({});
  const [simpleServingsMultiplier, setSimpleServingsMultiplier] = useState(1);
  const [batchCount, setBatchCount] = useState(1);
  const [adultsPerBatch, setAdultsPerBatch] = useState(4);
  const [childrenPerBatch, setChildrenPerBatch] = useState(0);
  const [consecutiveDayCount, setConsecutiveDayCount] = useState(1);

  const weekDates = getWeekDates(weekOffset);
  const personasMode = isPersonasPortionRecipe(recipe);

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep("date");
    setSelectedDate(null);
    setSelectedMealType(null);
    setSelectedVariant(1);
    setAlternativeSelections({});
    setSimpleServingsMultiplier(1);
    setConsecutiveDayCount(1);
    setWeekOffset(0);
    if (personasMode) {
      const has =
        recipe.personas_batch_count != null &&
        recipe.personas_adults_per_batch != null &&
        recipe.personas_children_per_batch != null;
      if (has) {
        setBatchCount(Math.max(1, recipe.personas_batch_count!));
        setAdultsPerBatch(Math.max(0, recipe.personas_adults_per_batch!));
        setChildrenPerBatch(Math.max(0, recipe.personas_children_per_batch!));
      } else {
        setBatchCount(1);
        setAdultsPerBatch(Math.max(1, recipe.servings || 4));
        setChildrenPerBatch(0);
      }
    } else {
      setBatchCount(1);
      setAdultsPerBatch(Math.max(1, recipe.servings || 4));
      setChildrenPerBatch(0);
    }
  }, [isOpen, recipe.id, personasMode]);

  // Check what options this recipe has
  const hasVariants = !!(recipe.variant_1_label && recipe.variant_2_label);
  const ingredients = (recipe.ingredients || []) as Ingredient[];
  const ingredientsWithAlternatives = ingredients
    .map((ing, idx) => ({ ingredient: ing, index: idx }))
    .filter(({ ingredient }) => ingredient.alternative?.name && !ingredient.isHeader);

  const hasAlternatives = ingredientsWithAlternatives.length > 0;

  // Determine if recipe uses containers (for baking recipes)
  const usesContainer = !!recipe.container_id;
  
  // Get servings display based on recipe type
  // Priority: container > servings_unit > personas
  const getServingsUnit = () => {
    if (usesContainer) {
      // For container-based recipes, use variant label or container name
      if (recipe.variant_1_label) {
        return recipe.variant_1_label;
      }
      if (recipe.container?.name) {
        return recipe.container.name;
      }
      return "recipiente";
    }
    return recipe.servings_unit || "personas";
  };
  
  const usesUnits = !!recipe.servings_unit;
  const baseServings = usesContainer
    ? recipe.container_quantity || 1
    : usesUnits
      ? recipe.servings || 1
      : recipe.servings || 4;
  const servingsUnit = getServingsUnit();
  const servingsMultiplier = personasMode
    ? computeServingsMultiplierPersonas(recipe, batchCount, adultsPerBatch, childrenPerBatch)
    : simpleServingsMultiplier;
  const calculatedServings = Math.round(baseServings * servingsMultiplier * 10) / 10;
  const baseline = getRecipePortionsBaseline(recipe);
  const equivalentPerBatch = adultsPerBatch + childrenPerBatch * 0.5;

  // Get appropriate icon for servings unit
  const getServingsIcon = (unit: string) => {
    const unitLower = unit.toLowerCase();
    if (unitLower === "personas" || unitLower === "persona" || unitLower === "porciones" || unitLower === "porción") {
      return "👥";
    }
    if (unitLower === "recipiente" || unitLower === "recipientes" || unitLower === "molde" || unitLower === "moldes" ||
        unitLower.includes("molde") || unitLower.includes("bandeja") || unitLower.includes("fuente")) {
      return "🥧";
    }
    if (unitLower === "unidades" || unitLower === "unidad") {
      return "🔢";
    }
    if (unitLower.includes("tortita") || unitLower.includes("panqueque") || unitLower.includes("crepe")) {
      return "🥞";
    }
    if (unitLower.includes("galleta") || unitLower.includes("cookie")) {
      return "🍪";
    }
    if (unitLower.includes("muffin") || unitLower.includes("magdalena") || unitLower.includes("cupcake")) {
      return "🧁";
    }
    if (unitLower.includes("pan") || unitLower.includes("barra") || unitLower.includes("hogaza")) {
      return "🍞";
    }
    if (unitLower.includes("taza") || unitLower.includes("cup") || unitLower.includes("vaso")) {
      return "🥤";
    }
    if (unitLower.includes("ración") || unitLower.includes("racion")) {
      return "🍽️";
    }
    // Default icon for other units
    return "📊";
  };

  const servingsIcon = getServingsIcon(servingsUnit);

  const quickMultipliers = [0.5, 1, 2, 3, 4, 5, 8];
  const quickDayCounts = [1, 2, 3, 4, 5];

  const handleDateMealSelect = (date: string, mealType: MealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setStep("options");
  };

  const handleSave = async () => {
    if (!selectedDate || !selectedMealType) return;

    setSaving(true);
    try {
      const days = Math.min(14, Math.max(1, Math.floor(consecutiveDayCount)));
      const row = {
        meal_type: selectedMealType,
        recipe_id: recipe.id,
        selected_variant: selectedVariant,
        alternative_selections: alternativeSelections,
        servings_multiplier: servingsMultiplier,
      };

      for (let i = 0; i < days; i++) {
        const { error: deleteError } = await supabase
          .from("meal_plans")
          .delete()
          .eq("plan_date", addCalendarDays(selectedDate, i))
          .eq("meal_type", selectedMealType);
        if (deleteError) {
          console.error("Error deleting existing meal plan:", deleteError);
          throw deleteError;
        }
      }

      const rows = Array.from({ length: days }, (_, i) => ({
        ...row,
        plan_date: addCalendarDays(selectedDate, i),
      }));

      const { error: insertError } = await supabase.from("meal_plans").insert(rows);
      if (insertError) {
        console.error("Error inserting meal plan:", insertError);
        throw insertError;
      }

      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error adding meal plan:", error);
      const errorMessage = error instanceof Error ? error.message : 
        (typeof error === 'object' && error !== null && 'message' in error) 
          ? (error as { message: string }).message 
          : "Error desconocido";
      alert(`Error al añadir al planificador: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] sm:max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                {step === "date" ? "Añadir al menú" : "Opciones de la receta"}
              </h3>
              <p className="text-sm text-[var(--color-slate)] mt-1 truncate">
                {recipe.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === "date" ? (
            <div className="p-4">
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  className="p-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors rounded-lg hover:bg-[var(--color-purple-bg)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="text-center">
                  <h4 className="font-medium text-[var(--foreground)]">
                    {weekDates[0].toLocaleDateString("es-ES", { month: "short", day: "numeric" })} -{" "}
                    {weekDates[6].toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                  </h4>
                  {weekOffset !== 0 && (
                    <button
                      onClick={() => setWeekOffset(0)}
                      className="text-xs text-[var(--color-purple)] hover:underline"
                    >
                      Semana actual
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors rounded-lg hover:bg-[var(--color-purple-bg)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Days Grid */}
              <div className="space-y-3">
                {weekDates.map((date) => {
                  const dateKey = formatDateKey(date);
                  const today = isToday(date);
                  const dayName = date.toLocaleDateString("es-ES", { weekday: "long" });
                  const dayNumber = date.getDate();
                  const monthName = date.toLocaleDateString("es-ES", { month: "short" });

                  return (
                    <div
                      key={dateKey}
                      className={`rounded-xl border overflow-hidden ${
                        today
                          ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                          : "border-[var(--border-color)]"
                      }`}
                    >
                      {/* Day Header */}
                      <div className={`px-3 py-2 ${today ? "bg-[var(--color-purple)] text-white" : "bg-gray-50"}`}>
                        <span className="font-medium capitalize">{dayName}</span>
                        <span className="ml-2 opacity-80">{dayNumber} {monthName}</span>
                        {today && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">Hoy</span>}
                      </div>

                      {/* Meal Types */}
                      <div className="grid grid-cols-4 gap-1 p-2">
                        {MEAL_TYPES.map((mealType) => (
                          <button
                            key={mealType}
                            onClick={() => handleDateMealSelect(dateKey, mealType)}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-[var(--color-purple-bg)] transition-colors group"
                          >
                            <span className="text-lg group-hover:scale-110 transition-transform">
                              {MEAL_ICONS[mealType]}
                            </span>
                            <span className="text-[10px] text-[var(--color-slate)] group-hover:text-[var(--color-purple)]">
                              {MEAL_LABELS[mealType]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {/* Selected Date Info */}
              <div className="p-3 bg-[var(--color-purple-bg)] rounded-xl flex items-center gap-3">
                <span className="text-2xl">{selectedMealType ? MEAL_ICONS[selectedMealType] : ""}</span>
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {selectedMealType ? MEAL_LABELS[selectedMealType] : ""}
                  </p>
                  <p className="text-sm text-[var(--color-slate)]">
                    {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long"
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setStep("date")}
                  className="ml-auto text-sm text-[var(--color-purple)] hover:underline"
                >
                  Cambiar
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <span className="text-lg">{personasMode ? "👥" : servingsIcon}</span>
                  Porciones
                </h4>
                {personasMode ? (
                  <div className="bg-[var(--color-purple-bg)] rounded-xl p-4 space-y-4">
                    <p className="text-xs text-[var(--color-slate)]">
                      Lotes (veces que cocinas), adultos y niños por lote (½ ración). Igual que en la
                      ficha de la receta.
                    </p>
                    <div className="flex flex-col items-center p-3 bg-white/60 rounded-xl">
                      <span className="text-sm font-medium text-[var(--color-slate)] mb-2">
                        Lotes (cocina)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[var(--border-color)] text-lg"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={batchCount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1) setBatchCount(v);
                          }}
                          min={1}
                          className="w-14 text-center text-xl font-bold bg-white border border-[var(--border-color)] rounded-lg py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setBatchCount(batchCount + 1)}
                          className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] text-lg"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center p-3 bg-white/60 rounded-xl">
                        <span className="text-sm font-medium text-[var(--color-slate)] mb-2 text-center">
                          Adultos / lote
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdultsPerBatch(Math.max(0, adultsPerBatch - 1))}
                            disabled={adultsPerBatch === 0 && childrenPerBatch === 0}
                            className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={adultsPerBatch}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v >= 0) setAdultsPerBatch(v);
                            }}
                            min={0}
                            className="w-12 text-center text-lg font-bold text-[var(--color-purple)] bg-white border border-[var(--border-color)] rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setAdultsPerBatch(adultsPerBatch + 1)}
                            className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-amber-50/80 rounded-xl border border-amber-100">
                        <span className="text-sm font-medium text-[var(--color-slate)] mb-2 text-center">
                          Niños / lote <span className="text-amber-700">(½)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setChildrenPerBatch(Math.max(0, childrenPerBatch - 1))}
                            disabled={childrenPerBatch === 0}
                            className="w-8 h-8 rounded-full bg-white border border-amber-200 disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={childrenPerBatch}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v >= 0) setChildrenPerBatch(v);
                            }}
                            min={0}
                            className="w-12 text-center text-lg font-bold text-amber-700 bg-white border border-amber-200 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setChildrenPerBatch(childrenPerBatch + 1)}
                            className="w-8 h-8 rounded-full bg-white border border-amber-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-slate)] border-t border-[var(--border-color)] pt-3">
                      Total:{" "}
                      <strong className="text-[var(--color-purple)]">
                        {(batchCount * equivalentPerBatch) % 1 === 0
                          ? batchCount * equivalentPerBatch
                          : (batchCount * equivalentPerBatch).toLocaleString("es-ES", {
                              maximumFractionDigits: 1,
                            })}
                      </strong>{" "}
                      porciones (base receta {baseline.toLocaleString("es-ES", { maximumFractionDigits: 1 })} ≈ ×
                      {servingsMultiplier.toLocaleString("es-ES", { maximumFractionDigits: 2 })})
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--color-purple-bg)] rounded-xl p-4">
                    <div className="text-center mb-3">
                      <span className="text-3xl font-bold text-[var(--color-purple)]">
                        {calculatedServings}
                      </span>
                      <span className="text-[var(--color-slate)] ml-2">{servingsUnit}</span>
                      {simpleServingsMultiplier !== 1 && (
                        <span className="text-sm text-[var(--color-slate-light)] block mt-1">
                          (Original: {baseServings} {servingsUnit})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {quickMultipliers.map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setSimpleServingsMultiplier(mult)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            simpleServingsMultiplier === mult
                              ? "bg-[var(--color-purple)] text-white"
                              : "bg-white border border-[var(--border-color)] text-[var(--color-slate)]"
                          }`}
                        >
                          ×{mult}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSimpleServingsMultiplier(Math.max(0.25, simpleServingsMultiplier - 0.25))
                        }
                        className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <input
                        type="number"
                        value={simpleServingsMultiplier}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) setSimpleServingsMultiplier(val);
                        }}
                        step="0.25"
                        min="0.25"
                        className="w-20 text-center border border-[var(--border-color)] rounded-lg py-1 px-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSimpleServingsMultiplier(simpleServingsMultiplier + 0.25)
                        }
                        className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <span className="text-lg">📆</span>
                  Días consecutivos
                </h4>
                <div className="bg-[var(--color-purple-bg)] rounded-xl p-4 space-y-3">
                  <p className="text-xs text-[var(--color-slate)]">
                    Más de 1 día añade la misma receta en el mismo tipo de comida los días siguientes.
                  </p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {quickDayCounts.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setConsecutiveDayCount(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          consecutiveDayCount === d
                            ? "bg-[var(--color-purple)] text-white"
                            : "bg-white border border-[var(--border-color)]"
                        }`}
                      >
                        {d} día{d !== 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConsecutiveDayCount(Math.max(1, consecutiveDayCount - 1))}
                      className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)]"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={consecutiveDayCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 14) setConsecutiveDayCount(v);
                      }}
                      min={1}
                      max={14}
                      className="w-16 text-center border rounded-lg py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConsecutiveDayCount(Math.min(14, consecutiveDayCount + 1))
                      }
                      className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Variant Selection */}
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
                                onChange={() => setAlternativeSelections(prev => ({
                                  ...prev,
                                  [index.toString()]: true
                                }))}
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
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-[var(--border-color)] flex gap-3 pb-safe">
          {step === "options" && (
            <button
              onClick={() => setStep("date")}
              className="flex-1 btn-secondary"
            >
              Atrás
            </button>
          )}
          <button
            onClick={step === "date" ? onClose : handleSave}
            disabled={step === "options" && saving}
            className={`flex-1 ${step === "date" ? "btn-secondary" : "btn-primary"} flex items-center justify-center gap-2`}
          >
            {step === "date" ? (
              "Cancelar"
            ) : saving ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Añadir al menú
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}



