"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase, type Recipe, type Ingredient, type Instruction, normalizeInstructions } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [adults, setAdults] = useState(0); // Will be initialized from recipe.servings
  const [children, setChildren] = useState(0);
  const [portionsInitialized, setPortionsInitialized] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [showSecondaryUnits, setShowSecondaryUnits] = useState(false);

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
      setAdults(recipe.servings);
      setPortionsInitialized(true);
    }
  }, [recipe, portionsInitialized]);

  const loadRecipe = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setRecipe(data);
    } catch (error) {
      console.error("Error loading recipe:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total portions (children = 0.5 portions each)
  const totalPortions = adults + (children * 0.5);
  const originalServings = recipe?.servings || 1;
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

  const scaleAmount = (amount: string): string => {
    if (servingMultiplier === 1) return amount;
    if (totalPortions === 0) return "0";

    // Try to parse and scale the amount
    const numMatch = amount.match(/^([\d./]+)\s*(.*)$/);
    if (numMatch) {
      let num: number;
      if (numMatch[1].includes("/")) {
        const [numerator, denominator] = numMatch[1].split("/");
        num = parseInt(numerator) / parseInt(denominator);
      } else {
        num = parseFloat(numMatch[1]);
      }

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
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Cargando..." showBack />
        <div className="animate-pulse">
          <div className="aspect-video bg-[var(--color-purple-bg-dark)]" />
          <div className="p-4 max-w-4xl mx-auto">
            <div className="h-8 bg-[var(--color-purple-bg-dark)] rounded w-3/4 mb-4" />
            <div className="h-4 bg-[var(--color-purple-bg-dark)] rounded w-1/2 mb-8" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-[var(--color-purple-bg-dark)] rounded" />
              ))}
            </div>
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
          <div className="flex items-center gap-1">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="p-2 text-[var(--color-slate)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
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
        {/* Hero Image */}
        {recipe.image_url && (
          <div className="relative aspect-video bg-[var(--color-purple-bg-dark)]">
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4">
          {/* Title and Meta */}
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--foreground)] mb-2">
              {recipe.title}
            </h1>

            {recipe.description && (
              <p className="text-[var(--color-slate)] mb-4">
                {recipe.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-slate-light)]">
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

            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {recipe.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

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

          {/* Serving Adjuster */}
          {recipe.servings && (
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
                    <span className="w-8 text-center text-xl font-bold text-[var(--color-purple)]">
                      {adults}
                    </span>
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
                    <span className="w-8 text-center text-xl font-bold text-amber-600">
                      {children}
                    </span>
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
                {/* Unit toggle - only show if any ingredient has secondary units */}
                {(recipe.ingredients as Ingredient[]).some(i => i.amount2 && i.unit2) && (
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
              <ul className="space-y-2">
                {(recipe.ingredients as Ingredient[]).map((ingredient, i) => {
                  const hasSecondary = ingredient.amount2 && ingredient.unit2;
                  const displayAmount = showSecondaryUnits && hasSecondary 
                    ? ingredient.amount2 
                    : ingredient.amount;
                  const displayUnit = showSecondaryUnits && hasSecondary 
                    ? ingredient.unit2 
                    : ingredient.unit;
                  const altAmount = showSecondaryUnits && hasSecondary
                    ? ingredient.amount
                    : ingredient.amount2;
                  const altUnit = showSecondaryUnits && hasSecondary
                    ? ingredient.unit
                    : ingredient.unit2;
                    
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-2 hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors group"
                    >
                      <input type="checkbox" className="checkbox mt-0.5" />
                      <span className="flex-1">
                        <strong className="font-medium">
                          {scaleAmount(displayAmount || '')}
                          {displayUnit && ` ${displayUnit}`}
                        </strong>{" "}
                        {ingredient.name}
                        {/* Show alternative in parentheses if available */}
                        {hasSecondary && altAmount && altUnit && (
                          <span className="text-[var(--color-slate-light)] text-sm ml-1">
                            ({scaleAmount(altAmount)} {altUnit})
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
                  const stepIngredients = step.ingredientIndices
                    .map(idx => (recipe.ingredients as Ingredient[])[idx])
                    .filter(Boolean);
                  
                  const isCurrentStep = cookingMode && i === currentStep;
                  const isCompletedStep = completedSteps.has(i);
                  
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
                            i + 1
                          )}
                        </button>
                        <div className="flex-1 pt-1">
                          <p className={`${isCompletedStep ? "line-through text-[var(--color-slate-light)]" : "text-[var(--color-slate)]"} ${isCurrentStep ? "text-[var(--foreground)] font-medium" : ""}`}>
                            {step.text}
                          </p>
                          
                          {/* Ingredientes usados en este paso */}
                          {stepIngredients.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {stepIngredients.map((ingredient, idx) => {
                                const hasSecondary = ingredient.amount2 && ingredient.unit2;
                                const displayAmount = showSecondaryUnits && hasSecondary 
                                  ? ingredient.amount2 
                                  : ingredient.amount;
                                const displayUnit = showSecondaryUnits && hasSecondary 
                                  ? ingredient.unit2 
                                  : ingredient.unit;
                                const altAmount = showSecondaryUnits && hasSecondary
                                  ? ingredient.amount
                                  : ingredient.amount2;
                                const altUnit = showSecondaryUnits && hasSecondary
                                  ? ingredient.unit
                                  : ingredient.unit2;
                                  
                                return (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                                      isCurrentStep
                                        ? "bg-white border border-[var(--color-purple)] shadow-sm"
                                        : "bg-[var(--color-purple-bg)] border border-[var(--color-purple-bg-dark)]"
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="font-semibold text-[var(--color-purple)]">
                                      {scaleAmount(displayAmount || '')}
                                      {displayUnit && ` ${displayUnit}`}
                                      {hasSecondary && altAmount && altUnit && (
                                        <span className="font-normal text-[var(--color-slate-light)]">
                                          {" "}({scaleAmount(altAmount)} {altUnit})
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[var(--color-slate)]">
                                      {ingredient.name}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
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
                Notes
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

