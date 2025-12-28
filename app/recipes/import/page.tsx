"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseCopyMeThatExport, type ParsedRecipe } from "@/lib/parse-copymthat";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

type ImportMode = "folder" | "file" | "url";

interface ActiveSession {
  id: string;
  total_recipes: number;
  current_index: number;
  recipes: {
    status: "pending" | "accepted" | "edited" | "discarded";
  }[];
  created_at: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("folder");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Check for active session on mount
  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const response = await fetch("/api/import-session");
      const data = await response.json();
      if (data.session && data.session.status === "active") {
        setActiveSession(data.session);
      }
    } catch (err) {
      console.error("Error checking session:", err);
    } finally {
      setCheckingSession(false);
    }
  };

  const getSessionStats = (session: ActiveSession) => {
    const reviewed = session.recipes.filter((r) => r.status !== "pending").length;
    const accepted = session.recipes.filter((r) => r.status === "accepted" || r.status === "edited").length;
    return { reviewed, accepted, total: session.total_recipes };
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setLoading(true);
    setLoadingStatus("Buscando archivos...");

    try {
      // Find the HTML file
      let htmlFile: File | null = null;
      const imageFiles = new Map<string, File>();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        const fileName = relativePath.split("/").pop()?.toLowerCase() || "";

        if (fileName === "recipes.html" || fileName.endsWith(".html")) {
          if (!htmlFile || fileName === "recipes.html") {
            htmlFile = file;
          }
        } else if (file.type.startsWith("image/")) {
          const pathParts = relativePath.split("/");
          const imagePath = pathParts.slice(-2).join("/");
          imageFiles.set(imagePath, file);
        }
      }

      if (!htmlFile) {
        setError("No se encontró el archivo recipes.html en la carpeta.");
        setLoading(false);
        setLoadingStatus("");
        return;
      }

      // Log image paths for debugging
      if (imageFiles.size > 0) {
        console.log("Found image files:", Array.from(imageFiles.keys()).slice(0, 5));
      }
      setLoadingStatus(`Encontradas ${imageFiles.size} imágenes. Analizando recetas...`);

      // Create session via API
      const formData = new FormData();
      formData.append("html", htmlFile);

      const response = await fetch("/api/import-session", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create session");
      }

      const { session } = await response.json();
      
      // Log recipe image paths for debugging
      const recipesWithLocalImages = session.recipes
        .filter((r: { original: { local_image_path: string | null } }) => r.original.local_image_path)
        .map((r: { original: { title: string; local_image_path: string } }) => ({
          title: r.original.title,
          path: r.original.local_image_path
        }));
      if (recipesWithLocalImages.length > 0) {
        console.log("Recipes expecting local images:", recipesWithLocalImages.slice(0, 5));
      }

      // Upload local images to storage so they're available during review
      if (imageFiles.size > 0) {
        const imageMapping: Record<string, string> = {};
        let uploadedCount = 0;
        
        // Upload images in parallel (batch of 5 at a time to avoid overwhelming the server)
        const imageEntries = Array.from(imageFiles.entries());
        const batchSize = 5;
        
        for (let i = 0; i < imageEntries.length; i += batchSize) {
          setLoadingStatus(`Subiendo imágenes... ${uploadedCount}/${imageFiles.size}`);
          const batch = imageEntries.slice(i, i + batchSize);
          const uploadPromises = batch.map(async ([localPath, file]) => {
            try {
              const uploadFormData = new FormData();
              uploadFormData.append("file", file);
              
              const uploadResponse = await fetch("/api/upload-image", {
                method: "POST",
                body: uploadFormData,
              });
              
              if (uploadResponse.ok) {
                const { url } = await uploadResponse.json();
                uploadedCount++;
                return { localPath, url };
              }
            } catch (err) {
              console.error(`Failed to upload image ${localPath}:`, err);
            }
            return null;
          });
          
          const results = await Promise.all(uploadPromises);
          results.forEach((result) => {
            if (result) {
              imageMapping[result.localPath] = result.url;
            }
          });
        }
        
        setLoadingStatus(`Subidas ${Object.keys(imageMapping).length} de ${imageFiles.size} imágenes`);
        
        // Update session with image mappings
        if (Object.keys(imageMapping).length > 0) {
          await fetch("/api/import-session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              action: "update_images",
              imageMapping,
            }),
          });
        }
      } else {
        setLoadingStatus("No se encontraron imágenes en la carpeta");
      }

      // Navigate to review page
      router.push("/recipes/import/review");
    } catch (err) {
      console.error("Error processing folder:", err);
      setError(err instanceof Error ? err.message : "Error al procesar la carpeta");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);

    try {
      // Create session via API
      const formData = new FormData();
      formData.append("html", file);

      const response = await fetch("/api/import-session", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create session");
      }

      // Navigate to review page
      router.push("/recipes/import/review");
    } catch (err) {
      console.error("Error parsing file:", err);
      setError(err instanceof Error ? err.message : "Error al analizar el archivo");
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
      
      // For single URL imports, save directly
      const { error: insertError } = await supabase.from("recipes").insert([recipe]);
      
      if (insertError) throw insertError;

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Error importing from URL:", err);
      setError(err instanceof Error ? err.message : "Failed to import recipe from URL");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSession = () => {
    router.push("/recipes/import/review");
  };

  const handleAbandonSession = async () => {
    if (!activeSession) return;

    if (!confirm("¿Estás seguro de que quieres abandonar esta importación? Se perderá todo el progreso.")) {
      return;
    }

    try {
      await fetch(`/api/import-session?id=${activeSession.id}`, {
        method: "DELETE",
      });
      setActiveSession(null);
    } catch (err) {
      console.error("Error abandoning session:", err);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Importar Recetas" showBack />
        <main className="max-w-2xl mx-auto p-4 flex justify-center pt-20">
          <div className="inline-block w-8 h-8 border-4 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Header title="Importar Recetas" showBack />

      <main className="max-w-2xl mx-auto p-4">
        {/* Active Session Banner */}
        {activeSession && (
          <div className="bg-[var(--color-purple-bg)] border border-[var(--color-purple)] rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">
                  Importación en Progreso
                </h3>
                <p className="text-sm text-[var(--color-slate)] mt-1">
                  Tienes una importación sin terminar
                </p>
              </div>
              <span className="text-xs text-[var(--color-slate-light)]">
                {new Date(activeSession.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>{getSessionStats(activeSession).reviewed} de {activeSession.total_recipes} revisadas</span>
                <span className="text-green-600">{getSessionStats(activeSession).accepted} aceptadas</span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-purple)] transition-all"
                  style={{ width: `${(getSessionStats(activeSession).reviewed / activeSession.total_recipes) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAbandonSession}
                className="flex-1 py-2 px-4 rounded-lg border border-[var(--color-slate-light)] text-[var(--color-slate)] font-medium hover:bg-white"
              >
                Abandonar
              </button>
              <button
                onClick={handleResumeSession}
                className="flex-1 py-2 px-4 rounded-lg bg-[var(--color-purple)] text-white font-medium hover:opacity-90"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex rounded-lg bg-[var(--color-purple-bg-dark)] p-1 mb-6">
          <button
            onClick={() => setMode("folder")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === "folder"
                ? "bg-white text-[var(--foreground)] shadow-sm"
                : "text-[var(--color-slate)]"
            }`}
          >
            Carpeta
          </button>
          <button
            onClick={() => setMode("file")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === "file"
                ? "bg-white text-[var(--foreground)] shadow-sm"
                : "text-[var(--color-slate)]"
            }`}
          >
            Archivo
          </button>
          <button
            onClick={() => setMode("url")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === "url"
                ? "bg-white text-[var(--foreground)] shadow-sm"
                : "text-[var(--color-slate)]"
            }`}
          >
            URL
          </button>
        </div>

        {mode === "folder" ? (
          <div className="bg-white rounded-xl p-6 border border-[var(--border-color)]">
            <h2 className="font-display text-lg font-semibold mb-2">
              Importar Carpeta de CopyMeThat
            </h2>
            <p className="text-[var(--color-slate)] text-sm mb-4">
              Selecciona la carpeta de exportación para revisar cada receta individualmente.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>💡 Modo Revisión:</strong> Podrás aceptar, editar o descartar cada receta.
                Puedes pausar y continuar en cualquier momento.
              </p>
            </div>

            <ol className="list-decimal list-inside text-sm text-[var(--color-slate-light)] mb-6 space-y-1">
              <li>En CopyMeThat, ve a Configuración → Exportar</li>
              <li>Descarga y descomprime el archivo ZIP</li>
              <li>Selecciona la carpeta descomprimida abajo</li>
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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <p className="text-[var(--color-slate)] font-medium">
                  Haz clic para seleccionar carpeta
                </p>
                <p className="text-sm text-[var(--color-slate-light)] mt-1">
                  (incluye imágenes)
                </p>
              </div>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is not in standard types
                webkitdirectory="true"
                directory="true"
                onChange={handleFolderUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        ) : mode === "file" ? (
          <div className="bg-white rounded-xl p-6 border border-[var(--border-color)]">
            <h2 className="font-display text-lg font-semibold mb-2">
              Importar Archivo HTML
            </h2>
            <p className="text-[var(--color-slate)] text-sm mb-4">
              Sube solo el archivo recipes.html para revisar cada receta.
            </p>

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

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-6 text-center">
            <div className="inline-block w-8 h-8 border-4 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-[var(--color-slate)]">
              {loadingStatus || (mode === "folder" ? "Procesando carpeta..." : mode === "file" ? "Analizando recetas..." : "Obteniendo receta...")}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
