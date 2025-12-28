"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Ingredient, type Instruction } from "@/lib/supabase";
import type { ParsedRecipe } from "@/lib/parse-copymthat";
import { detectRecipeLanguage } from "@/lib/translate";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import TagInput from "@/components/TagInput";

interface ImportRecipeEntry {
  original: ParsedRecipe;
  status: "pending" | "accepted" | "edited" | "discarded";
  edited: ParsedRecipe | null;
  imported_id: string | null;
  translated?: boolean; // Track if recipe was translated
}

interface ImportSession {
  id: string;
  source: string;
  total_recipes: number;
  current_index: number;
  status: "active" | "completed" | "abandoned";
  recipes: ImportRecipeEntry[];
  image_mapping: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  edited: number;
  discarded: number;
}

export default function ImportReviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<ImportSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [imagePreviews, setImagePreviews] = useState<Map<string, string>>(new Map());
  const [translating, setTranslating] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<"en" | "es" | "unknown">("unknown");

  // Edit form state
  const [editedRecipe, setEditedRecipe] = useState<ParsedRecipe | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Calculate stats
  const stats: Stats = session
    ? {
        total: session.recipes.length,
        pending: session.recipes.filter((r) => r.status === "pending").length,
        accepted: session.recipes.filter((r) => r.status === "accepted").length,
        edited: session.recipes.filter((r) => r.status === "edited").length,
        discarded: session.recipes.filter((r) => r.status === "discarded").length,
      }
    : { total: 0, pending: 0, accepted: 0, edited: 0, discarded: 0 };

  const currentRecipe = session?.recipes[session.current_index];
  const displayRecipe = isEditing && editedRecipe ? editedRecipe : currentRecipe?.original;

  // Load session and tag suggestions on mount
  useEffect(() => {
    loadSession();
    loadTagSuggestions();
  }, []);

  const loadTagSuggestions = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setTagSuggestions(data.tags || []);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  // Detect language when current recipe changes
  useEffect(() => {
    if (currentRecipe?.original) {
      const lang = detectRecipeLanguage(currentRecipe.original);
      setDetectedLanguage(lang);
    }
  }, [currentRecipe?.original, session?.current_index]);

  const loadSession = async () => {
    try {
      const response = await fetch("/api/import-session");
      const data = await response.json();

      if (data.session) {
        setSession(data.session);
        
        // Load image files from localStorage if available
        const storedImages = localStorage.getItem(`import-images-${data.session.id}`);
        if (storedImages) {
          // Images can't be stored in localStorage, so we just use the mapping
        }
      } else {
        setError("No hay sesión de importación activa. Por favor, sube un archivo primero.");
      }
    } catch (err) {
      console.error("Error loading session:", err);
      setError("Error al cargar la sesión de importación");
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!currentRecipe?.original) return;
    
    setTranslating(true);
    setError("");
    
    try {
      const response = await fetch("/api/translate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: currentRecipe.original }),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const { recipe: translatedRecipe, translated, message, method } = await response.json();
      
      console.log("Translation response:", { translated, method });
      console.log("Translated ingredients:", translatedRecipe?.ingredients);
      console.log("Original ingredients:", currentRecipe.original.ingredients);
      
      if (translated) {
        // Get original ingredients for fallback
        const originalIngredients = currentRecipe.original.ingredients || [];
        const translatedIngs = translatedRecipe?.ingredients || [];
        
        // Build validated ingredients with explicit fallbacks
        const validatedIngredients: Ingredient[] = [];
        
        // Use the longer array length to handle all cases
        const maxLength = Math.max(originalIngredients.length, translatedIngs.length);
        
        for (let i = 0; i < maxLength; i++) {
          const original = originalIngredients[i];
          const translated = translatedIngs[i];
          
          // Get name with multiple fallbacks
          let name = "";
          if (translated?.name && typeof translated.name === "string" && translated.name.trim().length > 0) {
            name = translated.name;
          } else if (original?.name && typeof original.name === "string" && original.name.trim().length > 0) {
            name = original.name;
          }
          
          // Get amount with fallback
          const amount = translated?.amount || original?.amount || "";
          
          // Get unit with fallback
          const unit = translated?.unit || original?.unit || "";
          
          console.log(`Ingredient ${i}: name="${name}", amount="${amount}", unit="${unit}"`);
          
          validatedIngredients.push({
            name,
            amount,
            unit,
          });
        }
        
        // Check if we have valid data after fallback
        const hasValidData = validatedIngredients.length > 0 && 
          validatedIngredients.every((ing) => ing.name && ing.name.trim().length > 0);
        
        if (!hasValidData) {
          console.error("Translation still has invalid data:", validatedIngredients);
          console.error("Will use original ingredients instead");
          
          // Last resort: use original ingredients directly
          const finalRecipe = {
            ...translatedRecipe,
            ingredients: originalIngredients.map((ing: Ingredient) => ({
              name: ing.name || "",
              amount: ing.amount || "",
              unit: ing.unit || "",
            })),
          };
          
          setEditedRecipe(finalRecipe);
          setIsEditing(true);
          setDetectedLanguage("es");
          setError("ℹ️ Los ingredientes no se pudieron traducir, se mantienen en original");
          return;
        }
        
        // Create final recipe with validated ingredients
        const finalRecipe = {
          ...translatedRecipe,
          ingredients: validatedIngredients,
        };
        
        console.log("Final recipe ingredients:", finalRecipe.ingredients);
        
        // Switch to edit mode with the translated recipe
        setEditedRecipe(finalRecipe);
        setIsEditing(true);
        setDetectedLanguage("es");
        
        // Show info about translation method
        if (method === "dictionary") {
          setError("ℹ️ Traducido con diccionario local (revisa y ajusta si es necesario)");
        }
      } else {
        setError(message || "La receta ya está en español");
      }
    } catch (err) {
      console.error("Translation error:", err);
      setError("Error al traducir. Prueba a editar manualmente.");
    } finally {
      setTranslating(false);
    }
  };

  const getImagePreview = useCallback((recipe: ParsedRecipe | undefined): string | null => {
    if (!recipe) return null;
    
    // Check uploaded image mapping first
    if (recipe.local_image_path && session?.image_mapping[recipe.local_image_path]) {
      return session.image_mapping[recipe.local_image_path];
    }
    
    // Check local previews
    if (recipe.local_image_path && imagePreviews.has(recipe.local_image_path)) {
      return imagePreviews.get(recipe.local_image_path) || null;
    }
    
    return recipe.image_url;
  }, [session?.image_mapping, imagePreviews]);

  const uploadImage = async (recipe: ParsedRecipe): Promise<string | null> => {
    if (!recipe.local_image_path) return recipe.image_url;
    
    // Check if already uploaded
    if (session?.image_mapping[recipe.local_image_path]) {
      return session.image_mapping[recipe.local_image_path];
    }

    const imageFile = imageFiles.get(recipe.local_image_path);
    if (!imageFile) return recipe.image_url;

    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Image upload failed");
        return recipe.image_url;
      }

      const { url } = await response.json();

      // Update image mapping in session
      await fetch("/api/import-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          action: "update_images",
          imageMapping: { [recipe.local_image_path]: url },
        }),
      });

      return url;
    } catch (err) {
      console.error("Error uploading image:", err);
      return recipe.image_url;
    }
  };

  const handleAccept = async () => {
    if (!session || !currentRecipe) return;
    setSaving(true);

    try {
      const recipe = currentRecipe.original;
      
      // Upload image if needed
      const imageUrl = await uploadImage(recipe);

      // Insert recipe into database
      const recipeData = {
        title: recipe.title,
        description: recipe.description,
        source_url: recipe.source_url,
        image_url: imageUrl,
        prep_time_minutes: recipe.prep_time_minutes,
        cook_time_minutes: recipe.cook_time_minutes,
        servings: recipe.servings,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        notes: recipe.notes,
        rating: recipe.rating,
        made_it: recipe.made_it,
        variant_1_label: recipe.variant_1_label,
        variant_2_label: recipe.variant_2_label,
      };

      const { data, error: insertError } = await supabase
        .from("recipes")
        .insert([recipeData])
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Update session
      const response = await fetch("/api/import-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "accept",
          recipeIndex: session.current_index,
          importedId: data?.id,
        }),
      });

      const result = await response.json();
      
      if (result.isComplete) {
        router.push("/recipes/import/complete");
      } else {
        setSession(result.session);
      }
    } catch (err) {
      console.error("Error accepting recipe:", err);
      setError("Error al guardar la receta");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    if (!currentRecipe) return;
    setEditedRecipe({ ...currentRecipe.original });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!session || !editedRecipe) return;
    setSaving(true);
    setError(""); // Clear any previous errors

    try {
      // Validate and clean ingredients - remove empty ones
      const cleanedIngredients = (editedRecipe.ingredients || [])
        .filter(ing => ing.name && ing.name.trim().length > 0)
        .map(ing => ({
          name: ing.name.trim(),
          amount: ing.amount?.trim() || "",
          unit: ing.unit?.trim() || "",
        }));

      if (cleanedIngredients.length === 0) {
        setError("La receta debe tener al menos un ingrediente");
        setSaving(false);
        return;
      }

      // Validate and clean instructions - remove empty ones
      const cleanedInstructions = (editedRecipe.instructions || [])
        .filter(inst => {
          const text = typeof inst === "string" ? inst : inst.text;
          return text && text.trim().length > 0;
        })
        .map(inst => ({
          text: (typeof inst === "string" ? inst : inst.text).trim(),
          ingredientIndices: [],
        }));

      if (cleanedInstructions.length === 0) {
        setError("La receta debe tener al menos una instrucción");
        setSaving(false);
        return;
      }

      // Validate title
      if (!editedRecipe.title || editedRecipe.title.trim().length === 0) {
        setError("La receta debe tener un título");
        setSaving(false);
        return;
      }

      // Upload image if needed
      const imageUrl = await uploadImage(editedRecipe);

      // Insert edited recipe into database
      const recipeData = {
        title: editedRecipe.title.trim(),
        description: editedRecipe.description?.trim() || null,
        source_url: editedRecipe.source_url || null,
        image_url: imageUrl,
        prep_time_minutes: editedRecipe.prep_time_minutes || null,
        cook_time_minutes: editedRecipe.cook_time_minutes || null,
        servings: editedRecipe.servings || null,
        tags: editedRecipe.tags || [],
        ingredients: cleanedIngredients,
        instructions: cleanedInstructions,
        notes: editedRecipe.notes?.trim() || null,
        rating: editedRecipe.rating || null,
        made_it: editedRecipe.made_it || false,
        variant_1_label: editedRecipe.variant_1_label || null,
        variant_2_label: editedRecipe.variant_2_label || null,
      };

      console.log("Saving recipe data:", recipeData);

      const { data, error: insertError } = await supabase
        .from("recipes")
        .insert([recipeData])
        .select("id")
        .single();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw new Error(insertError.message || "Error al insertar en base de datos");
      }

      // Update session
      const response = await fetch("/api/import-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "edit",
          recipeIndex: session.current_index,
          editedRecipe,
          importedId: data?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update session");
      }

      const result = await response.json();
      
      // Exit edit mode first
      setIsEditing(false);
      setEditedRecipe(null);
      
      if (result.isComplete) {
        router.push("/recipes/import/complete");
      } else if (result.session) {
        setSession(result.session);
      } else {
        // Fallback: reload session if response is unexpected
        await loadSession();
      }
    } catch (err) {
      console.error("Error saving edited recipe:", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al guardar: ${errorMessage}`);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!session) return;
    setSaving(true);

    try {
      const response = await fetch("/api/import-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "discard",
          recipeIndex: session.current_index,
        }),
      });

      const result = await response.json();
      
      if (result.isComplete) {
        router.push("/recipes/import/complete");
      } else {
        setSession(result.session);
      }
    } catch (err) {
      console.error("Error discarding recipe:", err);
      setError("Error al descartar la receta");
    } finally {
      setSaving(false);
    }
  };

  const handleNavigate = async (index: number) => {
    if (!session || index < 0 || index >= session.recipes.length) return;

    try {
      const response = await fetch("/api/import-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "navigate",
          recipeIndex: index,
        }),
      });

      const result = await response.json();
      setSession(result.session);
      setIsEditing(false);
      setEditedRecipe(null);
    } catch (err) {
      console.error("Error navigating:", err);
    }
  };

  const handlePauseAndExit = () => {
    // Session is automatically saved, just navigate away
    router.push("/recipes/import");
  };

  const handleAbandon = async () => {
    if (!session) return;
    
    if (!confirm("¿Estás seguro de que quieres abandonar esta importación? Se perderá todo el progreso.")) {
      return;
    }

    try {
      await fetch(`/api/import-session?id=${session.id}`, {
        method: "DELETE",
      });
      router.push("/recipes/import");
    } catch (err) {
      console.error("Error abandoning session:", err);
    }
  };

  // Handle image file upload for current recipe
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !displayRecipe?.local_image_path) return;

    const newImageFiles = new Map(imageFiles);
    newImageFiles.set(displayRecipe.local_image_path, file);
    setImageFiles(newImageFiles);

    const newPreviews = new Map(imagePreviews);
    newPreviews.set(displayRecipe.local_image_path, URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-[var(--color-slate)]">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Revisar Importación" showBack />
        <main className="max-w-2xl mx-auto p-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
          <button
            onClick={() => router.push("/recipes/import")}
            className="btn-primary mt-4 w-full"
          >
            Ir a Importar
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header title="Revisar Recetas" showBack />

      <main className="max-w-2xl mx-auto p-4">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--color-slate)]">
              Receta {(session?.current_index || 0) + 1} de {stats.total}
            </span>
            <span className="text-[var(--color-slate)]">
              {stats.total - stats.pending} revisadas
            </span>
          </div>
          <div className="h-2 bg-[var(--color-purple-bg-dark)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-purple)] transition-all duration-300"
              style={{ width: `${((stats.total - stats.pending) / stats.total) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600">✓ {stats.accepted + stats.edited} aceptadas</span>
            <span className="text-red-500">✗ {stats.discarded} descartadas</span>
            <span className="text-[var(--color-slate-light)]">○ {stats.pending} pendientes</span>
          </div>
        </div>

        {/* Recipe Navigation Pills */}
        <div className="mb-4 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {session?.recipes.map((r, i) => (
            <button
              key={i}
              onClick={() => handleNavigate(i)}
              className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-medium transition-all ${
                i === session.current_index
                  ? "bg-[var(--color-purple)] text-white"
                  : r.status === "accepted" || r.status === "edited"
                  ? "bg-green-100 text-green-700"
                  : r.status === "discarded"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Error message - shown at top when editing */}
        {error && isEditing && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            error.startsWith("ℹ️") 
              ? "bg-blue-50 border border-blue-200 text-blue-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {error}
          </div>
        )}

        {/* Current Recipe Card */}
        {displayRecipe && (
          <div className="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
            {/* Recipe Image */}
            {getImagePreview(displayRecipe) && (
              <div className="aspect-square relative bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImagePreview(displayRecipe)!}
                  alt={displayRecipe.title}
                  className="w-full h-full object-cover"
                />
                {currentRecipe?.status !== "pending" && (
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                    currentRecipe?.status === "accepted" || currentRecipe?.status === "edited"
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                  }`}>
                    {currentRecipe?.status === "accepted" ? "Aceptada" : 
                     currentRecipe?.status === "edited" ? "Editada" : "Descartada"}
                  </div>
                )}
              </div>
            )}

            <div className="p-4">
              {/* Title */}
              {isEditing ? (
                <input
                  type="text"
                  value={editedRecipe?.title || ""}
                  onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="input text-xl font-display font-semibold mb-2 w-full"
                />
              ) : (
                <h2 className="text-xl font-display font-semibold mb-2">{displayRecipe.title}</h2>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mb-4 text-sm text-[var(--color-slate)] items-center">
                {detectedLanguage === "en" && !isEditing && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    🇬🇧 English
                  </span>
                )}
                {displayRecipe.rating && (
                  <span>{"★".repeat(displayRecipe.rating)}{"☆".repeat(3 - displayRecipe.rating)}</span>
                )}
                {displayRecipe.made_it && <span className="text-green-600">✓ Hecho</span>}
                {isEditing ? (
                  <span className="flex items-center gap-1">
                    •
                    <input
                      type="number"
                      value={editedRecipe?.servings || ""}
                      onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, servings: e.target.value ? parseInt(e.target.value) : null } : null)}
                      className="input !w-16 !py-0.5 !px-2 text-center"
                      min="1"
                      placeholder="—"
                    />
                    porciones
                  </span>
                ) : (
                  displayRecipe.servings && <span>• {displayRecipe.servings} porciones</span>
                )}
                {displayRecipe.source_url && (
                  <a href={displayRecipe.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-purple)] hover:underline">
                    • Ver original
                  </a>
                )}
              </div>

              {/* Etiquetas */}
              {isEditing ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Etiquetas</label>
                  <TagInput
                    tags={editedRecipe?.tags || []}
                    onChange={(tags) => setEditedRecipe(prev => prev ? { ...prev, tags } : null)}
                    suggestions={tagSuggestions}
                  />
                </div>
              ) : displayRecipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {displayRecipe.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-[var(--color-purple-bg)] text-[var(--color-purple)] rounded text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {isEditing ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <textarea
                    value={editedRecipe?.description || ""}
                    onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="input w-full"
                    rows={2}
                  />
                </div>
              ) : displayRecipe.description && (
                <p className="text-[var(--color-slate)] mb-4">{displayRecipe.description}</p>
              )}

              {/* Variant labels - editable */}
              {isEditing ? (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-amber-800 text-sm font-medium">🍰 Variantes de cantidad</span>
                    {!editedRecipe?.variant_1_label && !editedRecipe?.variant_2_label && (
                      <button
                        type="button"
                        onClick={() => setEditedRecipe(prev => prev ? { 
                          ...prev, 
                          variant_1_label: "Cantidad grande",
                          variant_2_label: "Cantidad pequeña"
                        } : null)}
                        className="text-xs text-amber-700 hover:text-amber-900 underline"
                      >
                        + Añadir variantes
                      </button>
                    )}
                  </div>
                  {(editedRecipe?.variant_1_label || editedRecipe?.variant_2_label) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-amber-700 mb-1">Principal</label>
                        <input
                          type="text"
                          value={editedRecipe?.variant_1_label || ""}
                          onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, variant_1_label: e.target.value } : null)}
                          className="input text-sm w-full"
                          placeholder="Ej: Molde grande (26cm)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-amber-700 mb-1">Alternativa</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editedRecipe?.variant_2_label || ""}
                            onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, variant_2_label: e.target.value } : null)}
                            className="input text-sm flex-1"
                            placeholder="Ej: Molde pequeño (16cm)"
                          />
                          <button
                            type="button"
                            onClick={() => setEditedRecipe(prev => prev ? { 
                              ...prev, 
                              variant_1_label: "",
                              variant_2_label: ""
                            } : null)}
                            className="text-red-500 hover:text-red-700 px-2"
                            title="Eliminar variantes"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : displayRecipe.variant_1_label && displayRecipe.variant_2_label ? (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <span className="text-amber-800">🍰 Receta con variantes:</span>
                  <span className="font-medium ml-1">{displayRecipe.variant_1_label}</span>
                  <span className="text-amber-600"> / </span>
                  <span className="font-medium">{displayRecipe.variant_2_label}</span>
                </div>
              ) : null}

              {/* Ingredients */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Ingredientes ({displayRecipe.ingredients.length})</h3>
                {isEditing ? (
                  <div className="space-y-1">
                    {/* Button to add at the beginning */}
                    <button
                      onClick={() => {
                        const newIngredients = [{ amount: "", unit: "", name: "" }, ...(editedRecipe?.ingredients || [])];
                        setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                      }}
                      className="w-full py-1 text-xs text-[var(--color-slate-light)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg)] rounded transition-colors"
                    >
                      + insertar aquí
                    </button>
                    {editedRecipe?.ingredients.map((ing, i) => {
                      const hasVariants = editedRecipe?.variant_1_label || editedRecipe?.variant_2_label;
                      const hasSecondaryAmount = ing.amount2 || ing.unit2;
                      
                      return (
                        <div key={`ing-${i}`}>
                          {/* Primary amount row */}
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              defaultValue={ing.amount || ""}
                              onBlur={(e) => {
                                const newIngredients = [...(editedRecipe?.ingredients || [])];
                                newIngredients[i] = { ...newIngredients[i], amount: e.target.value };
                                setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                              }}
                              className="input !w-16 flex-shrink-0"
                              placeholder={hasVariants && editedRecipe?.variant_1_label ? editedRecipe.variant_1_label.substring(0, 6) : "Cant."}
                              autoComplete="off"
                            />
                            <input
                              type="text"
                              defaultValue={ing.unit || ""}
                              onBlur={(e) => {
                                const newIngredients = [...(editedRecipe?.ingredients || [])];
                                newIngredients[i] = { ...newIngredients[i], unit: e.target.value };
                                setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                              }}
                              className="input !w-24 flex-shrink-0"
                              placeholder="Unidad"
                              autoComplete="off"
                            />
                            <input
                              type="text"
                              defaultValue={ing.name || ""}
                              onBlur={(e) => {
                                const newIngredients = [...(editedRecipe?.ingredients || [])];
                                newIngredients[i] = { ...newIngredients[i], name: e.target.value };
                                setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                              }}
                              className="input flex-1 min-w-0 !w-auto"
                              placeholder="Ingrediente"
                              autoComplete="off"
                            />
                            {/* Toggle secondary amount button - only show if variants are enabled */}
                            {hasVariants && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newIngredients = [...(editedRecipe?.ingredients || [])];
                                  if (hasSecondaryAmount) {
                                    // Clear secondary amount
                                    newIngredients[i] = { ...newIngredients[i], amount2: "", unit2: "" };
                                  } else {
                                    // Add placeholder secondary amount
                                    newIngredients[i] = { ...newIngredients[i], amount2: "", unit2: ing.unit || "" };
                                  }
                                  setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                                }}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  hasSecondaryAmount 
                                    ? "bg-amber-100 text-amber-700" 
                                    : "text-[var(--color-slate-light)] hover:bg-amber-50 hover:text-amber-600"
                                }`}
                                title={hasSecondaryAmount ? "Ocultar cantidad alternativa" : "Añadir cantidad alternativa"}
                              >
                                ⇄
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const newIngredients = editedRecipe?.ingredients.filter((_, idx) => idx !== i) || [];
                                setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                              }}
                              className="text-red-500 hover:text-red-700 px-2"
                            >
                              ✕
                            </button>
                          </div>
                          
                          {/* Secondary amount row - only show if variants are enabled and this ingredient has secondary amounts */}
                          {hasVariants && hasSecondaryAmount && (
                            <div className="ml-4 mt-1 flex gap-2 items-center pl-2 border-l-2 border-amber-200">
                              <span className="text-xs text-amber-600 font-medium whitespace-nowrap w-12">
                                {editedRecipe?.variant_2_label?.substring(0, 8) || "Alt"}:
                              </span>
                              <input
                                type="text"
                                defaultValue={ing.amount2 || ""}
                                onBlur={(e) => {
                                  const newIngredients = [...(editedRecipe?.ingredients || [])];
                                  newIngredients[i] = { ...newIngredients[i], amount2: e.target.value };
                                  setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                                }}
                                className="input !w-16 flex-shrink-0 text-sm"
                                placeholder="Cant."
                                autoComplete="off"
                              />
                              <input
                                type="text"
                                defaultValue={ing.unit2 || ""}
                                onBlur={(e) => {
                                  const newIngredients = [...(editedRecipe?.ingredients || [])];
                                  newIngredients[i] = { ...newIngredients[i], unit2: e.target.value };
                                  setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                                }}
                                className="input !w-24 flex-shrink-0 text-sm"
                                placeholder="Unidad"
                                autoComplete="off"
                              />
                              <span className="text-xs text-[var(--color-slate-light)] truncate flex-1">
                                {ing.name || "—"}
                              </span>
                            </div>
                          )}
                          
                          {/* Button to add after this ingredient */}
                          <button
                            onClick={() => {
                              const newIngredients = [...(editedRecipe?.ingredients || [])];
                              newIngredients.splice(i + 1, 0, { amount: "", unit: "", name: "" });
                              setEditedRecipe(prev => prev ? { ...prev, ingredients: newIngredients } : null);
                            }}
                            className="w-full py-1 text-xs text-[var(--color-slate-light)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg)] rounded transition-colors"
                          >
                            + insertar aquí
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                    {displayRecipe.ingredients.map((ing, i) => {
                      const isHeader = ing.isHeader || ing.name.startsWith("**");
                      const headerName = isHeader ? ing.name.replace(/^\*\*|\*\*$/g, '') : ing.name;
                      
                      return (
                        <li key={i} className={isHeader ? "font-semibold mt-3 text-amber-700 border-b border-amber-200 pb-1" : ""}>
                          {isHeader ? (
                            headerName
                          ) : (
                            <>
                              {ing.amount && <span className="font-medium">{ing.amount}</span>}
                              {ing.unit && <span className="text-[var(--color-slate)]"> {ing.unit}</span>}
                              <span> {ing.name}</span>
                              {/* Show variant 2 amounts if they exist */}
                              {ing.amount2 && (
                                <span className="text-[var(--color-slate-light)] text-xs ml-2">
                                  (alt: {ing.amount2} {ing.unit2})
                                </span>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Instructions */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Instrucciones ({displayRecipe.instructions.length})</h3>
                {isEditing ? (
                  <div className="space-y-1">
                    {/* Button to add at the beginning */}
                    <button
                      onClick={() => {
                        const newInstructions = [{ text: "", ingredientIndices: [] }, ...(editedRecipe?.instructions || [])];
                        setEditedRecipe(prev => prev ? { ...prev, instructions: newInstructions } : null);
                      }}
                      className="w-full py-1 text-xs text-[var(--color-slate-light)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg)] rounded transition-colors"
                    >
                      + insertar paso aquí
                    </button>
                    {editedRecipe?.instructions.map((inst, i) => (
                      <div key={i}>
                        <div className="flex gap-2">
                          <span className="text-[var(--color-slate)] w-6 flex-shrink-0">{i + 1}.</span>
                          <textarea
                            value={typeof inst === "string" ? inst : inst.text}
                            onChange={(e) => {
                              const newInstructions = [...(editedRecipe?.instructions || [])];
                              newInstructions[i] = { text: e.target.value, ingredientIndices: [] };
                              setEditedRecipe(prev => prev ? { ...prev, instructions: newInstructions } : null);
                            }}
                            className="input flex-1"
                            rows={2}
                          />
                          <button
                            onClick={() => {
                              const newInstructions = editedRecipe?.instructions.filter((_, idx) => idx !== i) || [];
                              setEditedRecipe(prev => prev ? { ...prev, instructions: newInstructions } : null);
                            }}
                            className="text-red-500 hover:text-red-700 px-2"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Button to add after this instruction */}
                        <button
                          onClick={() => {
                            const newInstructions = [...(editedRecipe?.instructions || [])];
                            newInstructions.splice(i + 1, 0, { text: "", ingredientIndices: [] });
                            setEditedRecipe(prev => prev ? { ...prev, instructions: newInstructions } : null);
                          }}
                          className="w-full py-1 text-xs text-[var(--color-slate-light)] hover:text-[var(--color-purple)] hover:bg-[var(--color-purple-bg)] rounded transition-colors"
                        >
                          + insertar paso aquí
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ol className="space-y-2 text-sm max-h-48 overflow-y-auto">
                    {displayRecipe.instructions.map((inst, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[var(--color-slate)] w-6 flex-shrink-0">{i + 1}.</span>
                        <span>{typeof inst === "string" ? inst : inst.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Notes */}
              {(displayRecipe.notes || isEditing) && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Notas</h3>
                  {isEditing ? (
                    <textarea
                      value={editedRecipe?.notes || ""}
                      onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, notes: e.target.value } : null)}
                      className="input w-full"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-[var(--color-slate)] whitespace-pre-wrap">{displayRecipe.notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            error.startsWith("ℹ️") 
              ? "bg-blue-50 border border-blue-200 text-blue-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {error}
          </div>
        )}
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-[var(--border-color)] p-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          {currentRecipe?.status === "pending" ? (
            isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedRecipe(null);
                  }}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Translate button for English recipes */}
                {detectedLanguage === "en" && (
                  <button
                    onClick={handleTranslate}
                    disabled={translating || saving}
                    className="w-full py-2 px-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {translating ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Traduciendo...
                      </>
                    ) : (
                      <>
                        🌐 Traducir al Español
                      </>
                    )}
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDiscard}
                    disabled={saving || translating}
                    className="flex-1 py-3 px-4 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={saving || translating}
                    className="flex-1 py-3 px-4 rounded-lg border border-[var(--border-color)] text-[var(--foreground)] font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={saving || translating}
                    className="flex-1 py-3 px-4 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50"
                >
                    {saving ? "..." : "Aceptar"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex gap-3 items-center">
              <span className={`flex-1 text-center py-3 rounded-lg ${
                currentRecipe?.status === "accepted" || currentRecipe?.status === "edited"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {currentRecipe?.status === "accepted" ? "✓ Aceptada" :
                 currentRecipe?.status === "edited" ? "✓ Editada y guardada" : "✗ Descartada"}
              </span>
              {session && session.current_index < session.recipes.length - 1 && (
                <button
                  onClick={() => handleNavigate(session.current_index + 1)}
                  className="btn-primary"
                >
                  Siguiente →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pause/Exit options */}
      <div className="fixed top-16 right-4 flex gap-2">
        <button
          onClick={handlePauseAndExit}
          className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)]"
        >
          Pausar
        </button>
        <button
          onClick={handleAbandon}
          className="text-sm px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50"
        >
          Abandonar
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

