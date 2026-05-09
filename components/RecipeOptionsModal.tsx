"use client";

import React, { useEffect, useState } from "react";
import type { Recipe, Ingredient } from "@/lib/supabase";
import {
  computeServingsMultiplierPersonas,
  getRecipeDefaultPersonas,
  getRecipePortionsBaseline,
  inferPersonasStateFromMultiplier,
  isPersonasPortionRecipe,
} from "@/lib/meal-plan-portions";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type MealType,
  type VariantSelection,
} from "@/lib/meal-plan-types";

export type { VariantSelection };

export default function RecipeOptionsModal({
  isOpen,
  onClose,
  recipe,
  onConfirm,
  initialSelection,
  currentDate,
  currentMealType,
  isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  onConfirm: (selection: VariantSelection) => void;
  initialSelection?: VariantSelection;
  currentDate?: string;
  currentMealType?: MealType;
  weekDates?: Date[];
  isEditing?: boolean;
}) {
  const [selectedVariant, setSelectedVariant] = useState<1 | 2>(initialSelection?.selectedVariant ?? 1);
  const [alternativeSelections, setAlternativeSelections] = useState<Record<string, boolean>>(initialSelection?.alternativeSelections ?? {});
  const [simpleServingsMultiplier, setSimpleServingsMultiplier] = useState(initialSelection?.servingsMultiplier ?? 1);
  const [adultsPerBatch, setAdultsPerBatch] = useState(4);
  const [childrenPerBatch, setChildrenPerBatch] = useState(0);
  const [consecutiveDayCount, setConsecutiveDayCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>(currentDate ?? "");
  const [selectedMealType, setSelectedMealType] = useState<MealType>(currentMealType ?? "lunch");
  const [modalWeekOffset, setModalWeekOffset] = useState(0);

  const getModalWeekDates = (offset: number): Date[] => {
    const baseDate = currentDate ? new Date(currentDate) : new Date();
    const monday = new Date(baseDate);
    const dayOfWeek = baseDate.getDay() || 7;
    monday.setDate(baseDate.getDate() - dayOfWeek + 1 + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  };

  const modalWeekDates = getModalWeekDates(modalWeekOffset);

  const personasMode = isPersonasPortionRecipe(recipe);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedVariant(initialSelection?.selectedVariant ?? 1);
    setAlternativeSelections(initialSelection?.alternativeSelections ?? {});
    setSelectedDate(currentDate ?? "");
    setSelectedMealType(currentMealType ?? "lunch");
    setModalWeekOffset(0);
    setConsecutiveDayCount(1);

    if (personasMode) {
      if (isEditing && initialSelection?.servingsMultiplier != null) {
        const inferred = inferPersonasStateFromMultiplier(
          recipe,
          initialSelection.servingsMultiplier
        );
        setAdultsPerBatch(inferred.adultsPerBatch);
        setChildrenPerBatch(inferred.childrenPerBatch);
      } else {
        const defaults = getRecipeDefaultPersonas(recipe);
        setAdultsPerBatch(defaults.adults);
        setChildrenPerBatch(defaults.children);
      }
      setSimpleServingsMultiplier(1);
    } else {
      setSimpleServingsMultiplier(initialSelection?.servingsMultiplier ?? 1);
      setAdultsPerBatch(Math.max(1, recipe.servings || 4));
      setChildrenPerBatch(0);
    }
  }, [
    isOpen,
    recipe.id,
    personasMode,
    isEditing,
    initialSelection?.selectedVariant,
    initialSelection?.alternativeSelections,
    initialSelection?.servingsMultiplier,
    currentDate,
    currentMealType,
  ]);

  const hasVariants = !!(recipe.variant_1_label && recipe.variant_2_label);
  const ingredients = (recipe.ingredients ?? []) as Ingredient[];
  const ingredientsWithAlternatives = ingredients
    .map((ing, idx) => ({ ingredient: ing, index: idx }))
    .filter(({ ingredient }) => ingredient.alternative?.name && !ingredient.isHeader);

  const hasAlternatives = ingredientsWithAlternatives.length > 0;

  const usesContainer = !!recipe.container_id;
  const usesUnits = !!recipe.servings_unit;
  const baseServings = usesContainer
    ? recipe.container_quantity || 1
    : usesUnits
      ? recipe.servings || 1
      : recipe.servings || 4;
  const servingsUnit = usesContainer
    ? recipe.container?.name || "recipiente"
    : recipe.servings_unit || "personas";

  const servingsMultiplier = personasMode
    ? computeServingsMultiplierPersonas(recipe, adultsPerBatch, childrenPerBatch)
    : simpleServingsMultiplier;

  const calculatedServings = Math.round(baseServings * servingsMultiplier * 10) / 10;
  const baseline = getRecipePortionsBaseline(recipe);
  const totalPortions = adultsPerBatch + childrenPerBatch * 0.5;

  const toggleAlternative = (index: number) => {
    setAlternativeSelections(prev => ({
      ...prev,
      [index.toString()]: !prev[index.toString()]
    }));
  };

  const handleConfirm = async () => {
    const dateChanged = isEditing && selectedDate !== currentDate;
    const mealTypeChanged = isEditing && selectedMealType !== currentMealType;

    await onConfirm({
      selectedVariant,
      alternativeSelections,
      servingsMultiplier,
      consecutiveDayCount: Math.min(14, Math.max(1, consecutiveDayCount)),
      newDate: dateChanged ? selectedDate : undefined,
      newMealType: (dateChanged || mealTypeChanged) ? selectedMealType : undefined,
    });
    onClose();
  };

  const quickMultipliers = [0.5, 1, 2, 3, 4, 5, 8];
  const quickDayCounts = [1, 2, 3, 4, 5];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] sm:max-h-[85vh] flex flex-col animate-fade-in">
        <div className="flex-shrink-0 p-4 border-b border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                {isEditing ? "Editar Menú" : "Opciones de la receta"}
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

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
              <span className="text-lg">👥</span>
              Porciones
            </h4>
            {personasMode ? (
              <div className="bg-[var(--color-purple-bg)] rounded-xl p-4 space-y-4">
                <p className="text-xs text-[var(--color-slate)]">
                  Adultos y niños (½ ración). Para cocinar más, usa <strong>días consecutivos</strong>
                  abajo. Los ingredientes escalan con <strong>(adultos + ½ niños)</strong> respecto a
                  la receta.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center p-3 bg-white/60 rounded-xl">
                    <span className="text-sm font-medium text-[var(--color-slate)] mb-2 text-center">
                      Adultos
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAdultsPerBatch(
                            Math.max(0, adultsPerBatch - 1)
                          )
                        }
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
                        className="w-12 text-center text-lg font-bold text-[var(--color-purple)] bg-white border border-[var(--border-color)] rounded-lg py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                      Niños <span className="text-amber-700">(½)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setChildrenPerBatch(Math.max(0, childrenPerBatch - 1))
                        }
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
                        className="w-12 text-center text-lg font-bold text-amber-700 bg-white border border-amber-200 rounded-lg py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  <p>
                    Total:{" "}
                    <strong className="text-[var(--color-purple)]">
                      {totalPortions % 1 === 0
                        ? totalPortions
                        : totalPortions.toLocaleString("es-ES", {
                            maximumFractionDigits: 1,
                          })}
                    </strong>{" "}
                    porciones ({adultsPerBatch} adulto{adultsPerBatch !== 1 ? "s" : ""}
                    {childrenPerBatch > 0
                      ? ` + ${childrenPerBatch} niño${childrenPerBatch !== 1 ? "s" : ""}`
                      : ""}
                    ; base receta {baseline.toLocaleString("es-ES", { maximumFractionDigits: 1 })}{" "}
                    ≈ ×{servingsMultiplier.toLocaleString("es-ES", { maximumFractionDigits: 2 })})
                  </p>
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
                          : "bg-white border border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple)]"
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
                      setSimpleServingsMultiplier(
                        Math.max(0.25, simpleServingsMultiplier - 0.25)
                      )
                    }
                    className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center"
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
                    className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center"
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
                {isEditing
                  ? "Si eliges más de 1 día, la receta también se añade los días siguientes (en el mismo tipo de comida), conservando lo que ya hubiera planificado."
                  : "Si eliges más de 1 día, se añade la misma receta en el mismo tipo de comida los días siguientes (p. ej. 3 días → lunes, martes y miércoles), conservando lo que ya hubiera."}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {quickDayCounts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setConsecutiveDayCount(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      consecutiveDayCount === d
                        ? "bg-[var(--color-purple)] text-white"
                        : "bg-white border border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple)]"
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
                  className="w-16 text-center border border-[var(--border-color)] rounded-lg py-1 text-sm"
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

          {isEditing && (
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <span className="text-lg">📅</span>
                Cambiar día
              </h4>
              <div className="bg-[var(--color-purple-bg)] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setModalWeekOffset(modalWeekOffset - 1)}
                    className="p-1.5 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {modalWeekDates[0].toLocaleDateString("es-ES", { month: "short", day: "numeric" })} - {modalWeekDates[6].toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                  </div>
                  <button
                    onClick={() => setModalWeekOffset(modalWeekOffset + 1)}
                    className="p-1.5 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div>
                  <div className="grid grid-cols-7 gap-1">
                    {modalWeekDates.map((date) => {
                      const dateKey = date.toISOString().split("T")[0];
                      const isSelected = selectedDate === dateKey;
                      const dayName = date.toLocaleDateString("es-ES", { weekday: "short" });
                      const dayNum = date.getDate();
                      const isToday = new Date().toDateString() === date.toDateString();
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setSelectedDate(dateKey)}
                          className={`p-2 rounded-lg text-center transition-all ${
                            isSelected
                              ? "bg-[var(--color-purple)] text-white"
                              : isToday
                                ? "bg-white border-2 border-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)]"
                                : "bg-white border border-[var(--border-color)] hover:border-[var(--color-purple)]"
                          }`}
                        >
                          <div className="text-[10px] uppercase opacity-70">{dayName}</div>
                          <div className="text-sm font-semibold">{dayNum}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--color-slate)] mb-2 block">Comida</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((mealType) => {
                      const isSelected = selectedMealType === mealType;
                      return (
                        <button
                          key={mealType}
                          onClick={() => setSelectedMealType(mealType)}
                          className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-[var(--color-purple)] text-white"
                              : "bg-white border border-[var(--border-color)] hover:border-[var(--color-purple)]"
                          }`}
                        >
                          {MEAL_LABELS[mealType]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

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

        <div className="flex-shrink-0 p-4 border-t border-[var(--border-color)] flex gap-3 pb-safe">
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
