"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Recipe, type Ingredient, type Instruction, normalizeInstructions } from "@/lib/supabase";

interface RecipeFormProps {
  recipe?: Recipe;
  mode: "create" | "edit";
}

export default function RecipeForm({ recipe, mode }: RecipeFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(recipe?.title || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [imageUrl, setImageUrl] = useState(recipe?.image_url || "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url || "");
  
  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress image before upload
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Max dimensions
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          0.85 // 85% quality - good balance of size and quality
        );
      };
      
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploadError("");
    setUploading(true);

    try {
      // Compress the image first
      const compressedBlob = await compressImage(file);
      
      // Create a new file from the compressed blob
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^/.]+$/, ".jpg"), // Change extension to .jpg
        { type: "image/jpeg" }
      );

      const formData = new FormData();
      formData.append("file", compressedFile);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setImageUrl(result.url);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    } else {
      setUploadError("Please drop an image file");
    }
  };
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes?.toString() || "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes?.toString() || "");
  const [servings, setServings] = useState(recipe?.servings?.toString() || "4");
  const [tags, setTags] = useState(recipe?.tags?.join(", ") || "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (recipe?.ingredients as Ingredient[]) || Array.from({ length: 5 }, () => ({ name: "", amount: "", unit: "" }))
  );
  const [instructions, setInstructions] = useState<Instruction[]>(
    recipe?.instructions 
      ? normalizeInstructions(recipe.instructions)
      : Array.from({ length: 5 }, () => ({ text: "", ingredientIndices: [] }))
  );
  const [notes, setNotes] = useState(recipe?.notes || "");

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "" }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
      
      // Actualizar los índices de ingredientes en las instrucciones
      setInstructions(instructions.map(instruction => ({
        ...instruction,
        ingredientIndices: instruction.ingredientIndices
          .filter(i => i !== index)
          .map(i => i > index ? i - 1 : i)
      })));
    }
  };

  const addInstruction = () => {
    setInstructions([...instructions, { text: "", ingredientIndices: [] }]);
  };

  const updateInstructionText = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], text: value };
    setInstructions(updated);
  };

  const toggleIngredientInStep = (stepIndex: number, ingredientIndex: number) => {
    const updated = [...instructions];
    const currentIndices = updated[stepIndex].ingredientIndices;
    
    if (currentIndices.includes(ingredientIndex)) {
      updated[stepIndex] = {
        ...updated[stepIndex],
        ingredientIndices: currentIndices.filter(i => i !== ingredientIndex)
      };
    } else {
      updated[stepIndex] = {
        ...updated[stepIndex],
        ingredientIndices: [...currentIndices, ingredientIndex].sort((a, b) => a - b)
      };
    }
    setInstructions(updated);
  };

  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      setInstructions(instructions.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const recipeData = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        source_url: sourceUrl.trim() || null,
        prep_time_minutes: prepTime ? parseInt(prepTime) : null,
        cook_time_minutes: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.filter((i) => i.text.trim()),
        notes: notes.trim() || null,
      };

      if (mode === "edit" && recipe) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update(recipeData)
          .eq("id", recipe.id);

        if (updateError) throw updateError;
        router.push(`/recipes/${recipe.id}`);
      } else {
        const { data, error: insertError } = await supabase
          .from("recipes")
          .insert([recipeData])
          .select()
          .single();

        if (insertError) throw insertError;
        router.push(`/recipes/${data.id}`);
      }

      router.refresh();
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError("Error al guardar la receta. Por favor, inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-4">Información Básica</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Título de la receta"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder="Breve descripción de la receta"
              rows={2}
            />
          </div>

          {/* Image Section */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
              Imagen de la Receta
            </label>
            
            {/* Image Preview */}
            {imageUrl && (
              <div className="relative mb-3 rounded-lg overflow-hidden bg-gray-100 aspect-video max-w-xs">
                <img
                  src={imageUrl}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  title="Eliminar imagen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Upload Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                dragActive
                  ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                  : "border-gray-300 hover:border-gray-400"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-2">
                <div className="flex justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                
                {uploading ? (
                  <p className="text-sm text-[var(--color-slate)]">Subiendo...</p>
                ) : (
                  <>
                    <p className="text-sm text-[var(--color-slate)]">
                      Arrastra una imagen, o{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[var(--color-purple)] font-medium hover:underline"
                      >
                        selecciona
                      </button>
                    </p>
                    <p className="text-xs text-gray-400">
                      JPEG, PNG, WebP o GIF • Máximo 5MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}

            {/* URL Input (alternative) */}
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400">o pega una URL</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="input"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              URL de Origen
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
                Prep. (min)
              </label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="input"
                placeholder="15"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
                Cocción (min)
              </label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                className="input"
                placeholder="30"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
                Porciones
              </label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="input"
                placeholder="4"
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Etiquetas
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input"
              placeholder="Cena, Italiana, Rápida (separadas por coma)"
            />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-4">Ingredientes</h2>

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-[1fr,1fr,2fr] gap-2">
                <input
                  type="text"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                  className="input"
                  placeholder="1"
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                  className="input"
                  placeholder="taza"
                />
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, "name", e.target.value)}
                  className="input"
                  placeholder="Nombre del ingrediente"
                />
              </div>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-2 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                disabled={ingredients.length === 1}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addIngredient}
          className="mt-3 text-[var(--color-purple)] font-medium text-sm flex items-center gap-1 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir ingrediente
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-2">Instrucciones</h2>
        <p className="text-sm text-[var(--color-slate-light)] mb-4">
          Selecciona los ingredientes que intervienen en cada paso
        </p>

        <div className="space-y-4">
          {instructions.map((instruction, stepIndex) => (
            <div key={stepIndex} className="border border-[var(--border-color)] rounded-lg p-3 bg-[var(--color-purple-bg)]">
              <div className="flex gap-2 items-start mb-3">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-purple)] text-white text-sm font-medium mt-2">
                  {stepIndex + 1}
                </span>
                <textarea
                  value={instruction.text}
                  onChange={(e) => updateInstructionText(stepIndex, e.target.value)}
                  className="input flex-1 min-h-[60px] resize-y"
                  placeholder="Describe este paso..."
                  rows={2}
                />
                <button
                  type="button"
                  onClick={() => removeInstruction(stepIndex)}
                  className="p-2 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                  disabled={instructions.length === 1}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Ingredient chips for this step */}
              {ingredients.filter(i => i.name.trim()).length > 0 && (
                <div className="ml-8">
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map((ingredient, ingredientIndex) => {
                      if (!ingredient.name.trim()) return null;
                      const isSelected = instruction.ingredientIndices.includes(ingredientIndex);
                      return (
                        <button
                          key={ingredientIndex}
                          type="button"
                          onClick={() => toggleIngredientInStep(stepIndex, ingredientIndex)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-[var(--color-purple)] text-white shadow-sm"
                              : "bg-white border border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple)] hover:text-[var(--color-purple)]"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {ingredient.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addInstruction}
          className="mt-3 text-[var(--color-purple)] font-medium text-sm flex items-center gap-1 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir paso
        </button>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-4">Notas</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input min-h-[120px] resize-y"
          placeholder="Añade notas personales, consejos, variaciones o cualquier cosa que quieras recordar sobre esta receta..."
          rows={4}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 disabled:opacity-50"
          disabled={saving || !title.trim()}
        >
          {saving ? "Guardando..." : mode === "edit" ? "Actualizar Receta" : "Guardar Receta"}
        </button>
      </div>
    </form>
  );
}

