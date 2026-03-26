"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { isSearchQueryEmpty, recipeTextMatchesQuery } from "@/lib/recipe-search";

interface InsertRecipeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (recipeId: string, title: string) => void;
  /** No permitir enlazar la receta que se está editando */
  excludeRecipeId?: string;
}

export default function InsertRecipeLinkModal({
  isOpen,
  onClose,
  onInsert,
  excludeRecipeId,
}: InsertRecipeLinkModalProps) {
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("recipes")
          .select("id, title")
          .order("title", { ascending: true });
        if (error) throw error;
        setRecipes(
          (data || []).filter((r) => r.id !== excludeRecipeId) as {
            id: string;
            title: string;
          }[]
        );
      } catch (e) {
        console.error(e);
        setRecipes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, excludeRecipeId]);

  const filtered = useMemo(() => {
    if (isSearchQueryEmpty(search)) return recipes.slice(0, 80);
    return recipes
      .filter((r) => recipeTextMatchesQuery({ title: r.title }, search))
      .slice(0, 80);
  }, [recipes, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-color)]">
        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
            Enlazar receta en el paso
          </h3>
          <p className="text-xs text-[var(--color-slate)] mt-1">
            Se insertará un enlace; sus ingredientes aparecerán abajo en la lista principal.
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar receta…"
            className="input w-full mt-3"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center text-sm text-[var(--color-slate)] py-8">
              Cargando…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-slate)] py-8">
              No hay recetas que coincidan.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(r.id, r.title);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--color-purple-bg)] text-[var(--foreground)] text-sm transition-colors"
                  >
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-3 border-t border-[var(--border-color)]">
          <button type="button" onClick={onClose} className="btn-secondary w-full">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
