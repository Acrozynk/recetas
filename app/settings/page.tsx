"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import UnitConverter from "@/components/UnitConverter";
import {
  markBackupCompleted,
  getLastBackupDate,
  getReminderDays,
  setReminderDays,
} from "@/components/BackupReminder";
import { supabase, type Container } from "@/lib/supabase";
import {
  buildLotesMigrationSnapshot,
  previewLotesMigration,
  restoreFromSnapshot,
  runLotesMigration,
  type LotesMigrationPreview,
  type LotesMigrationResult,
  type LotesMigrationSnapshot,
  type LotesRestoreResult,
} from "@/lib/lotes-migration";

type ExportFormat = "json" | "csv" | "markdown" | "html" | "all";

interface RecipeListItem {
  id: string;
  title: string;
  created_at: string;
}

interface FormatOption {
  id: ExportFormat;
  name: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "all",
    name: "Copia de Seguridad Completa",
    description: "Todos los formatos + imágenes en un ZIP",
    extension: ".zip",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    id: "json",
    name: "JSON",
    description: "Formato completo, ideal para reimportar",
    extension: ".json",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    id: "csv",
    name: "CSV / Excel",
    description: "Abre en Excel, Google Sheets o Numbers",
    extension: ".csv",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "markdown",
    name: "Markdown",
    description: "Texto legible, perfecto para documentación",
    extension: ".md",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "html",
    name: "HTML (Imprimible)",
    description: "Bonito para imprimir o ver en navegador",
    extension: ".html",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    ),
  },
];

const REMINDER_OPTIONS = [
  { value: 7, label: "Cada semana" },
  { value: 14, label: "Cada 2 semanas" },
  { value: 30, label: "Cada mes" },
  { value: 60, label: "Cada 2 meses" },
  { value: 90, label: "Cada 3 meses" },
];

