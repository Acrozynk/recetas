"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase, type Recipe, type Ingredient, type Instruction, type Container, normalizeInstructions } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { 
  convertIngredient, 
  isVolumeUnit, 
  isWeightUnit, 
  normalizeUnit,
  parseAmount
} from "@/lib/unit-conversion";

// Helper function to normalize text for matching (remove accents, lowercase)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, " ") // Remove special chars
    .trim();
}

// Find position of a keyword in text, handling accents
// Returns { position, length } in the ORIGINAL text
function findPositionIgnoringAccents(text: string, keyword: string): { position: number; length: number } | null {
  const normalizedKeyword = normalizeText(keyword);
  const lowerText = text.toLowerCase();
  
  // Build a mapping from normalized positions to original positions
  // and search in normalized text
  let normalizedText = '';
  const posMap: number[] = []; // posMap[normalizedIndex] = originalIndex
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const normalizedChar = char.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedChar) {
      for (let c = 0; c < normalizedChar.length; c++) {
        posMap.push(i);
      }
      normalizedText += normalizedChar;
    }
  }
  
  // Search in normalized text
  const pos = normalizedText.indexOf(normalizedKeyword);
  if (pos === -1) return null;
  
  // Map back to original position
  const originalStart = posMap[pos];
  const normalizedEnd = pos + normalizedKeyword.length;
  let originalEnd = normalizedEnd < posMap.length ? posMap[normalizedEnd] : text.length;
  
  // Extend to capture full word in original text
  while (originalEnd < text.length && /[\wáéíóúüñÁÉÍÓÚÜÑ]/i.test(text[originalEnd])) {
    originalEnd++;
  }
  
  return { position: originalStart, length: originalEnd - originalStart };
}

