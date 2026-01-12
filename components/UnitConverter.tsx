"use client";

import { useState, useEffect } from "react";
import {
  convertIngredient,
  parseAmount,
  formatAmount,
  isVolumeUnit,
  isWeightUnit,
  COMMON_UNITS,
} from "@/lib/unit-conversion";

// Common ingredients for dropdown with their Spanish names
const COMMON_INGREDIENTS = [
  { value: "", label: "Seleccionar ingrediente (opcional)" },
  { value: "harina", label: "🌾 Harina" },
  { value: "harina de almendra", label: "🌰 Harina de almendra" },
  { value: "azúcar", label: "🍬 Azúcar blanco" },
  { value: "azúcar moreno", label: "🍯 Azúcar moreno" },
  { value: "azúcar glas", label: "☁️ Azúcar glas" },
  { value: "mantequilla", label: "🧈 Mantequilla" },
  { value: "aceite de oliva", label: "🫒 Aceite de oliva" },
  { value: "leche", label: "🥛 Leche" },
  { value: "nata", label: "🥛 Nata/Crema" },
  { value: "yogur griego", label: "🥛 Yogur griego" },
  { value: "agua", label: "💧 Agua" },
  { value: "miel", label: "🍯 Miel" },
  { value: "sirope de arce", label: "🍁 Sirope de arce" },
  { value: "arroz", label: "🍚 Arroz" },
  { value: "avena", label: "🌾 Avena" },
  { value: "cacao en polvo", label: "🍫 Cacao en polvo" },
  { value: "maicena", label: "🌽 Maicena" },
  { value: "almendras", label: "🌰 Almendras" },
  { value: "nueces", label: "🥜 Nueces" },
  { value: "sal", label: "🧂 Sal" },
];

// All units for dropdowns
const ALL_UNITS = [
  { group: "Volumen", units: COMMON_UNITS.volume },
  { group: "Peso", units: COMMON_UNITS.weight },
];

export default function UnitConverter() {
  const [amount, setAmount] = useState("1");
  const [fromUnit, setFromUnit] = useState("cup");
  const [toUnit, setToUnit] = useState("g");
  const [ingredient, setIngredient] = useState("");
  const [result, setResult] = useState<{ value: string; approximate: boolean } | null>(null);
  const [showIngredient, setShowIngredient] = useState(false);

  // Check if we need an ingredient for the conversion (volume <-> weight)
  useEffect(() => {
    const needsIngredient =
      (isVolumeUnit(fromUnit) && isWeightUnit(toUnit)) ||
      (isWeightUnit(fromUnit) && isVolumeUnit(toUnit));
    setShowIngredient(needsIngredient);
  }, [fromUnit, toUnit]);

  // Perform conversion whenever inputs change
  useEffect(() => {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setResult(null);
      return;
    }

    const conversion = convertIngredient(amount, fromUnit, toUnit, ingredient);
    if (conversion.success) {
      setResult({
        value: conversion.amount,
        approximate: conversion.approximate || false,
      });
    } else {
      setResult(null);
    }
  }, [amount, fromUnit, toUnit, ingredient]);

  // Swap units
  const handleSwap = () => {
    const tempUnit = fromUnit;
    setFromUnit(toUnit);
    setToUnit(tempUnit);
    // Also swap the result to the input
    if (result?.value) {
      setAmount(result.value);
    }
  };

  // Get label for a unit
  const getUnitLabel = (unit: string) => {
    for (const group of ALL_UNITS) {
      const found = group.units.find((u) => u.value === unit);
      if (found) return found.label;
    }
    return unit;
  };

  return (
    <div className="space-y-4">
      {/* Amount and From Unit */}
      <div className="grid grid-cols-[2fr,3fr] gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-slate)] mb-1">
            Cantidad
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            className="input text-lg font-semibold text-center"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-slate)] mb-1">
            De
          </label>
          <select
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value)}
            className="input"
          >
            {ALL_UNITS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.units.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSwap}
          className="p-2 rounded-full bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] text-[var(--color-purple)] transition-all hover:scale-110"
          title="Intercambiar unidades"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To Unit */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-slate)] mb-1">
          A
        </label>
        <select
          value={toUnit}
          onChange={(e) => setToUnit(e.target.value)}
          className="input"
        >
          {ALL_UNITS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.units.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Ingredient Selector (for volume <-> weight conversions) */}
      {showIngredient && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Ingrediente (para conversión volumen ↔ peso)
          </label>
          <select
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            className="input bg-white"
          >
            {COMMON_INGREDIENTS.map((ing) => (
              <option key={ing.value} value={ing.value}>
                {ing.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-amber-700">
            💡 La conversión entre volumen y peso depende de la densidad del ingrediente.
            {!ingredient && " Selecciona un ingrediente para mayor precisión."}
          </p>
        </div>
      )}

      {/* Result */}
      <div className={`p-4 rounded-xl text-center transition-all ${
        result
          ? "bg-[var(--color-purple-bg)] border-2 border-[var(--color-purple)]"
          : "bg-gray-50 border-2 border-gray-200"
      }`}>
        {result ? (
          <>
            <div className="text-3xl font-bold text-[var(--color-purple)]">
              {result.value} {getUnitLabel(toUnit)}
            </div>
            {result.approximate && (
              <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Aproximado (basado en densidad del ingrediente)
              </p>
            )}
          </>
        ) : (
          <div className="text-[var(--color-slate-light)]">
            {parseAmount(amount) === null || parseAmount(amount)! <= 0
              ? "Introduce una cantidad válida"
              : "No se puede convertir entre estas unidades"}
          </div>
        )}
      </div>

      {/* Quick Reference */}
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--color-slate)] hover:text-[var(--color-purple)] font-medium">
          📋 Referencia rápida
        </summary>
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-[var(--color-slate)] space-y-2">
          <div>
            <strong>Volumen:</strong>
            <ul className="ml-4 mt-1 space-y-0.5">
              <li>1 taza = 236.6 ml</li>
              <li>1 cucharada = 14.8 ml</li>
              <li>1 cucharadita = 4.9 ml</li>
              <li>1 litro = 1000 ml</li>
            </ul>
          </div>
          <div>
            <strong>Peso:</strong>
            <ul className="ml-4 mt-1 space-y-0.5">
              <li>1 kg = 1000 g</li>
              <li>1 oz = 28.3 g</li>
              <li>1 lb = 453.6 g</li>
            </ul>
          </div>
          <div>
            <strong>Densidades comunes (g/taza):</strong>
            <ul className="ml-4 mt-1 space-y-0.5">
              <li>Harina: 125 g</li>
              <li>Azúcar: 200 g</li>
              <li>Mantequilla: 227 g</li>
              <li>Agua/leche: ~237 g</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}












