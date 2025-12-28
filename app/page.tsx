"use client";

import { useEffect, useState } from "react";
import { supabase, type Recipe } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import RecipeCard from "@/components/RecipeCard";
import BackupReminder from "@/components/BackupReminder";
import Link from "next/link";

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
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

  // Filter recipes by search and tags
  const filteredRecipes = recipes.filter((recipe) => {
    const normalizedSearch = normalizeText(search);
    const matchesSearch =
      !search ||
      normalizeText(recipe.title).includes(normalizedSearch) ||
      normalizeText(recipe.description || "").includes(normalizedSearch);

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => recipe.tags && recipe.tags.includes(tag));

    return matchesSearch && matchesTags;
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

      <main className="max-w-4xl mx-auto p-4">
        {/* Search bar */}
        <div className="relative mb-4">
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
                Limpiar ({selectedTags.length})
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe, i) => (
              <div
                key={recipe.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <RecipeCard recipe={recipe} />
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
              {search || selectedTags.length > 0 ? "No se encontraron recetas" : "Aún no hay recetas"}
            </h2>
            <p className="text-[var(--color-slate-light)] mb-6">
              {search || selectedTags.length > 0
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