// Extract core ingredient name from full ingredient text
// e.g., "calabacín pequeño" -> ["calabacin", "calabacin pequeno"]
function extractIngredientKeywords(ingredientName: string): string[] {
  const normalized = normalizeText(ingredientName);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  // Return both individual words and the full phrase
  const keywords: string[] = [];
  
  // Add the full normalized name
  keywords.push(normalized);
  
  // Add individual significant words (skip common words and cooking verbs)
  const skipWords = new Set([
    // Articles and prepositions
    "para", "con", "sin", "del", "las", "los", "una", "uno", "unos", "unas",
    // Quantities
    "poco", "poca", "mucho", "mucha", "mas", "menos", "bien", "mal",
    // Adjectives
    "grande", "pequeno", "mediano", "fresco", "fresca", "seco", "seca",
    "rallado", "rallada", "picado", "picada", "cortado", "cortada",
    "troceado", "troceada", "molido", "molida", "entero", "entera",
    "natural", "normal",
    // Cooking verbs (to avoid matching "hornear" with "polvo de hornear", etc.)
    "hornear", "cocinar", "hervir", "freir", "asar", "saltear", "cocer",
    "batir", "mezclar", "remover", "añadir", "agregar", "incorporar",
    "cortar", "picar", "rallar", "pelar", "trocear", "laminar",
    "calentar", "enfriar", "reposar", "dejar", "poner", "sacar",
    "servir", "decorar", "espolvorear", "untar", "engrasar"
  ]);
  
  for (const word of words) {
    if (!skipWords.has(word) && word.length > 2) {
      keywords.push(word);
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Check if step text mentions an ingredient
function findIngredientMention(stepText: string, ingredientName: string): { found: boolean; matchedWord: string } {
  const normalizedStep = normalizeText(stepText);
  const keywords = extractIngredientKeywords(ingredientName);
  
  // Try to match keywords from longest to shortest
  const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
  
  for (const keyword of sortedKeywords) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${keyword}s?\\b`, 'i'); // Handle plurals
    if (regex.test(normalizedStep)) {
      return { found: true, matchedWord: keyword };
    }
  }
  
  return { found: false, matchedWord: '' };
}

// Format ingredient quantity for display in step (only amount and unit, no name)
function formatIngredientForStep(
  ingredient: Ingredient, 
  scaleAmount: (amount: string) => string,
  useVariant2: boolean,
  convertUnit?: (amount: string | undefined, unit: string | undefined, name: string) => { amount: string; unit: string }
): string {
  const hasSecondary = !!ingredient.amount2;
  const displayAmount = useVariant2 && hasSecondary 
    ? ingredient.amount2 
    : ingredient.amount;
  const displayUnit = useVariant2 && hasSecondary 
    ? (ingredient.unit2 || ingredient.unit)
    : ingredient.unit;
  
  const scaledAmount = scaleAmount(displayAmount || '');
  
  // Apply unit conversion if provided
  if (convertUnit) {
    const converted = convertUnit(scaledAmount, displayUnit, ingredient.name);
    let result = converted.amount;
    if (converted.unit) result += ` ${converted.unit}`;
    return result.trim();
  }
  
  let result = scaledAmount;
  if (displayUnit) result += ` ${displayUnit}`;
  
  return result.trim();
}

interface EnrichedStepPart {
  type: 'text' | 'ingredient';
  content: string;
  ingredient?: Ingredient;
  formattedIngredient?: string;
}

// Enrich step text with ingredient quantities
function enrichStepWithIngredients(
  stepText: string,
  ingredients: Ingredient[],
  scaleAmount: (amount: string) => string,
  useVariant2: boolean,
  convertUnit?: (amount: string | undefined, unit: string | undefined, name: string) => { amount: string; unit: string }
): EnrichedStepPart[] {
  const parts: EnrichedStepPart[] = [];
  
  // Filter out headers and get valid ingredients
  const validIngredients = ingredients.filter(
    ing => !ing.isHeader && !ing.name.startsWith('**')
  );
  
  // Find all ingredient mentions in the step
  const mentions: { ingredient: Ingredient; position: number; length: number }[] = [];
  
  for (const ingredient of validIngredients) {
    const { found } = findIngredientMention(stepText, ingredient.name);
    if (found) {
      // Find where this ingredient is mentioned in the original text
      const keywords = extractIngredientKeywords(ingredient.name);
      const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
      
      for (const keyword of sortedKeywords) {
        // Find position in original text, handling accents
        const match = findPositionIgnoringAccents(stepText, keyword);
        
        if (match) {
          // Verify word boundaries
          const beforeChar = match.position > 0 ? stepText[match.position - 1] : ' ';
          const afterPos = match.position + match.length;
          const afterChar = afterPos < stepText.length ? stepText[afterPos] : ' ';
          
          const isWordBoundaryBefore = !/[\wáéíóúüñ]/i.test(beforeChar);
          const isWordBoundaryAfter = !/[\wáéíóúüñ]/i.test(afterChar);
          
          if (isWordBoundaryBefore && isWordBoundaryAfter) {
            mentions.push({
              ingredient,
              position: match.position,
              length: match.length
            });
            break;
          }
        }
      }
    }
  }
  
  // Sort mentions by position
  mentions.sort((a, b) => a.position - b.position);
  
  // Remove overlapping mentions (keep the first one)
  const filteredMentions: typeof mentions = [];
  for (const mention of mentions) {
    const overlaps = filteredMentions.some(
      m => mention.position < m.position + m.length && mention.position + mention.length > m.position
    );
    if (!overlaps) {
      filteredMentions.push(mention);
    }
  }
  
  // Build parts
  let lastIndex = 0;
  for (const mention of filteredMentions) {
    // Add text before this mention
    if (mention.position > lastIndex) {
      parts.push({
        type: 'text',
        content: stepText.substring(lastIndex, mention.position)
      });
    }
    
    // Add the ingredient mention with quantity
    const matchedText = stepText.substring(mention.position, mention.position + mention.length);
    
    // Only add as ingredient part if we actually captured a word
    if (matchedText.trim()) {
      parts.push({
        type: 'ingredient',
        content: matchedText,
        ingredient: mention.ingredient,
        formattedIngredient: formatIngredientForStep(mention.ingredient, scaleAmount, useVariant2, convertUnit)
      });
    } else {
      // If somehow we didn't capture the word, just add as text
      parts.push({
        type: 'text',
        content: matchedText
      });
    }
    
    lastIndex = mention.position + mention.length;
  }
  
  // Add remaining text
  if (lastIndex < stepText.length) {
    parts.push({
      type: 'text',
      content: stepText.substring(lastIndex)
    });
  }
  
  // If no mentions found, return the whole text as a single part
  if (parts.length === 0) {
    parts.push({ type: 'text', content: stepText });
  }
  
  return parts;
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [adults, setAdults] = useState(0); // Will be initialized from recipe.servings
  const [children, setChildren] = useState(0);
  const [unitsQuantity, setUnitsQuantity] = useState(0); // For units-based recipes
  const [portionsInitialized, setPortionsInitialized] = useState(false);
  // Container-based scaling
  const [containerQuantity, setContainerQuantity] = useState(1);
  const [container, setContainer] = useState<Container | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [showSecondaryUnits, setShowSecondaryUnits] = useState(false);
  // Selected variant (1 = primary amounts, 2 = secondary amounts)
  const [selectedVariant, setSelectedVariant] = useState<1 | 2>(1);
  const [rating, setRating] = useState<number | null>(null);
  const [madeIt, setMadeIt] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  // Unit conversion mode: 'metric' (g, ml) or 'american' (cups, tbsp)
  const [unitMode, setUnitMode] = useState<'metric' | 'american'>('metric');
  const [duplicating, setDuplicating] = useState(false);

  // Check if Wake Lock API is supported
  useEffect(() => {
    setWakeLockSupported('wakeLock' in navigator);
  }, []);

  // Request wake lock when cooking mode is enabled
  const requestWakeLock = useCallback(async () => {
    if (!wakeLockSupported || !cookingMode) return;
    
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
    }
  }, [wakeLockSupported, cookingMode]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }, []);

  // Manage wake lock based on cooking mode
  useEffect(() => {
    if (cookingMode) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [cookingMode, requestWakeLock, releaseWakeLock]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cookingMode) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cookingMode, requestWakeLock]);

  useEffect(() => {
    if (params.id) {
      loadRecipe(params.id as string);
    }
  }, [params.id]);

  // Initialize portions when recipe loads
  useEffect(() => {
    if (recipe?.servings && !portionsInitialized) {
      if (recipe.servings_unit) {
        // Units-based recipe: initialize unitsQuantity
        setUnitsQuantity(recipe.servings);
      } else {
        // Person-based recipe: initialize adults
        setAdults(recipe.servings);
      }
      setPortionsInitialized(true);
    }
  }, [recipe, portionsInitialized]);

  // Initialize rating and madeIt from recipe
  useEffect(() => {
    if (recipe) {
      setRating(recipe.rating ?? null);
      setMadeIt(recipe.made_it ?? false);
    }
  }, [recipe]);

  const loadRecipe = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*, container:containers(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setRecipe(data);
      
      // Initialize container state if recipe uses containers
      if (data.container_id && data.container) {
        setContainer(data.container);
        setContainerQuantity(data.container_quantity || 1);
      }
    } catch (error) {
      console.error("Error loading recipe:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total portions (children = 0.5 portions each)
  // For container-based recipes, use containerQuantity instead
  // For units-based recipes, use unitsQuantity
  const usesContainer = !!recipe?.container_id;
  const usesUnits = !!recipe?.servings_unit;
  const totalPortions = usesContainer 
    ? containerQuantity 
    : usesUnits
      ? unitsQuantity
      : adults + (children * 0.5);
  const originalServings = usesContainer 
    ? (recipe?.container_quantity || 1) 
    : (recipe?.servings || 1);
  const servingMultiplier = totalPortions / originalServings;

  const handleDelete = async () => {
    if (!recipe) return;

    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipe.id);

      if (error) throw error;
      router.push("/");
    } catch (error) {
      console.error("Error deleting recipe:", error);
    }
  };

  const handleDuplicate = async () => {
    if (!recipe || duplicating) return;

    setDuplicating(true);
    try {
      // Create a copy of the recipe without id and timestamps
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, container, ...recipeData } = recipe;
      
      const duplicatedRecipe = {
        ...recipeData,
        title: `Copia de ${recipe.title}`,
        // Reset rating and made_it for the copy
        rating: null,
        made_it: false,
      };

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedRecipe),
      });

      if (!response.ok) throw new Error('Failed to duplicate recipe');

      const newRecipe = await response.json();
      
      // Redirect to edit page of the new recipe
      router.push(`/recipes/${newRecipe.id}/edit`);
    } catch (error) {
      console.error("Error duplicating recipe:", error);
      alert("Error al duplicar la receta. Inténtalo de nuevo.");
      setDuplicating(false);
    }
  };

  const updateRating = async (newRating: number | null) => {
    if (!recipe) return;
    
    setRating(newRating);
    setSavingStatus(true);
    
    try {
      const { error } = await supabase
        .from("recipes")
        .update({ rating: newRating })
        .eq("id", recipe.id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating rating:", error);
      // Revert on error
      setRating(recipe.rating ?? null);
    } finally {
      setSavingStatus(false);
    }
  };

  const toggleMadeIt = async () => {
    if (!recipe) return;
    
    const newValue = !madeIt;
    setMadeIt(newValue);
    setSavingStatus(true);
    
    try {
      const { error } = await supabase
        .from("recipes")
        .update({ made_it: newValue })
        .eq("id", recipe.id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating made_it:", error);
      // Revert on error
      setMadeIt(recipe.made_it ?? false);
    } finally {
      setSavingStatus(false);
    }
  };

  const scaleAmount = (amount: string): string => {
    if (servingMultiplier === 1) return amount;
    // If no portions configured, show original amounts instead of 0
    if (totalPortions === 0 || servingMultiplier === 0) return amount;

    // Unicode fractions map
    const unicodeFractions: Record<string, number> = {
      '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75,
      '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
      '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1/6, '⅚': 5/6
    };

    // Helper to parse a number that may include Unicode fractions
    const parseAmount = (str: string): number | null => {
      let trimmed = str.trim();
      if (!trimmed) return null;
      
      // Check for leading whole number followed by Unicode fraction (e.g., "1½")
      const mixedMatch = trimmed.match(/^(\d+)([½⅓⅔¼¾⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])$/);
      if (mixedMatch) {
        const whole = parseInt(mixedMatch[1]);
        const frac = unicodeFractions[mixedMatch[2]];
        return frac !== undefined ? whole + frac : null;
      }
      
      // Check for standalone Unicode fraction
      if (unicodeFractions[trimmed] !== undefined) {
        return unicodeFractions[trimmed];
      }
      
      // Check for regular fraction (e.g., "1/2")
      if (trimmed.includes("/")) {
        const [numerator, denominator] = trimmed.split("/");
        const num = parseInt(numerator);
        const den = parseInt(denominator);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return num / den;
        }
        return null;
      }
      
      // Regular number
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : num;
    };

    // Try to parse and scale the amount - now supports Unicode fractions
    const numMatch = amount.match(/^([\d./½⅓⅔¼¾⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]+)\s*(.*)$/);
    if (numMatch) {
      const num = parseAmount(numMatch[1]);
      if (num === null) return amount;

      const scaled = num * servingMultiplier;
      
      // Format the scaled number nicely
      let scaledStr: string;
      if (scaled % 1 === 0) {
        scaledStr = scaled.toString();
      } else if (scaled === 0.25) {
        scaledStr = "¼";
      } else if (scaled === 0.5) {
        scaledStr = "½";
      } else if (scaled === 0.75) {
        scaledStr = "¾";
      } else if (Math.abs(scaled - 0.33) < 0.01) {
        scaledStr = "⅓";
      } else if (Math.abs(scaled - 0.67) < 0.01) {
        scaledStr = "⅔";
      } else if (Math.abs(scaled - 0.125) < 0.01) {
        scaledStr = "⅛";
      } else if (Math.abs(scaled - 0.167) < 0.01) {
        scaledStr = "⅙";
      } else if (scaled === 1.5) {
        scaledStr = "1½";
      } else if (scaled === 2.5) {
        scaledStr = "2½";
      } else {
        // Round to reasonable precision
        scaledStr = scaled.toFixed(2).replace(/\.?0+$/, "");
      }
      
      return `${scaledStr} ${numMatch[2]}`.trim();
    }

    return amount;
  };

  // Convert ingredient amount based on unit mode (metric vs american)
  const convertIngredientUnit = (
    amount: string | undefined,
    unit: string | undefined,
    ingredientName: string
  ): { amount: string; unit: string } => {
    if (!amount || !unit) return { amount: amount || '', unit: unit || '' };
    
    const normalizedUnit = normalizeUnit(unit);
    
    // Determine target unit based on mode
    if (unitMode === 'american') {
      // Convert metric to american
      if (isWeightUnit(unit)) {
        // Weight -> volume (cups/tbsp)
        const result = convertIngredient(amount, unit, 'cup', ingredientName);
        if (result.success) {
          // Parse the result to see if it's a small amount
          const parsedResult = parseAmount(result.amount);
          if (parsedResult !== null && parsedResult < 0.1) {
            // Try tablespoons for small amounts
            const tbspResult = convertIngredient(amount, unit, 'tbsp', ingredientName);
            if (tbspResult.success) {
              const parsedTbsp = parseAmount(tbspResult.amount);
              if (parsedTbsp !== null && parsedTbsp >= 1) {
                return { amount: tbspResult.amount, unit: 'cda' };
              }
              // Try teaspoons for even smaller amounts
              const tspResult = convertIngredient(amount, unit, 'tsp', ingredientName);
              if (tspResult.success) {
                return { amount: tspResult.amount, unit: 'cdta' };
              }
            }
          }
          return { amount: result.amount, unit: 'taza' };
        }
      } else if (normalizedUnit === 'ml') {
        // ml -> volume (cups/tbsp)
        const result = convertIngredient(amount, unit, 'cup', ingredientName);
        if (result.success) {
          const parsedResult = parseAmount(result.amount);
          if (parsedResult !== null && parsedResult < 0.25) {
            const tbspResult = convertIngredient(amount, unit, 'tbsp', ingredientName);
            if (tbspResult.success) {
              return { amount: tbspResult.amount, unit: 'cda' };
            }
          }
          return { amount: result.amount, unit: 'taza' };
        }
      } else if (normalizedUnit === 'l') {
        // liters -> cups
        const result = convertIngredient(amount, unit, 'cup', ingredientName);
        if (result.success) {
          return { amount: result.amount, unit: 'tazas' };
        }
      }
    } else {
      // Convert american to metric
      if (isVolumeUnit(unit) && !['ml', 'l'].includes(normalizedUnit)) {
        // Volume (cups/tbsp) -> weight (grams)
        const result = convertIngredient(amount, unit, 'g', ingredientName);
        if (result.success) {
          const parsedResult = parseAmount(result.amount);
          if (parsedResult !== null && parsedResult >= 1000) {
            // Convert to kg for large amounts
            const kgResult = convertIngredient(amount, unit, 'kg', ingredientName);
            if (kgResult.success) {
              return { amount: kgResult.amount, unit: 'kg' };
            }
          }
          return { amount: result.amount, unit: 'g' };
        }
      }
    }
    
    // Return original if no conversion needed or possible
    return { amount, unit };
  };

  const toggleStepCompleted = (stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const goToNextStep = (totalSteps: number) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetCookingProgress = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setCheckedIngredients(new Set());
  };

  const toggleIngredientChecked = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Cargando..." showBack />
        <div className="animate-pulse p-4 max-w-7xl mx-auto lg:px-8">
          <div className="flex gap-4 sm:gap-6 items-start mb-6">
            <div className="flex-1">
              <div className="h-8 bg-[var(--color-purple-bg-dark)] rounded w-3/4 mb-3" />
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-20 bg-[var(--color-purple-bg-dark)] rounded" />
                <div className="h-6 w-16 bg-[var(--color-purple-bg-dark)] rounded-full" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-14 bg-[var(--color-purple-bg-dark)] rounded-full" />
                <div className="h-6 w-16 bg-[var(--color-purple-bg-dark)] rounded-full" />
              </div>
            </div>
            <div className="w-28 h-28 sm:w-40 sm:h-40 bg-[var(--color-purple-bg-dark)] rounded-xl flex-shrink-0" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-[var(--color-purple-bg-dark)] rounded" />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Receta No Encontrada" showBack />
        <div className="text-center py-12">
          <p className="text-[var(--color-slate-light)]">
            Esta receta no existe o fue eliminada.
          </p>
          <Link href="/" className="btn-primary inline-block mt-4">
            Volver a Recetas
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-screen pb-20">
      <Header
        title=""
        showBack
        rightAction={
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={() => window.print()}
              className="p-2 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
              title="Imprimir receta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            </button>
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="p-2 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
              title="Duplicar receta"
            >
              {duplicating ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="p-2 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
              title="Editar receta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-[var(--color-slate)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar receta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        }
      />

      <main>
        <div className="max-w-7xl mx-auto p-4 lg:px-8">
          {/* Title, Meta and Image */}
          <div className="mb-6">
            <div className="flex gap-4 sm:gap-6 items-start">
              {/* Left side: Title, Rating, Tags */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--foreground)] mb-3">
                  {recipe.title}
                </h1>

                {/* Rating and Made It */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {/* Interactive Rating */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((star) => (
                      <button
                        key={star}
                        onClick={() => updateRating(rating === star ? null : star)}
                        disabled={savingStatus}
                        className="p-0.5 transition-transform hover:scale-110 focus:outline-none disabled:opacity-50"
                        title={rating === star ? "Quitar valoración" : `${star} estrella${star > 1 ? 's' : ''}`}
                      >
                        <svg
                          className={`w-6 h-6 transition-colors ${
                            rating && star <= rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-300 hover:text-amber-200"
                          }`}
                          fill={rating && star <= rating ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>

                  {/* Made It Toggle */}
                  <button
                    onClick={toggleMadeIt}
                    disabled={savingStatus}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 ${
                      madeIt
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-gray-100 text-[var(--color-slate)] border border-gray-200 hover:border-green-300 hover:text-green-600"
                    }`}
                  >
                    <span className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
                      madeIt
                        ? "bg-green-500"
                        : "border border-current"
                    }`}>
                      {madeIt && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {madeIt ? "¡Lo hice!" : "¿Lo hiciste?"}
                  </button>

                  {/* Saving indicator */}
                  {savingStatus && (
                    <span className="text-xs text-[var(--color-slate-light)] animate-pulse">
                      Guardando...
                    </span>
                  )}
                </div>

                {/* Tags */}
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Source URL - alongside image */}
                {recipe.source_url && (
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-4 text-sm text-[var(--color-purple)] hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ver receta original
                  </a>
                )}
              </div>

              {/* Right side: Image */}
              {recipe.image_url && (
                <div className="relative flex-shrink-0 w-36 h-36 sm:w-52 sm:h-52 rounded-xl overflow-hidden bg-[var(--color-purple-bg-dark)] shadow-md">
                  <Image
                    src={recipe.image_url}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}
            </div>

            {/* Description */}
            {recipe.description && (
              <p className="text-[var(--color-slate)] mt-4">
                {recipe.description}
              </p>
            )}

            {/* Time info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-slate-light)] mt-4">
              {recipe.prep_time_minutes && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Prep.: {recipe.prep_time_minutes} min
                </span>
              )}
              {recipe.cook_time_minutes && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  Cocción: {recipe.cook_time_minutes} min
                </span>
              )}
              {totalTime > 0 && (
                <span className="font-medium text-[var(--color-purple)]">
                  Total: {totalTime} min
                </span>
              )}
            </div>
          </div>

          {/* Serving Adjuster - for person-based recipes (hide when using ingredient variants or units) */}
          {recipe.servings && !usesContainer && !recipe.variant_1_label && !recipe.servings_unit && (
            <div className="p-4 bg-white rounded-xl border border-[var(--border-color)] mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-[var(--color-slate)]">
                  Ajustar porciones
                </span>
                {(adults !== recipe.servings || children !== 0) && (
                  <button
                    onClick={() => {
                      setAdults(recipe.servings || 1);
                      setChildren(0);
                    }}
                    className="text-sm text-[var(--color-purple)] hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Adults */}
                <div className="flex flex-col items-center p-3 bg-[var(--color-purple-bg)] rounded-xl">
                  <div className="flex items-center gap-1 mb-2">
                    <svg className="w-5 h-5 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--color-slate)]">Adultos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAdults(Math.max(0, adults - 1))}
                      disabled={adults === 0 && children === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[var(--border-color)] hover:bg-[var(--color-purple-bg-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={adults}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          setAdults(val);
                        }
                      }}
                      min="0"
                      className="w-12 text-center text-xl font-bold text-[var(--color-purple)] bg-white border border-[var(--border-color)] rounded-lg py-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-purple)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setAdults(adults + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[var(--border-color)] hover:bg-[var(--color-purple-bg-dark)] transition-colors text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Children (half portions) */}
                <div className="flex flex-col items-center p-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-1 mb-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--color-slate)]">Niños</span>
                    <span className="text-xs text-amber-600">(½)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChildren(Math.max(0, children - 1))}
                      disabled={children === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={children}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          setChildren(val);
                        }
                      }}
                      min="0"
                      className="w-12 text-center text-xl font-bold text-amber-600 bg-white border border-amber-200 rounded-lg py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setChildren(children + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-amber-200 hover:bg-amber-100 transition-colors text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Total portions summary */}
              <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-sm text-[var(--color-slate-light)]">
                  Total: <strong className="text-[var(--foreground)]">{totalPortions}</strong> porciones
                  {servingMultiplier !== 1 && (
                    <span className="text-[var(--color-purple)] ml-1">
                      ({servingMultiplier > 1 ? '×' : '×'}{servingMultiplier.toFixed(servingMultiplier % 1 === 0 ? 0 : 1)})
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--color-slate-light)]">
                  Receta original: {recipe.servings} porciones
                </span>
              </div>
            </div>
          )}

          {/* Units Adjuster - for units-based recipes (tortitas, galletas, etc.) */}
          {recipe.servings && !usesContainer && !recipe.variant_1_label && recipe.servings_unit && (
            <div className="p-4 bg-white rounded-xl border border-[var(--border-color)] mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-[var(--color-slate)]">
                  Ajustar cantidad
                </span>
                {unitsQuantity !== recipe.servings && (
                  <button
                    onClick={() => setUnitsQuantity(recipe.servings || 1)}
                    className="text-sm text-[var(--color-purple)] hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>
              
              {/* Units quantity selector */}
              <div className="flex flex-col items-center p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📦</span>
                  <span className="font-medium text-[var(--color-slate)] capitalize">
                    {recipe.servings_unit}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUnitsQuantity(Math.max(1, unitsQuantity - 1))}
                    disabled={unitsQuantity <= 1}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xl font-medium"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={unitsQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        setUnitsQuantity(val);
                      }
                    }}
                    min="1"
                    className="w-20 text-center text-2xl font-bold text-blue-700 bg-white border border-blue-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setUnitsQuantity(unitsQuantity + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-blue-200 hover:bg-blue-100 transition-colors text-xl font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-sm text-[var(--color-slate-light)]">
                  {servingMultiplier !== 1 && (
                    <span className="text-blue-600 font-medium">
                      Ingredientes ×{servingMultiplier.toFixed(servingMultiplier % 1 === 0 ? 0 : 1)}
                    </span>
                  )}
                  {servingMultiplier === 1 && (
                    <span className="text-[var(--color-slate-light)]">
                      Cantidad original
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--color-slate-light)]">
                  Receta original: {recipe.servings} {recipe.servings_unit}
                </span>
              </div>
            </div>
          )}

          {/* Container Adjuster - for container-based recipes (baking) */}
          {usesContainer && container && (
            <div className="p-4 bg-white rounded-xl border border-[var(--border-color)] mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-[var(--color-slate)]">
                  Ajustar cantidad
                </span>
                {containerQuantity !== (recipe.container_quantity || 1) && (
                  <button
                    onClick={() => setContainerQuantity(recipe.container_quantity || 1)}
                    className="text-sm text-[var(--color-purple)] hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>
              
              {/* Container quantity selector */}
              <div className="flex flex-col items-center p-4 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🍰</span>
                  <span className="font-medium text-[var(--color-slate)] capitalize">
                    {/* Show variant label if selected, otherwise container name */}
                    {recipe.variant_1_label && recipe.variant_2_label
                      ? (selectedVariant === 1 ? recipe.variant_1_label : recipe.variant_2_label)
                      : container.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setContainerQuantity(Math.max(0.5, containerQuantity - 0.5))}
                    disabled={containerQuantity <= 0.5}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xl font-medium"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={containerQuantity % 1 === 0 ? containerQuantity : containerQuantity.toFixed(1)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0.5) {
                        setContainerQuantity(val);
                      }
                    }}
                    min="0.5"
                    step="0.5"
                    className="w-20 text-center text-2xl font-bold text-amber-700 bg-white border border-amber-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setContainerQuantity(containerQuantity + 0.5)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-amber-200 hover:bg-amber-100 transition-colors text-xl font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-sm text-[var(--color-slate-light)]">
                  {servingMultiplier !== 1 && (
                    <span className="text-amber-600 font-medium">
                      Ingredientes ×{servingMultiplier.toFixed(servingMultiplier % 1 === 0 ? 0 : 1)}
                    </span>
                  )}
                  {servingMultiplier === 1 && (
                    <span className="text-[var(--color-slate-light)]">
                      Cantidad original
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--color-slate-light)]">
                  Receta original: {recipe.container_quantity || 1} {recipe.variant_1_label && recipe.variant_2_label
                    ? (selectedVariant === 1 ? recipe.variant_1_label : recipe.variant_2_label)
                    : container.name}
                </span>
              </div>
            </div>
          )}

          {/* Cooking Mode Toggle - Keeps screen awake */}
          <button
            onClick={() => setCookingMode(!cookingMode)}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border mb-6 transition-all ${
              cookingMode
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple-bg-dark)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${cookingMode ? 'bg-amber-200' : 'bg-[var(--color-purple-bg-dark)]'}`}>
              {cookingMode ? (
                <svg className="w-5 h-5 text-amber-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[var(--color-slate)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium block">
                {cookingMode ? '¡Modo Cocina Activo!' : 'Modo Cocina'}
              </span>
              <span className={`text-sm ${cookingMode ? 'text-amber-700' : 'text-[var(--color-slate-light)]'}`}>
                {cookingMode 
                  ? 'La pantalla permanecerá encendida' 
                  : wakeLockSupported 
                    ? 'Mantener pantalla encendida mientras cocinas'
                    : 'Tu navegador no soporta esta función'}
              </span>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${cookingMode ? 'bg-amber-400' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${cookingMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </button>

          <div className="grid md:grid-cols-[1fr,2fr] gap-6">
            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                  Ingredientes
                </h2>
                <div className="flex items-center gap-2">
                  {/* Unit conversion toggle - metric (g) vs american (cups) */}
                  <div className="flex rounded-lg overflow-hidden border border-[var(--border-color)] shadow-sm">
                    <button
                      onClick={() => setUnitMode('metric')}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1 ${
                        unitMode === 'metric'
                          ? "bg-[var(--color-purple)] text-white"
                          : "bg-white text-[var(--color-slate)] hover:bg-[var(--color-purple-bg)]"
                      }`}
                      title="Unidades métricas (gramos, ml)"
                    >
                      <span className="font-bold">g</span>
                    </button>
                    <button
                      onClick={() => setUnitMode('american')}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1 ${
                        unitMode === 'american'
                          ? "bg-[var(--color-purple)] text-white"
                          : "bg-white text-[var(--color-slate)] hover:bg-[var(--color-purple-bg)]"
                      }`}
                      title="Unidades americanas (tazas, cucharadas)"
                    >
                      <span>🥛</span>
                    </button>
                  </div>
                  {/* Variant selector - show when recipe has variant labels */}
                  {recipe.variant_1_label && recipe.variant_2_label && (
                    <div className="flex rounded-lg overflow-hidden border border-[var(--border-color)]">
                      <button
                        onClick={() => setSelectedVariant(1)}
                        className={`px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
                          selectedVariant === 1
                            ? "bg-amber-500 text-white"
                            : "bg-white text-[var(--color-slate)] hover:bg-amber-50"
                        }`}
                        title={recipe.variant_1_label}
                      >
                        {recipe.variant_1_label}
                      </button>
                      <button
                        onClick={() => setSelectedVariant(2)}
                        className={`px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
                          selectedVariant === 2
                            ? "bg-amber-500 text-white"
                            : "bg-white text-[var(--color-slate)] hover:bg-amber-50"
                        }`}
                        title={recipe.variant_2_label}
                      >
                        {recipe.variant_2_label}
                      </button>
                    </div>
                  )}
                  {/* Unit toggle - only show if any ingredient has secondary units AND no variant labels */}
                  {!recipe.variant_1_label && (recipe.ingredients as Ingredient[]).some(i => i.amount2 && i.unit2) && (
                    <button
                      onClick={() => setShowSecondaryUnits(!showSecondaryUnits)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        showSecondaryUnits
                          ? "bg-[var(--color-purple)] text-white"
                          : "bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)]"
                      }`}
                      title="Cambiar entre unidades"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {showSecondaryUnits ? "Alt" : "Std"}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Unit conversion info banner */}
              {unitMode === 'american' && (
                <div className="mb-3 p-2 rounded-lg text-sm bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-2">
                  <span>🥛</span>
                  <span>
                    Mostrando en <strong>tazas/cucharadas</strong>
                    <span className="text-blue-600 text-xs ml-1">(conversión aproximada)</span>
                  </span>
                </div>
              )}
              
              {/* Variant info banner */}
              {recipe.variant_1_label && recipe.variant_2_label && (() => {
                const ingredientsWithVariant2 = (recipe.ingredients as Ingredient[]).filter(
                  i => !i.isHeader && i.amount2
                ).length;
                const totalIngredients = (recipe.ingredients as Ingredient[]).filter(
                  i => !i.isHeader && i.name
                ).length;
                const missingVariant2 = selectedVariant === 2 && ingredientsWithVariant2 < totalIngredients;
                
                return (
                  <div className={`mb-3 p-2 rounded-lg text-sm ${
                    missingVariant2 
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-amber-50 border border-amber-200 text-amber-800"
                  }`}>
                    🍰 Mostrando cantidades para: <strong>{selectedVariant === 1 ? recipe.variant_1_label : recipe.variant_2_label}</strong>
                    {missingVariant2 && (
                      <span className="block mt-1 text-xs">
                        ⚠️ Faltan cantidades para esta variante ({ingredientsWithVariant2}/{totalIngredients} ingredientes). 
                        <a href={`/recipes/${recipe.id}/edit`} className="underline ml-1">Editar receta</a>
                      </span>
                    )}
                  </div>
                );
              })()}
              
              <ul className="space-y-2">
                {(recipe.ingredients as Ingredient[]).map((ingredient, i) => {
                  // Check if this is a section header
                  const isHeader = ingredient.isHeader || ingredient.name.startsWith('**');
                  const headerName = isHeader 
                    ? ingredient.name.replace(/^\*\*|\*\*$/g, '') 
                    : ingredient.name;
                  
                  if (isHeader) {
                    return (
                      <li key={i} className="pt-4 pb-1 first:pt-0">
                        <span className="text-amber-700 font-semibold text-sm uppercase tracking-wide">
                          {headerName}:
                        </span>
                      </li>
                    );
                  }
                  
                  // Check if variant 2 amounts exist (only amount2 is required, unit2 can be empty)
                  const hasSecondary = !!ingredient.amount2;
                  // Use variant selection when recipe has variant labels
                  const useVariant2 = recipe.variant_1_label 
                    ? selectedVariant === 2 
                    : showSecondaryUnits;
                  const baseDisplayAmount = useVariant2 && hasSecondary 
                    ? ingredient.amount2 
                    : ingredient.amount;
                  // For unit, use unit2 if it exists, otherwise fall back to original unit
                  const baseDisplayUnit = useVariant2 && hasSecondary 
                    ? (ingredient.unit2 || ingredient.unit)
                    : ingredient.unit;
                  
                  // Apply unit conversion based on mode
                  const converted = convertIngredientUnit(
                    scaleAmount(baseDisplayAmount || ''),
                    baseDisplayUnit,
                    ingredient.name
                  );
                  const displayAmount = converted.amount;
                  const displayUnit = converted.unit;
                  
                  // Calculate alternative (original metric if in american mode, or vice versa)
                  const showOriginal = baseDisplayUnit !== displayUnit;
                  const originalScaled = scaleAmount(baseDisplayAmount || '');
                    
                  const isChecked = checkedIngredients.has(i);
                  
                  // Check if this ingredient has an alternative
                  const hasAlternative = ingredient.alternative?.name;
                  // Use amount2/unit2 for alternative when variant 2 is selected
                  const altHasVariant2 = !!ingredient.alternative?.amount2;
                  const altBaseAmount = useVariant2 && altHasVariant2 
                    ? ingredient.alternative?.amount2 
                    : ingredient.alternative?.amount;
                  const altBaseUnit = useVariant2 && altHasVariant2 
                    ? (ingredient.alternative?.unit2 || ingredient.alternative?.unit)
                    : ingredient.alternative?.unit;
                  const altScaledAmount = hasAlternative ? scaleAmount(altBaseAmount || '') : '';
                  
                  return (
                    <li
                      key={i}
                      className={`flex items-start gap-3 p-2 rounded-lg transition-all group cursor-pointer ${
                        isChecked
                          ? "opacity-40"
                          : "hover:bg-[var(--color-purple-bg-dark)]"
                      }`}
                      onClick={() => toggleIngredientChecked(i)}
                    >
                      <input 
                        type="checkbox" 
                        className="checkbox mt-0.5" 
                        checked={isChecked}
                        onChange={() => toggleIngredientChecked(i)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={`flex-1 ${isChecked ? "line-through" : ""}`}>
                        <strong className="font-medium">
                          {displayAmount}
                          {displayUnit && ` ${displayUnit}`}
                        </strong>{" "}
                        {ingredient.name}
                        {/* Show original amount in parentheses if converted */}
                        {showOriginal && baseDisplayUnit && (
                          <span className="text-[var(--color-slate-light)] text-sm ml-1">
                            ({originalScaled} {baseDisplayUnit})
                          </span>
                        )}
                        {/* Show alternative ingredient */}
                        {hasAlternative && (
                          <span className="text-emerald-700">
                            {", o "}
                            <strong className="font-medium">
                              {altScaledAmount}
                              {altBaseUnit && ` ${altBaseUnit}`}
                            </strong>{" "}
                            {ingredient.alternative?.name}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                  Instrucciones
                </h2>
                <button
                  onClick={() => setCookingMode(!cookingMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    cookingMode
                      ? "bg-[var(--color-purple)] text-white"
                      : "bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)]"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  {cookingMode ? "Cocinando..." : "Modo Cocinar"}
                </button>
              </div>

              {/* Cooking Mode Progress Bar */}
              {cookingMode && (
                <div className="mb-4 p-3 bg-[var(--color-purple-bg)] rounded-xl border border-[var(--color-purple-bg-dark)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-slate)]">
                      Paso {currentStep + 1} de {normalizeInstructions(recipe.instructions).length}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-slate-light)]">
                        {completedSteps.size} completados
                      </span>
                      {completedSteps.size > 0 && (
                        <button
                          onClick={resetCookingProgress}
                          className="text-xs text-[var(--color-purple)] hover:underline"
                        >
                          Reiniciar
                        </button>
                      )}
                      <span className="text-[var(--color-slate-light)]">·</span>
                      <button
                        onClick={() => {
                          resetCookingProgress();
                          setCookingMode(false);
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Terminar
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-purple-bg-dark)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-purple)] transition-all duration-300"
                      style={{
                        width: `${((currentStep + 1) / normalizeInstructions(recipe.instructions).length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={goToPreviousStep}
                      disabled={currentStep === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-[var(--border-color)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-purple-bg-dark)] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Anterior
                    </button>
                    <button
                      onClick={() => goToNextStep(normalizeInstructions(recipe.instructions).length)}
                      disabled={currentStep === normalizeInstructions(recipe.instructions).length - 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-purple)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    >
                      Siguiente
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <ol className="space-y-4">
                {normalizeInstructions(recipe.instructions).map((step, i) => {
                  // Calculate step number (only counting non-headers)
                  const stepNumber = normalizeInstructions(recipe.instructions).slice(0, i + 1).filter(s => !s.isHeader).length;
                  
                  // Render section header
                  if (step.isHeader) {
                    return (
                      <li key={i} className="pt-4 pb-1 first:pt-0">
                        <span className="text-amber-700 font-semibold text-sm uppercase tracking-wide">
                          {step.text}:
                        </span>
                      </li>
                    );
                  }
                  
                  const stepIngredients = step.ingredientIndices
                    .map(idx => (recipe.ingredients as Ingredient[])[idx])
                    .filter(Boolean);
                  
                  const isCurrentStep = cookingMode && i === currentStep;
                  const isCompletedStep = completedSteps.has(i);
                  
                  // Determine variant mode for ingredients
                  const useVariant2ForStep = recipe.variant_1_label 
                    ? selectedVariant === 2 
                    : showSecondaryUnits;
                  
                  // Enrich step text with ingredient quantities
                  // If step has specific ingredients linked, use only those; otherwise use all
                  const ingredientsToMatch = stepIngredients.length > 0 
                    ? stepIngredients 
                    : (recipe.ingredients as Ingredient[]);
                  const enrichedParts = enrichStepWithIngredients(
                    step.text,
                    ingredientsToMatch,
                    scaleAmount,
                    useVariant2ForStep,
                    convertIngredientUnit
                  );
                  
                  return (
                    <li
                      key={i}
                      onClick={() => cookingMode && setCurrentStep(i)}
                      className={`border-l-2 pl-4 transition-all duration-200 ${
                        isCurrentStep
                          ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)] -mx-2 px-6 py-3 rounded-r-xl"
                          : isCompletedStep
                          ? "border-green-400 opacity-60"
                          : "border-[var(--color-purple-bg-dark)]"
                      } ${cookingMode ? "cursor-pointer hover:bg-[var(--color-purple-bg)]" : ""}`}
                    >
                      <div className="flex gap-3 items-start">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cookingMode) toggleStepCompleted(i);
                          }}
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm transition-all ${
                            isCompletedStep
                              ? "bg-green-500 text-white"
                              : isCurrentStep
                              ? "bg-[var(--color-purple)] text-white ring-4 ring-[var(--color-purple)]/30 scale-110"
                              : "bg-[var(--color-purple)] text-white"
                          } ${cookingMode ? "hover:scale-110" : ""}`}
                        >
                          {isCompletedStep ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            stepNumber
                          )}
                        </button>
                        <div className="flex-1 pt-1">
                          <p className={`${isCompletedStep ? "line-through text-[var(--color-slate-light)]" : "text-[var(--color-slate)]"} ${isCurrentStep ? "text-[var(--foreground)] font-medium" : ""}`}>
                            {enrichedParts.map((part, partIdx) => (
                              part.type === 'ingredient' ? (
                                <span key={partIdx}>
                                  <span>{part.content}</span>
                                  <span className="text-[var(--color-purple)] font-medium">
                                    {` (${part.formattedIngredient})`}
                                  </span>
                                </span>
                              ) : (
                                <span key={partIdx}>{part.content}</span>
                              )
                            ))}
                          </p>
                          
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Cooking Complete Message */}
              {cookingMode && completedSteps.size === normalizeInstructions(recipe.instructions).length && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center animate-fade-in">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="font-semibold text-green-800">¡Receta completada!</p>
                  <p className="text-sm text-green-600 mt-1">Has terminado todos los pasos</p>
                  <button
                    onClick={() => {
                      resetCookingProgress();
                      setCookingMode(false);
                    }}
                    className="mt-3 text-sm text-green-700 hover:underline"
                  >
                    Salir del modo cocinar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {recipe.notes && (
            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h2 className="font-display text-xl font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notas
              </h2>
              <p className="text-amber-800 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="font-display text-xl font-semibold mb-2">
              Delete Recipe?
            </h3>
            <p className="text-[var(--color-slate)] mb-6">
              Are you sure you want to delete &quot;{recipe.title}&quot;? This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

