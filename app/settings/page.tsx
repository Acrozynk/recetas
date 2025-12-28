"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import {
  markBackupCompleted,
  getLastBackupDate,
  getReminderDays,
  setReminderDays,
} from "@/components/BackupReminder";
import { supabase, type Container } from "@/lib/supabase";

type ExportFormat = "json" | "csv" | "markdown" | "html";

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
    id: "json",
    name: "JSON",
    description: "Formato completo, ideal para reimportar o programadores",
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
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [reminderDays, setReminderDaysState] = useState(14);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  
  // Container management
  const [containers, setContainers] = useState<Container[]>([]);
  const [newContainerName, setNewContainerName] = useState("");
  const [addingContainer, setAddingContainer] = useState(false);
  const [deletingContainerId, setDeletingContainerId] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
    loadContainers();
    setLastBackup(getLastBackupDate());
    setReminderDaysState(getReminderDays());
  }, []);

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
      const url = `/api/export?format=${selectedFormat}${ids ? `&ids=${ids}` : ""}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const filename = response.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || `recetas-backup${FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.extension}`;

      // Download the file
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      // Mark backup as completed
      markBackupCompleted();
      setLastBackup(new Date());
    } catch (error) {
      console.error("Export error:", error);
      alert("Error al exportar. Por favor, inténtalo de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  const handleReminderChange = (days: number) => {
    setReminderDaysState(days);
    setReminderDays(days);
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

      <main className="max-w-2xl mx-auto p-4 space-y-6">
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
                    <span className="text-sm font-medium text-[var(--foreground)] capitalize">
                      {container.name}
                    </span>
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

