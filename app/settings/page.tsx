"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useSupermarkets } from "@/hooks/useSupermarkets";
import {
  type SupermarketConfig,
  uniqueSupermarketId,
  sanitizeHexColor,
  normalizeSupermarkets,
} from "@/lib/supermarkets";

type ExportFormat = "json" | "csv" | "markdown" | "html" | "all";

interface RecipeListItem {
  id: string;
  title: string;
  created_at: string;
  tags: string[];
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
  const [exportTitleSearch, setExportTitleSearch] = useState("");
  const [exportTagFilters, setExportTagFilters] = useState<Set<string>>(new Set());
  
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
  const [showTagsSection, setShowTagsSection] = useState(false);

  const {
    supermarkets,
    saveSupermarkets,
    loading: loadingSupermarkets,
  } = useSupermarkets();
  const [draftSupermarkets, setDraftSupermarkets] = useState<SupermarketConfig[]>([]);
  const [newSupermarketName, setNewSupermarketName] = useState("");
  const [newSupermarketColor, setNewSupermarketColor] = useState("#6366f1");
  const [supermarketsSaveState, setSupermarketsSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const skipSupermarketsAutoSaveRef = useRef(true);

  useEffect(() => {
    setDraftSupermarkets(supermarkets.map((s) => ({ ...s })));
    skipSupermarketsAutoSaveRef.current = true;
    const t = window.setTimeout(() => {
      skipSupermarketsAutoSaveRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [supermarkets]);

  useEffect(() => {
    if (skipSupermarketsAutoSaveRef.current) return;
    if (draftSupermarkets.length === 0) return;

    const normalized = normalizeSupermarkets(draftSupermarkets);
    if (JSON.stringify(normalized) === JSON.stringify(supermarkets)) {
      return;
    }

    if (normalized.filter((s) => s.enabled).length === 0) {
      setSupermarketsSaveState("error");
      return;
    }

    setSupermarketsSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        await saveSupermarkets(normalized);
        sessionStorage.setItem("recetas-supermarkets-changed", "1");
        setSupermarketsSaveState("saved");
        window.setTimeout(() => setSupermarketsSaveState("idle"), 2000);
      } catch (err) {
        console.error("Error auto-saving supermarkets:", err);
        setSupermarketsSaveState("error");
        alert(
          err instanceof Error ? err.message : "Error al guardar supermercados"
        );
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draftSupermarkets, supermarkets, saveSupermarkets]);

  useEffect(() => {
    loadRecipes();
    loadContainers();
    loadTags();
    loadBackupSettings();
  }, []);

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
        .select("id, title, created_at, tags")
        .order("title", { ascending: true });

      if (error) throw error;
      const list = (data || []).map((r) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
      }));
      setRecipes(list);
      // Select all by default
      setSelectedRecipes(new Set(list.map((r) => r.id)));
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

  const filteredExportRecipes = useMemo(() => {
    const query = exportTitleSearch.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (query && !recipe.title.toLowerCase().includes(query)) return false;
      if (exportTagFilters.size > 0) {
        if (!recipe.tags.some((tag) => exportTagFilters.has(tag))) return false;
      }
      return true;
    });
  }, [recipes, exportTitleSearch, exportTagFilters]);

  const exportFiltersActive =
    exportTitleSearch.trim().length > 0 || exportTagFilters.size > 0;

