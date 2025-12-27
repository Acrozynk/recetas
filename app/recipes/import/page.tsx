"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseCopyMeThatExport, type ParsedRecipe } from "@/lib/parse-copymthat";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

type ImportMode = "file" | "url";

export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);

    try {
      const text = await file.text();
      const recipes = parseCopyMeThatExport(text);

      if (recipes.length === 0) {
        setError("No se encontraron recetas en este archivo. Asegúrate de que sea una exportación válida de CopyMeThat.");
      } else {
        setParsedRecipes(recipes);
        setSelectedRecipes(new Set(recipes.map((_, i) => i)));
      }
    } catch (err) {
      console.error("Error parsing file:", err);
      setError("Error al analizar el archivo. Asegúrate de que sea un archivo HTML válido.");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to import recipe");
      }

      const recipe = await response.json();
      setParsedRecipes([recipe]);
      setSelectedRecipes(new Set([0]));
    } catch (err) {
      console.error("Error importing from URL:", err);
      setError(err instanceof Error ? err.message : "Failed to import recipe from URL");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipe = (index: number) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRecipes(newSelected);
  };

  const toggleAll = () => {
    if (selectedRecipes.size === parsedRecipes.length) {
      setSelectedRecipes(new Set());
    } else {
      setSelectedRecipes(new Set(parsedRecipes.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (selectedRecipes.size === 0) return;

    setLoading(true);
    setImportProgress({ current: 0, total: selectedRecipes.size });

    try {
      const recipesToImport = parsedRecipes.filter((_, i) => selectedRecipes.has(i));
      let imported = 0;

      for (const recipe of recipesToImport) {
        const { error: insertError } = await supabase.from("recipes").insert([recipe]);

        if (insertError) {
          console.error("Error importing recipe:", insertError);
        } else {
          imported++;
        }

        setImportProgress({ current: imported, total: selectedRecipes.size });
      }

      // Navigate to home after import
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Error during import:", err);
      setError("Algunas recetas no se pudieron importar. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title="Importar Recetas" showBack />

      <main className="max-w-2xl mx-auto p-4">
        {/* Mode Selector */}
        {parsedRecipes.length === 0 && (
          <>
            <div className="flex rounded-lg bg-[var(--color-purple-bg-dark)] p-1 mb-6">
              <button
                onClick={() => setMode("file")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === "file"
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--color-slate)]"
                }`}
              >
                Desde Archivo
              </button>
              <button
                onClick={() => setMode("url")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === "url"
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--color-slate)]"
                }`}
              >
                Desde URL
              </button>
            </div>

            {mode === "file" ? (
              <div className="bg-white rounded-xl p-6 border border-[var(--border-color)]">
                <h2 className="font-display text-lg font-semibold mb-2">
                  Importar desde CopyMeThat
                </h2>
                <p className="text-[var(--color-slate)] text-sm mb-4">
                  Exporta tus recetas de CopyMeThat como HTML y sube el archivo aquí.
                </p>

                <ol className="list-decimal list-inside text-sm text-[var(--color-slate-light)] mb-6 space-y-1">
                  <li>Abre CopyMeThat y ve a Configuración</li>
                  <li>Selecciona &quot;Exportar Recetas&quot;</li>
                  <li>Elige formato HTML y descarga</li>
                  <li>Sube el archivo abajo</li>
                </ol>

                <label className="block">
                  <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--color-purple)] transition-colors">
                    <svg
                      className="w-12 h-12 mx-auto text-[var(--color-slate-light)] mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-[var(--color-slate)] font-medium">
                      Haz clic para subir archivo HTML
                    </p>
                    <p className="text-sm text-[var(--color-slate-light)] mt-1">
                      o arrastra y suelta
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".html,.htm"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 border border-[var(--border-color)]">
                <h2 className="font-display text-lg font-semibold mb-2">
                  Importar desde URL
                </h2>
                <p className="text-[var(--color-slate)] text-sm mb-4">
                  Pega una URL de receta y extraeremos los detalles automáticamente.
                </p>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input flex-1"
                    placeholder="https://example.com/recipe/..."
                    disabled={loading}
                  />
                  <button
                    onClick={handleUrlImport}
                    disabled={loading || !url.trim()}
                    className="btn-primary disabled:opacity-50"
                  >
                    {loading ? "..." : "Importar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !importProgress && (
          <div className="mt-6 text-center">
            <div className="inline-block w-8 h-8 border-4 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-[var(--color-slate)]">
              {mode === "file" ? "Analizando recetas..." : "Obteniendo receta..."}
            </p>
          </div>
        )}

        {/* Import Progress */}
        {importProgress && (
          <div className="mt-6 text-center">
            <div className="w-full bg-[var(--color-purple-bg-dark)] rounded-full h-2 mb-2">
              <div
                className="bg-[var(--color-purple)] h-2 rounded-full transition-all"
                style={{
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-[var(--color-slate)]">
              Importando {importProgress.current} de {importProgress.total} recetas...
            </p>
          </div>
        )}

        {/* Recipe Preview */}
        {parsedRecipes.length > 0 && !loading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">
                {parsedRecipes.length === 1 ? "Se encontró 1 receta" : `Se encontraron ${parsedRecipes.length} recetas`}
              </h2>
              {parsedRecipes.length > 1 && (
                <button
                  onClick={toggleAll}
                  className="text-sm text-[var(--color-purple)] hover:underline"
                >
                  {selectedRecipes.size === parsedRecipes.length
                    ? "Deseleccionar todo"
                    : "Seleccionar todo"}
                </button>
              )}
            </div>

            <div className="space-y-2 mb-6">
              {parsedRecipes.map((recipe, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRecipes.has(index)
                      ? "bg-purple-50 border-[var(--color-purple)]"
                      : "bg-white border-[var(--border-color)] hover:border-[var(--color-slate-light)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipes.has(index)}
                    onChange={() => toggleRecipe(index)}
                    className="checkbox mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--foreground)] truncate">
                      {recipe.title}
                    </h3>
                    <p className="text-sm text-[var(--color-slate-light)]">
                      {recipe.ingredients.length} ingredientes •{" "}
                      {recipe.instructions.length} pasos
                      {recipe.tags.length > 0 && ` • ${recipe.tags.join(", ")}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setParsedRecipes([]);
                  setSelectedRecipes(new Set());
                  setUrl("");
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={selectedRecipes.size === 0}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Importar {selectedRecipes.size} {selectedRecipes.size === 1 ? "Receta" : "Recetas"}
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