export default function SettingsPage() {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("all");
  const [includeImages, setIncludeImages] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [reminderDays, setReminderDaysState] = useState(14);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  
  // Container management
  const [containers, setContainers] = useState<Container[]>([]);
  const [newContainerName, setNewContainerName] = useState("");
  const [addingContainer, setAddingContainer] = useState(false);
  const [deletingContainerId, setDeletingContainerId] = useState<string | null>(null);
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
  const [editingContainerName, setEditingContainerName] = useState("");
  const [savingContainerId, setSavingContainerId] = useState<string | null>(null);
  
  // Tags management
  const [tags, setTags] = useState<string[]>([]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  // Lotes → 1 lote migration
  const [lotesPreview, setLotesPreview] = useState<LotesMigrationPreview | null>(
    null
  );
  const [lotesPreviewError, setLotesPreviewError] = useState<string | null>(null);
  const [lotesMigrating, setLotesMigrating] = useState(false);
  const [lotesResult, setLotesResult] = useState<LotesMigrationResult | null>(
    null
  );
  const [lotesAutoBackup, setLotesAutoBackup] = useState(true);
  const [lotesRestoring, setLotesRestoring] = useState(false);
  const [lotesRestoreResult, setLotesRestoreResult] =
    useState<LotesRestoreResult | null>(null);
  const lotesRestoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadRecipes();
    loadContainers();
    loadTags();
    loadBackupSettings();
    loadLotesPreview();
  }, []);

  const loadLotesPreview = async () => {
    try {
      setLotesPreviewError(null);
      const preview = await previewLotesMigration();
      setLotesPreview(preview);
    } catch (err) {
      console.error("Error loading lotes migration preview:", err);
      setLotesPreviewError(
        err instanceof Error ? err.message : "Error desconocido"
      );
    }
  };

  const downloadLotesSnapshot = (
    snapshot: LotesMigrationSnapshot
  ): void => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    a.download = `lotes-snapshot-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunLotesMigration = async () => {
    if (!lotesPreview || lotesPreview.recipesToFix === 0) return;
    const ok = window.confirm(
      lotesAutoBackup
        ? `Se descargará un snapshot con el estado actual y luego se actualizarán ${lotesPreview.recipesToFix} receta(s) y se reescalarán ${lotesPreview.plansToFix} plan(es). Si algo sale mal, podrás restaurar con el archivo descargado. ¿Continuar?`
        : `Se van a actualizar ${lotesPreview.recipesToFix} receta(s) y reescalar ${lotesPreview.plansToFix} plan(es). NO se descargará ningún snapshot porque has desactivado la copia. ¿Continuar?`
    );
    if (!ok) return;
    setLotesMigrating(true);
    setLotesRestoreResult(null);
    try {
      if (lotesAutoBackup) {
        const snapshot = await buildLotesMigrationSnapshot();
        downloadLotesSnapshot(snapshot);
      }
      const result = await runLotesMigration();
      setLotesResult(result);
      await loadLotesPreview();
    } catch (err) {
      console.error("Error running lotes migration:", err);
      alert(
        `No se pudo completar la migración: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
    } finally {
      setLotesMigrating(false);
    }
  };

  const handleDownloadLotesSnapshot = async () => {
    try {
      const snapshot = await buildLotesMigrationSnapshot();
      if (snapshot.recipes.length === 0 && snapshot.mealPlans.length === 0) {
        alert(
          "No hay nada que respaldar: ninguna receta tiene lotes > 1 ahora mismo."
        );
        return;
      }
      downloadLotesSnapshot(snapshot);
    } catch (err) {
      console.error("Error building lotes snapshot:", err);
      alert(
        `No se pudo generar el snapshot: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
    }
  };

  const handleLotesRestoreFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;

    setLotesRestoring(true);
    setLotesRestoreResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LotesMigrationSnapshot;
      const ok = window.confirm(
        `Vas a restaurar ${parsed.recipes?.length ?? 0} receta(s) y ${
          parsed.mealPlans?.length ?? 0
        } plan(es) al estado guardado el ${
          parsed.createdAt
            ? new Date(parsed.createdAt).toLocaleString("es-ES")
            : "(fecha desconocida)"
        }. Esto SOBRESCRIBIRÁ los valores actuales de esas filas. ¿Continuar?`
      );
      if (!ok) return;
      const result = await restoreFromSnapshot(parsed);
      setLotesRestoreResult(result);
      setLotesResult(null);
      await loadLotesPreview();
    } catch (err) {
      console.error("Error restoring lotes snapshot:", err);
      alert(
        `No se pudo restaurar el snapshot: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
    } finally {
      setLotesRestoring(false);
    }
  };

  const loadBackupSettings = async () => {
    const [backupDate, days] = await Promise.all([
      getLastBackupDate(),
      getReminderDays(),
    ]);
    setLastBackup(backupDate);
    setReminderDaysState(days);
  };

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, created_at")
        .order("title", { ascending: true });

      if (error) throw error;
      setRecipes(data || []);
      // Select all by default
      setSelectedRecipes(new Set((data || []).map((r) => r.id)));
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
  };

  const loadContainers = async () => {
    try {
      const response = await fetch("/api/containers");
      if (response.ok) {
        const data = await response.json();
        setContainers(data.containers || []);
      }
    } catch (error) {
      console.error("Error loading containers:", error);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  const handleAddContainer = async () => {
    if (!newContainerName.trim()) return;
    
    setAddingContainer(true);
    try {
      const response = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newContainerName.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setContainers([...containers, data.container]);
        setNewContainerName("");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al añadir recipiente");
      }
    } catch (error) {
      console.error("Error adding container:", error);
    } finally {
      setAddingContainer(false);
    }
  };

  const handleDeleteContainer = async (id: string) => {
    setDeletingContainerId(id);
    try {
      const response = await fetch(`/api/containers?id=${id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setContainers(containers.filter(c => c.id !== id));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al eliminar recipiente");
      }
    } catch (error) {
      console.error("Error deleting container:", error);
    } finally {
      setDeletingContainerId(null);
    }
  };

  const handleEditContainer = (container: Container) => {
    setEditingContainerId(container.id);
    setEditingContainerName(container.name);
  };

  const handleCancelEditContainer = () => {
    setEditingContainerId(null);
    setEditingContainerName("");
  };

  const handleSaveContainer = async (id: string) => {
    if (!editingContainerName.trim()) return;
    
    setSavingContainerId(id);
    try {
      const response = await fetch("/api/containers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editingContainerName.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setContainers(containers.map(c => 
          c.id === id ? data.container : c
        ));
        setEditingContainerId(null);
        setEditingContainerName("");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al guardar recipiente");
      }
    } catch (error) {
      console.error("Error saving container:", error);
    } finally {
      setSavingContainerId(null);
    }
  };

  const handleEditTag = (tag: string) => {
    setEditingTag(tag);
    setEditingTagName(tag);
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditingTagName("");
  };

  const handleSaveTag = async (oldTag: string) => {
    if (!editingTagName.trim()) return;
    if (editingTagName.trim() === oldTag) {
      handleCancelEditTag();
      return;
    }
    
    setSavingTag(oldTag);
    try {
      const response = await fetch("/api/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldTag, newTag: editingTagName.trim() }),
      });
      
      if (response.ok) {
        // Reload tags to get fresh list
        await loadTags();
        setEditingTag(null);
        setEditingTagName("");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al guardar etiqueta");
      }
    } catch (error) {
      console.error("Error saving tag:", error);
    } finally {
      setSavingTag(null);
    }
  };

  const handleDeleteTag = async (tag: string) => {
    if (!confirm(`¿Eliminar la etiqueta "${tag}" de todas las recetas?`)) {
      return;
    }
    
    setDeletingTag(tag);
    try {
      const response = await fetch(`/api/tags?tag=${encodeURIComponent(tag)}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        await loadTags();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al eliminar etiqueta");
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
    } finally {
      setDeletingTag(null);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipes(new Set());
    } else {
      setSelectedRecipes(new Set(recipes.map((r) => r.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleRecipe = (id: string) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecipes(newSelected);
    setSelectAll(newSelected.size === recipes.length);
  };

  const handleExport = async () => {
    if (selectedRecipes.size === 0) return;

    setExporting(true);
    try {
      const ids = selectAll ? "" : Array.from(selectedRecipes).join(",");
      const params = new URLSearchParams({ format: selectedFormat });
      if (ids) params.set("ids", ids);
      // "all" format already includes images, no need to pass the flag
      if (includeImages && selectedFormat !== "all") params.set("include_images", "true");
      const url = `/api/export?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const isZip = selectedFormat === "all" || includeImages;
      const defaultExt = isZip ? ".zip" : FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.extension;
      const filename = response.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || `recetas-backup${defaultExt}`;

      // Download the file
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      // Mark backup as completed (syncs to Supabase for cross-device sync)
      await markBackupCompleted();
      setLastBackup(new Date());
    } catch (error) {
      console.error("Export error:", error);
      alert("Error al exportar. Por favor, inténtalo de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  const handleReminderChange = async (days: number) => {
    setReminderDaysState(days);
    await setReminderDays(days);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Nunca";
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title="Ajustes" showBack />

      <main className="max-w-7xl mx-auto p-4 lg:px-8 space-y-6">
        {/* Export Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-purple-bg)] rounded-lg flex items-center justify-center text-[var(--color-orange)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Exportar Recetas
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  {recipes.length} recetas disponibles
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Formato de exportación
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedFormat === format.id
                        ? "border-[var(--color-orange)] bg-[var(--color-purple-bg)]"
                        : "border-[var(--border-color)] hover:border-[var(--color-purple-muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={selectedFormat === format.id ? "text-[var(--color-orange)]" : "text-[var(--color-slate)]"}>
                        {format.icon}
                      </span>
                      <span className="font-medium text-[var(--foreground)]">{format.name}</span>
                    </div>
                    <p className="text-xs text-[var(--color-slate)]">{format.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Include Images Option - hidden when "all" is selected since it already includes images */}
            {selectedFormat !== "all" && (
              <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:bg-[var(--color-purple-bg)] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="checkbox"
                />
                <div className="flex items-center gap-2 flex-1">
                  <svg className="w-5 h-5 text-[var(--color-slate)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <span className="text-sm text-[var(--foreground)]">Incluir imágenes</span>
                    <p className="text-xs text-[var(--color-slate)]">
                      {includeImages ? "Se descargará un archivo ZIP" : "Solo datos de recetas"}
                    </p>
                  </div>
                </div>
              </label>
            )}

            {/* Recipe Selection Toggle */}
            <div>
              <button
                onClick={() => setShowRecipeSelector(!showRecipeSelector)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)] hover:bg-[var(--color-purple-bg)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--color-slate)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-sm text-[var(--foreground)]">
                    {selectAll
                      ? "Exportar todas las recetas"
                      : `${selectedRecipes.size} recetas seleccionadas`}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-[var(--color-slate)] transition-transform ${showRecipeSelector ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showRecipeSelector && (
                <div className="mt-2 border border-[var(--border-color)] rounded-lg overflow-hidden">
                  <div className="p-2 bg-[var(--color-purple-bg)] border-b border-[var(--border-color)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="checkbox"
                      />
                      <span className="text-sm font-medium">Seleccionar todas</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {recipes.map((recipe) => (
                      <label
                        key={recipe.id}
                        className="flex items-center gap-2 p-2 hover:bg-[var(--color-purple-bg)] cursor-pointer border-b border-[var(--border-color)] last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecipes.has(recipe.id)}
                          onChange={() => toggleRecipe(recipe.id)}
                          className="checkbox"
                        />
                        <span className="text-sm text-[var(--foreground)] truncate">
                          {recipe.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={exporting || selectedRecipes.size === 0}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exportando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar {selectedRecipes.size} {selectedRecipes.size === 1 ? "receta" : "recetas"}
                </>
              )}
            </button>
          </div>
        </section>

        {/* Containers Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                <span className="text-xl">🍰</span>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Recipientes de Repostería
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Moldes y bandejas para escalar recetas
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Container List */}
            <div className="space-y-2">
              {containers.length === 0 ? (
                <p className="text-sm text-[var(--color-slate-light)] text-center py-4">
                  No hay recipientes añadidos aún
                </p>
              ) : (
                containers.map((container) => (
                  <div
                    key={container.id}
                    className="flex items-center justify-between p-3 bg-[var(--color-purple-bg)] rounded-lg"
                  >
                    {editingContainerId === container.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingContainerName}
                          onChange={(e) => setEditingContainerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveContainer(container.id);
                            if (e.key === "Escape") handleCancelEditContainer();
                          }}
                          className="input flex-1 py-1 text-sm"
                          autoFocus
                          disabled={savingContainerId === container.id}
                        />
                        <button
                          onClick={() => handleSaveContainer(container.id)}
                          disabled={savingContainerId === container.id || !editingContainerName.trim()}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                          title="Guardar"
                        >
                          {savingContainerId === container.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEditContainer}
                          disabled={savingContainerId === container.id}
                          className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Cancelar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[var(--foreground)] capitalize">
                          {container.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditContainer(container)}
                            className="p-1.5 text-[var(--color-slate-light)] hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Editar recipiente"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteContainer(container.id)}
                            disabled={deletingContainerId === container.id}
                            className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Eliminar recipiente"
                          >
                            {deletingContainerId === container.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add New Container */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newContainerName}
                onChange={(e) => setNewContainerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddContainer()}
                placeholder="Nuevo recipiente (ej: molde rectangular)"
                className="input flex-1"
                disabled={addingContainer}
              />
              <button
                onClick={handleAddContainer}
                disabled={!newContainerName.trim() || addingContainer}
                className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50 font-medium"
              >
                {addingContainer ? "..." : "+ Añadir"}
              </button>
            </div>

            {/* Info */}
            <p className="text-xs text-[var(--color-slate-light)]">
              Los recipientes te permiten escalar recetas de repostería.
              Por ejemplo: duplicar ingredientes para hacer 2 moldes pequeños.
            </p>
          </div>
        </section>

        {/* Unit Converter Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Convertidor de Unidades
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Convierte entre gramos, tazas, cucharadas y más
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            <UnitConverter />
          </div>
        </section>

        {/* Tags Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Etiquetas
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Edita las etiquetas de tus recetas
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Tag List */}
            <div className="space-y-2">
              {tags.length === 0 ? (
                <p className="text-sm text-[var(--color-slate-light)] text-center py-4">
                  No hay etiquetas aún. Añade etiquetas a tus recetas.
                </p>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between p-3 bg-[var(--color-purple-bg)] rounded-lg"
                  >
                    {editingTag === tag ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTag(tag);
                            if (e.key === "Escape") handleCancelEditTag();
                          }}
                          className="input flex-1 py-1 text-sm"
                          autoFocus
                          disabled={savingTag === tag}
                        />
                        <button
                          onClick={() => handleSaveTag(tag)}
                          disabled={savingTag === tag || !editingTagName.trim()}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                          title="Guardar"
                        >
                          {savingTag === tag ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEditTag}
                          disabled={savingTag === tag}
                          className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Cancelar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {tag}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTag(tag)}
                            className="p-1.5 text-[var(--color-slate-light)] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar etiqueta"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            disabled={deletingTag === tag}
                            className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Eliminar etiqueta"
                          >
                            {deletingTag === tag ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Info */}
            <p className="text-xs text-[var(--color-slate-light)]">
              Al editar una etiqueta, se actualizará en todas las recetas que la usen.
            </p>
          </div>
        </section>

        {/* Backup Reminder Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-purple-bg)] rounded-lg flex items-center justify-center text-[var(--color-orange)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Recordatorio de Backup
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Te recordaremos hacer una copia de seguridad
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Last Backup Info */}
            <div className="flex items-center justify-between p-3 bg-[var(--color-purple-bg)] rounded-lg">
              <span className="text-sm text-[var(--foreground)]">Último backup:</span>
              <span className={`text-sm font-medium ${lastBackup ? "text-[var(--color-orange)]" : "text-[var(--color-red)]"}`}>
                {formatDate(lastBackup)}
              </span>
            </div>

            {/* Reminder Frequency */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Frecuencia del recordatorio
              </label>
              <select
                value={reminderDays}
                onChange={(e) => handleReminderChange(parseInt(e.target.value))}
                className="input"
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="p-4 bg-[var(--color-purple-bg)] rounded-xl border border-[var(--border-color)]">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-[var(--color-orange)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm text-[var(--color-slate)]">
              <p className="font-medium text-[var(--foreground)] mb-1">Consejo de seguridad</p>
              <p>
                Guarda tus backups en diferentes lugares: tu ordenador, un disco externo,
                o servicios como Google Drive o Dropbox. Así nunca perderás tus recetas favoritas.
              </p>
            </div>
          </div>
        </section>

        {/* Lotes Migration Section */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-purple-bg)] rounded-lg flex items-center justify-center text-[var(--color-orange)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Migrar lotes a 1 lote
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Elimina el concepto de lotes manteniendo lo que tienes planeado.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="text-sm text-[var(--color-slate)] space-y-2">
              <p>
                Las recetas guardadas con varios lotes se reescriben para representar
                un solo lote: sus ingredientes se dividen entre el número de lotes que
                tenían (por ejemplo, una receta con 3 lotes pasa a tener un tercio de
                cada ingrediente).
              </p>
              <p>
                Para que la lista de la compra y los menús que ya tienes planeados
                sigan dando lo mismo, los planes existentes se reescalan automáticamente
                (su multiplicador se multiplica por los lotes antiguos).
              </p>
            </div>

            {lotesPreviewError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                No se pudo comprobar el estado: {lotesPreviewError}
              </div>
            )}

            {lotesPreview && lotesPreview.recipesToFix === 0 && !lotesResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                No hay recetas con lotes &gt; 1. La migración ya está aplicada o no
                hace falta.
              </div>
            )}

            {lotesPreview && lotesPreview.recipesToFix > 0 && (
              <div className="p-3 rounded-lg bg-[var(--color-purple-bg)] border border-[var(--border-color)] text-sm text-[var(--foreground)] space-y-2">
                <p>
                  <strong>{lotesPreview.recipesToFix}</strong> receta(s) con lotes &gt; 1.{" "}
                  <strong>{lotesPreview.plansToFix}</strong> plan(es) de comida apuntan
                  a esas recetas y se reescalarán.
                </p>
                {lotesPreview.sampleRecipes.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-[var(--color-slate)]">
                    {lotesPreview.sampleRecipes.map((r) => (
                      <li key={r.id}>
                        {r.title} ({r.batchCount} lotes)
                      </li>
                    ))}
                    {lotesPreview.recipesToFix > lotesPreview.sampleRecipes.length && (
                      <li>
                        …y {lotesPreview.recipesToFix - lotesPreview.sampleRecipes.length}{" "}
                        más.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {lotesResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 space-y-2">
                <p>
                  <strong>{lotesResult.recipesUpdated}</strong> receta(s) actualizada(s) y{" "}
                  <strong>{lotesResult.plansUpdated}</strong> plan(es) reescalado(s).
                </p>
                {lotesResult.skippedRecipes.length > 0 && (
                  <div>
                    <p className="font-medium">Recetas omitidas:</p>
                    <ul className="list-disc list-inside text-xs">
                      {lotesResult.skippedRecipes.map((r) => (
                        <li key={r.id}>
                          {r.title}: {r.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {lotesRestoreResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 space-y-2">
                <p>
                  Restauradas <strong>{lotesRestoreResult.recipesRestored}</strong>{" "}
                  receta(s) y <strong>{lotesRestoreResult.plansRestored}</strong>{" "}
                  plan(es) desde el snapshot.
                </p>
                {lotesRestoreResult.errors.length > 0 && (
                  <div>
                    <p className="font-medium">Errores:</p>
                    <ul className="list-disc list-inside text-xs">
                      {lotesRestoreResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {lotesPreview && lotesPreview.recipesToFix > 0 && (
              <label className="flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-[var(--color-purple-bg)]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={lotesAutoBackup}
                  onChange={(e) => setLotesAutoBackup(e.target.checked)}
                  className="checkbox mt-0.5"
                />
                <span className="text-sm text-[var(--foreground)]">
                  Descargar un snapshot del estado actual antes de migrar (recomendado).
                  <span className="block text-xs text-[var(--color-slate)]">
                    Si algo se calcula mal, podrás restaurar con ese archivo desde el
                    botón de abajo.
                  </span>
                </span>
              </label>
            )}

            <button
              onClick={handleRunLotesMigration}
              disabled={
                lotesMigrating ||
                lotesRestoring ||
                !lotesPreview ||
                lotesPreview.recipesToFix === 0
              }
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-orange)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lotesMigrating
                ? "Migrando…"
                : lotesPreview && lotesPreview.recipesToFix > 0
                  ? `Migrar ${lotesPreview.recipesToFix} receta(s)`
                  : "Nada que migrar"}
            </button>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={handleDownloadLotesSnapshot}
                disabled={lotesMigrating || lotesRestoring}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--color-purple-bg)] transition-colors disabled:opacity-50"
              >
                Descargar snapshot ahora
              </button>
              <button
                type="button"
                onClick={() => lotesRestoreInputRef.current?.click()}
                disabled={lotesMigrating || lotesRestoring}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--color-purple-bg)] transition-colors disabled:opacity-50"
              >
                {lotesRestoring ? "Restaurando…" : "Restaurar desde snapshot…"}
              </button>
              <input
                ref={lotesRestoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleLotesRestoreFile}
              />
            </div>

            <p className="text-xs text-[var(--color-slate-light)]">
              Si quieres una red más amplia, antes haz también una{" "}
              <strong>Copia de Seguridad Completa</strong> en la sección de arriba:
              te guarda toda la base de datos.
            </p>
          </div>
        </section>

        {/* App Info */}
        <section className="text-center text-sm text-[var(--color-slate-light)] pt-4">
          <p>Recetas v1.0</p>
          <p>Hecho con ❤️ para organizar tus recetas</p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

