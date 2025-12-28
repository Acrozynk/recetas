"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase, type Recipe, type Ingredient } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import RecipeCard from "@/components/RecipeCard";
import BackupReminder from "@/components/BackupReminder";
import Link from "next/link";

// Time filter options
type TimeFilter = "all" | "quick" | "medium" | "long";
// Made it filter options
type MadeItFilter = "all" | "made" | "not_made";
// Rating filter options (null = any, 0 = not rated, 1-3 = stars)
type RatingFilter = null | 0 | 1 | 2 | 3;

interface ActiveImportSession {
  id: string;
  total_recipes: number;
  current_index: number;
  recipes: {
    status: "pending" | "accepted" | "edited" | "discarded";
  }[];
}

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeImportSession, setActiveImportSession] = useState<ActiveImportSession | null>(null);
  
  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [madeItFilter, setMadeItFilter] = useState<MadeItFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(null);

  useEffect(() => {
    loadRecipes();
    checkActiveImportSession();
  }, []);

  const checkActiveImportSession = async () => {
    try {
      const response = await fetch("/api/import-session");
      const data = await response.json();
      if (data.session && data.session.status === "active") {
        setActiveImportSession(data.session);
      }
    } catch (err) {
      console.error("Error checking import session:", err);
    }
  };

  const getImportProgress = () => {
    if (!activeImportSession) return { reviewed: 0, accepted: 0, total: 0 };
    const reviewed = activeImportSession.recipes.filter((r) => r.status !== "pending").length;
    const accepted = activeImportSession.recipes.filter((r) => r.status === "accepted" || r.status === "edited").length;
    return { reviewed, accepted, total: activeImportSession.total_recipes };
  };

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*, container:containers(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error("Error loading recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get all unique tags
  const allTags = Array.from(
    new Set(recipes.flatMap((r) => r.tags || []))
  ).sort();

  // Normalize text for search (case insensitive + accent insensitive)
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // Check if any advanced filter is active
  const hasActiveFilters = useMemo(() => {
    return ingredientSearch !== "" || 
           timeFilter !== "all" || 
           madeItFilter !== "all" || 
           ratingFilter !== null;
  }, [ingredientSearch, timeFilter, madeItFilter, ratingFilter]);

  // Clear all advanced filters
  const clearAdvancedFilters = () => {
    setIngredientSearch("");
    setTimeFilter("all");
    setMadeItFilter("all");
    setRatingFilter(null);
  };

  // Filter recipes by search, tags, and advanced filters
  const filteredRecipes = recipes.filter((recipe) => {
    const normalizedSearch = normalizeText(search);
    
    // Text search in title and description
    const matchesSearch =
      !search ||
      normalizeText(recipe.title).includes(normalizedSearch) ||
      normalizeText(recipe.description || "").includes(normalizedSearch);

    // Tag filter
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => recipe.tags && recipe.tags.includes(tag));

    // Ingredient search
    const matchesIngredient = !ingredientSearch || 
      (recipe.ingredients || []).some((ing: Ingredient) => 
        normalizeText(ing.name).includes(normalizeText(ingredientSearch))
      );

    // Time filter
    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
    const matchesTime = timeFilter === "all" ||
      (timeFilter === "quick" && totalTime > 0 && totalTime <= 30) ||
      (timeFilter === "medium" && totalTime > 30 && totalTime <= 60) ||
      (timeFilter === "long" && totalTime > 60);

    // Made it filter
    const matchesMadeIt = madeItFilter === "all" ||
      (madeItFilter === "made" && recipe.made_it) ||
      (madeItFilter === "not_made" && !recipe.made_it);

    // Rating filter
    const matchesRating = ratingFilter === null ||
      (ratingFilter === 0 && recipe.rating === null) ||
      (ratingFilter > 0 && recipe.rating === ratingFilter);

    return matchesSearch && matchesTags && matchesIngredient && matchesTime && matchesMadeIt && matchesRating;
  });

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title="Recetas" showAdd showMascot />

      <main className="max-w-7xl mx-auto p-4 lg:px-8">
        {/* Active Import Session Banner */}
        {activeImportSession && (
          <Link
            href="/recipes/import/review"
            className="block mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl hover:bg-amber-100 transition-colors animate-fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900">
                  Importación en progreso
                </p>
                <p className="text-sm text-amber-700">
                  {getImportProgress().reviewed} de {getImportProgress().total} revisadas · {getImportProgress().accepted} aceptadas
                </p>
              </div>
              <div className="flex-shrink-0 text-amber-600">
                <span className="font-medium text-sm">Continuar →</span>
              </div>
            </div>
            {/* Mini progress bar */}
            <div className="mt-3 h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(getImportProgress().reviewed / getImportProgress().total) * 100}%` }}
              />
            </div>
          </Link>
        )}

        {/* Search bar with filter toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-slate-light)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Buscar recetas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              showFilters || hasActiveFilters
                ? "bg-[var(--color-purple)] text-white border-[var(--color-purple)]"
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--foreground)] hover:border-[var(--color-purple)]"
            }`}
            title="Filtros avanzados"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && (
              <span className="text-xs font-bold">•</span>
            )}
          </button>
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="mb-4 p-4 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-[var(--foreground)]">Filtros avanzados</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-[var(--color-purple)] hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Ingredient search */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                  Buscar por ingrediente
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate-light)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="ej: pollo, tomate..."
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    className="input pl-10 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Made it filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                  Estado
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all" as MadeItFilter, label: "Todos" },
                    { value: "made" as MadeItFilter, label: "Hecho", icon: "✓" },
                    { value: "not_made" as MadeItFilter, label: "Sin hacer" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMadeItFilter(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        madeItFilter === option.value
                          ? option.value === "made"
                            ? "bg-green-500 text-white"
                            : "bg-[var(--color-purple)] text-white"
                          : "bg-[var(--color-purple-bg)] text-[var(--foreground)] hover:bg-[var(--color-purple-bg-dark)]"
                      }`}
                    >
                      {option.icon && <span className="mr-1">{option.icon}</span>}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                  Valoración
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setRatingFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      ratingFilter === null
                        ? "bg-[var(--color-purple)] text-white"
                        : "bg-[var(--color-purple-bg)] text-[var(--foreground)] hover:bg-[var(--color-purple-bg-dark)]"
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setRatingFilter(0)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      ratingFilter === 0
                        ? "bg-[var(--color-purple)] text-white"
                        : "bg-[var(--color-purple-bg)] text-[var(--foreground)] hover:bg-[var(--color-purple-bg-dark)]"
                    }`}
                  >
                    Sin valorar
                  </button>
                  {[1, 2, 3].map((stars) => (
                    <button
                      key={stars}
                      onClick={() => setRatingFilter(stars as RatingFilter)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                        ratingFilter === stars
                          ? "bg-amber-500 text-white"
                          : "bg-[var(--color-purple-bg)] text-[var(--foreground)] hover:bg-[var(--color-purple-bg-dark)]"
                      }`}
                    >
                      {[...Array(stars)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${ratingFilter === stars ? "text-white fill-white" : "text-amber-400 fill-amber-400"}`}
                          viewBox="0 0 24 24"
                        >
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      ))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                  Tiempo total
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all" as TimeFilter, label: "Cualquiera", icon: null },
                    { value: "quick" as TimeFilter, label: "Rápido", sublabel: "≤30 min", icon: "⚡" },
                    { value: "medium" as TimeFilter, label: "Medio", sublabel: "30-60 min", icon: "⏱️" },
                    { value: "long" as TimeFilter, label: "Largo", sublabel: ">60 min", icon: "🍲" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTimeFilter(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        timeFilter === option.value
                          ? "bg-[var(--color-purple)] text-white"
                          : "bg-[var(--color-purple-bg)] text-[var(--foreground)] hover:bg-[var(--color-purple-bg-dark)]"
                      }`}
                    >
                      {option.icon && <span className="mr-1">{option.icon}</span>}
                      {option.label}
                      {option.sublabel && (
                        <span className={`ml-1 text-xs ${timeFilter === option.value ? "text-white/70" : "text-[var(--color-slate-light)]"}`}>
                          ({option.sublabel})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <p className="text-sm text-[var(--color-slate)]">
                  Mostrando <span className="font-semibold text-[var(--foreground)]">{filteredRecipes.length}</span> de{" "}
                  <span className="font-semibold text-[var(--foreground)]">{recipes.length}</span> recetas
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="tag whitespace-nowrap transition-colors bg-[var(--color-slate-light)]/20 hover:bg-[var(--color-slate-light)]/30 text-[var(--color-slate)] flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Quitar filtros ({selectedTags.length})
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`tag whitespace-nowrap transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-[var(--color-purple)] text-white"
                    : "hover:bg-[var(--border-color)]"
                }`}
              >
                {selectedTags.includes(tag) && (
                  <svg className="w-3.5 h-3.5 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="recipe-card animate-pulse">
                <div className="aspect-[4/3] bg-[var(--color-purple-bg-dark)]" />
                <div className="p-4">
                  <div className="h-6 bg-[var(--color-purple-bg-dark)] rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[var(--color-purple-bg-dark)] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr">
            {filteredRecipes.map((recipe, i) => (
              <div
                key={recipe.id}
                className="animate-fade-in h-full"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <RecipeCard recipe={recipe} onTagClick={toggleTag} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-[var(--color-purple-bg-dark)] rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[var(--color-slate-light)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">
              {search || selectedTags.length > 0 || hasActiveFilters ? "No se encontraron recetas" : "Aún no hay recetas"}
            </h2>
            <p className="text-[var(--color-slate-light)] mb-6">
              {search || selectedTags.length > 0 || hasActiveFilters
                ? "Prueba con otra búsqueda o filtro"
                : "Añade tu primera receta para empezar"}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/recipes/new" className="btn-primary inline-flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir Receta
              </Link>
              <Link href="/recipes/import" className="btn-secondary inline-flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Importar Recetas
              </Link>
            </div>
          </div>
        )}
      </main>

      <BackupReminder />
      <BottomNav />
    </div>
  );
}