  const toggleExportTagFilter = (tag: string) => {
    setExportTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearExportFilters = () => {
    setExportTitleSearch("");
    setExportTagFilters(new Set());
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipes(new Set());
      setSelectAll(false);
    } else {
      setSelectedRecipes(new Set(recipes.map((r) => r.id)));
      setSelectAll(true);
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedRecipes(new Set(filteredExportRecipes.map((r) => r.id)));
    setSelectAll(false);
  };

  const handleSelectNone = () => {
    setSelectedRecipes(new Set());
    setSelectAll(false);
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

  const moveSupermarket = (index: number, direction: "up" | "down") => {
    setDraftSupermarkets((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return normalizeSupermarkets(next.map((s, i) => ({ ...s, sortOrder: i })));
    });
  };

  const updateDraftSupermarket = (
    id: string,
    patch: Partial<Pick<SupermarketConfig, "name" | "enabled" | "color">>
  ) => {
    setDraftSupermarkets((prev) => {
      let next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      if (patch.enabled === false) {
        const disabled = next.find((s) => s.id === id);
        if (disabled?.isDefault) {
          const replacement = next.find((s) => s.enabled);
          if (replacement) {
            next = next.map((s) => ({
              ...s,
              isDefault: s.id === replacement.id,
            }));
          }
        }
      }
      return normalizeSupermarkets(next);
    });
  };

  const setDefaultSupermarket = (id: string) => {
    setDraftSupermarkets((prev) =>
      normalizeSupermarkets(
        prev.map((s) => ({
          ...s,
          isDefault: s.id === id,
          enabled: s.id === id ? true : s.enabled,
        }))
      )
    );
  };

  const handleAddSupermarket = () => {
    const name = newSupermarketName.trim();
    if (!name) return;
    const color = sanitizeHexColor(newSupermarketColor) ?? "#6366f1";
    const id = uniqueSupermarketId(
      name,
      draftSupermarkets.map((s) => s.id)
    );
    setDraftSupermarkets((prev) =>
      normalizeSupermarkets([
        ...prev,
        {
          id,
          name,
          enabled: true,
          color,
          sortOrder: prev.length,
        },
      ])
    );
    setNewSupermarketName("");
    setNewSupermarketColor("#6366f1");
  };

  const handleRemoveSupermarket = (id: string) => {
    const store = draftSupermarkets.find((s) => s.id === id);
    if (!store) return;
    if (draftSupermarkets.length <= 1) {
      alert("Debe quedar al menos un supermercado en la lista.");
      return;
    }
    if (
      !window.confirm(
        `¿Eliminar "${store.name}" de la lista? Tus artículos e historial se conservan y volverán a aparecer si lo añades de nuevo con el mismo nombre.`
      )
    ) {
      return;
    }
    setDraftSupermarkets((prev) =>
      normalizeSupermarkets(
        prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, sortOrder: i }))
      )
    );
  };

  return (
    <div className="min-h-screen pb-bottom-nav">
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
                      : `${selectedRecipes.size} de ${recipes.length} seleccionadas`}
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
                  <div className="p-2 border-b border-[var(--border-color)] space-y-2">
                    <input
                      type="search"
                      value={exportTitleSearch}
                      onChange={(e) => setExportTitleSearch(e.target.value)}
                      placeholder="Buscar por título…"
                      className="input w-full py-1.5 text-sm"
                    />
                    {tags.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--color-slate)] mb-1.5">
                          Filtrar por etiqueta
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {tags.map((tag) => {
                            const active = exportTagFilters.has(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleExportTagFilter(tag)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                  active
                                    ? "bg-[var(--color-purple)] text-white"
                                    : "bg-[var(--color-purple-bg)] text-[var(--color-slate)] hover:bg-[var(--color-purple-bg-dark)]"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {exportFiltersActive && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--color-slate)]">
                          {filteredExportRecipes.length} de {recipes.length} recetas
                        </span>
                        <button
                          type="button"
                          onClick={clearExportFilters}
                          className="text-xs text-[var(--color-purple)] hover:underline"
                        >
                          Quitar filtros
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-[var(--color-purple-bg)] border-b border-[var(--border-color)] flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="checkbox"
                      />
                      <span className="text-sm font-medium">Todas ({recipes.length})</span>
                    </label>
                    {exportFiltersActive && filteredExportRecipes.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-sm text-[var(--color-purple-dark)] hover:underline"
                      >
                        Visibles ({filteredExportRecipes.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectNone}
                      className="text-sm text-[var(--color-slate)] hover:underline ml-auto"
                    >
                      Ninguna
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto">
                    {filteredExportRecipes.length === 0 ? (
                      <p className="text-sm text-[var(--color-slate-light)] text-center py-6 px-3">
                        No hay recetas que coincidan con la búsqueda.
                      </p>
                    ) : (
                      filteredExportRecipes.map((recipe) => (
                        <label
                          key={recipe.id}
                          className="flex items-start gap-2 p-2 hover:bg-[var(--color-purple-bg)] cursor-pointer border-b border-[var(--border-color)] last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecipes.has(recipe.id)}
                            onChange={() => toggleRecipe(recipe.id)}
                            className="checkbox mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-sm text-[var(--foreground)] block truncate">
                              {recipe.title}
                            </span>
                            {recipe.tags.length > 0 && (
                              <span className="flex flex-wrap gap-1 mt-0.5">
                                {recipe.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 text-[var(--color-slate)] border border-[var(--border-color)]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {recipe.tags.length > 4 && (
                                  <span className="text-[10px] text-[var(--color-slate-light)]">
                                    +{recipe.tags.length - 4}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        </label>
                      ))
                    )}
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

        {/* Supermarkets Section — just below Export for easy discovery */}
        <section className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Supermercados
                </h2>
                <p className="text-sm text-[var(--color-slate)]">
                  Activa, desactiva, elimina o elige cuál se abre por defecto
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 text-right min-w-[5rem]">
              {supermarketsSaveState === "saving" && (
                <span className="text-xs text-[var(--color-slate)]">
                  Guardando…
                </span>
              )}
              {supermarketsSaveState === "saved" && (
                <span className="text-xs text-emerald-600">Guardado</span>
              )}
              {supermarketsSaveState === "error" && (
                <span className="text-xs text-red-600">
                  Activa al menos uno
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {loadingSupermarkets ? (
              <p className="text-sm text-[var(--color-slate-light)] text-center py-4">
                Cargando supermercados…
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {draftSupermarkets.map((store, index) => (
                    <div
                      key={store.id}
                      className={`flex flex-wrap items-center gap-2 p-3 rounded-lg border ${
                        store.enabled
                          ? "bg-[var(--color-purple-bg)] border-[var(--border-color)]"
                          : "bg-gray-50 border-gray-200 opacity-75"
                      }`}
                    >
                      <input
                        type="color"
                        value={store.color}
                        onChange={(e) =>
                          updateDraftSupermarket(store.id, {
                            color: sanitizeHexColor(e.target.value) ?? store.color,
                          })
                        }
                        className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer p-0.5 bg-white flex-shrink-0"
                        title="Color"
                      />
                      <input
                        type="text"
                        value={store.name}
                        onChange={(e) =>
                          updateDraftSupermarket(store.id, { name: e.target.value })
                        }
                        className="input flex-1 min-w-[8rem] py-1.5 text-sm"
                      />
                      <label className="flex items-center gap-2 text-sm text-[var(--color-slate)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={store.enabled}
                          onChange={(e) =>
                            updateDraftSupermarket(store.id, {
                              enabled: e.target.checked,
                            })
                          }
                          className="checkbox"
                        />
                        Activo
                      </label>
                      <button
                        type="button"
                        onClick={() => setDefaultSupermarket(store.id)}
                        disabled={!store.enabled}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                          store.isDefault
                            ? "bg-amber-100 text-amber-800"
                            : "bg-white text-[var(--color-slate-light)] hover:bg-amber-50 disabled:opacity-40"
                        }`}
                        title="Abrir Compras en este supermercado"
                      >
                        {store.isDefault ? "★ Por defecto" : "Por defecto"}
                      </button>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => moveSupermarket(index, "up")}
                          disabled={index === 0}
                          className="p-1.5 text-[var(--color-slate-light)] hover:bg-white rounded disabled:opacity-30"
                          title="Subir"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSupermarket(index, "down")}
                          disabled={index === draftSupermarkets.length - 1}
                          className="p-1.5 text-[var(--color-slate-light)] hover:bg-white rounded disabled:opacity-30"
                          title="Bajar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSupermarket(store.id)}
                          className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar de la lista"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]">
                  <input
                    type="text"
                    value={newSupermarketName}
                    onChange={(e) => setNewSupermarketName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSupermarket()}
                    placeholder="Nuevo supermercado (ej: Carrefour)"
                    className="input flex-1 min-w-[10rem]"
                  />
                  <input
                    type="color"
                    value={newSupermarketColor}
                    onChange={(e) => setNewSupermarketColor(e.target.value)}
                    className="w-12 h-11 rounded-lg border border-[var(--border-color)] cursor-pointer p-0.5 bg-white"
                    title="Color"
                  />
                  <button
                    type="button"
                    onClick={handleAddSupermarket}
                    disabled={!newSupermarketName.trim()}
                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 font-medium"
                  >
                    + Añadir
                  </button>
                </div>

                <p className="text-xs text-[var(--color-slate-light)]">
                  Los cambios se guardan solos. Desactivar o eliminar un supermercado
                  solo lo oculta; al volver a añadirlo, conserva artículos e historial.
                </p>
              </>
            )}
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
          <button
            type="button"
            onClick={() => setShowTagsSection(!showTagsSection)}
            className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-purple-bg)]/40 transition-colors text-left"
          >
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
                  {tags.length === 0
                    ? "Edita las etiquetas de tus recetas"
                    : `${tags.length} etiqueta${tags.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-[var(--color-slate)] flex-shrink-0 transition-transform ${showTagsSection ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTagsSection && (
            <div className="p-4 pt-0 space-y-3 border-t border-[var(--border-color)]">
              {tags.length === 0 ? (
                <p className="text-sm text-[var(--color-slate-light)] text-center py-4">
                  No hay etiquetas aún. Añade etiquetas a tus recetas.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pt-4">
                  {tags.map((tag) => (
                    <div
                      key={tag}
                      className={`flex items-center justify-between gap-1 p-2 bg-[var(--color-purple-bg)] rounded-lg min-w-0 ${
                        editingTag === tag ? "sm:col-span-2" : ""
                      }`}
                    >
                      {editingTag === tag ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTag(tag);
                              if (e.key === "Escape") handleCancelEditTag();
                            }}
                            className="input flex-1 py-1 text-sm min-w-0"
                            autoFocus
                            disabled={savingTag === tag}
                          />
                          <button
                            onClick={() => handleSaveTag(tag)}
                            disabled={savingTag === tag || !editingTagName.trim()}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 flex-shrink-0"
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
                            className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                            title="Cancelar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-[var(--foreground)] truncate">
                            {tag}
                          </span>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleEditTag(tag)}
                              className="p-1 text-[var(--color-slate-light)] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar etiqueta"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag)}
                              disabled={deletingTag === tag}
                              className="p-1 text-[var(--color-slate-light)] hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Eliminar etiqueta"
                            >
                              {deletingTag === tag ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-[var(--color-slate-light)]">
                Al editar una etiqueta, se actualizará en todas las recetas que la usen.
              </p>
            </div>
          )}
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

