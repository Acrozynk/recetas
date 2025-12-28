"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Recipe, type Ingredient, type Instruction, type Container, normalizeInstructions } from "@/lib/supabase";
import { 
  convertIngredient, 
  getSuggestedConversionUnit, 
  isVolumeUnit, 
  isWeightUnit,
  COMMON_UNITS 
} from "@/lib/unit-conversion";
import TagInput from "./TagInput";

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
  const [tags, setTags] = useState<string[]>(recipe?.tags || []);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(recipe?.rating ?? null);
  const [madeIt, setMadeIt] = useState(recipe?.made_it ?? false);
  
  // Container-based portions (for baking)
  const [containers, setContainers] = useState<Container[]>([]);
  const [useContainer, setUseContainer] = useState(!!recipe?.container_id);
  const [containerId, setContainerId] = useState<string | null>(recipe?.container_id || null);
  const [containerQuantity, setContainerQuantity] = useState(recipe?.container_quantity?.toString() || "1");
  const [newContainerName, setNewContainerName] = useState("");
  const [addingContainer, setAddingContainer] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (recipe?.ingredients as Ingredient[]) || Array.from({ length: 5 }, () => ({ name: "", amount: "", unit: "", amount2: "", unit2: "" }))
  );
  const [expandedIngredients, setExpandedIngredients] = useState<Set<number>>(new Set());
  
  // Variant labels for recipes with two sets of ingredient amounts
  const [variant1Label, setVariant1Label] = useState(recipe?.variant_1_label || "");
  const [variant2Label, setVariant2Label] = useState(recipe?.variant_2_label || "");
  const [showVariantLabels, setShowVariantLabels] = useState(!!recipe?.variant_1_label || !!recipe?.variant_2_label);
  const [instructions, setInstructions] = useState<Instruction[]>(
    recipe?.instructions 
      ? normalizeInstructions(recipe.instructions)
      : Array.from({ length: 5 }, () => ({ text: "", ingredientIndices: [] }))
  );
  const [notes, setNotes] = useState(recipe?.notes || "");

  // Fetch tag suggestions and containers on mount
  useEffect(() => {
    const fetchTags = async () => {
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
    
    const fetchContainers = async () => {
      try {
        const response = await fetch("/api/containers");
        if (response.ok) {
          const data = await response.json();
          setContainers(data.containers || []);
        }
      } catch (error) {
        console.error("Error fetching containers:", error);
      }
    };
    
    fetchTags();
    fetchContainers();
  }, []);

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
        setContainerId(data.container.id);
        setNewContainerName("");
      } else {
        const errorData = await response.json();
        console.error("Error adding container:", errorData.error);
      }
    } catch (error) {
      console.error("Error adding container:", error);
    } finally {
      setAddingContainer(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "", amount2: "", unit2: "" }]);
  };

  const addSectionHeader = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "", isHeader: true }]);
  };

  const toggleExpandedIngredient = (index: number) => {
    setExpandedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const autoConvertIngredient = (index: number) => {
    const ingredient = ingredients[index];
    if (!ingredient.amount || !ingredient.unit) return;

    // Determine target unit based on current unit
    const targetUnit = getSuggestedConversionUnit(ingredient.unit);
    
    const result = convertIngredient(
      ingredient.amount,
      ingredient.unit,
      targetUnit,
      ingredient.name
    );

    if (result.success) {
      const updated = [...ingredients];
      updated[index] = { 
        ...updated[index], 
        amount2: result.amount, 
        unit2: result.unit 
      };
      setIngredients(updated);
      
      // Expand to show the secondary measurement
      setExpandedIngredients(prev => new Set(prev).add(index));
    }
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
        // If using container, servings is null; otherwise use servings value
        servings: useContainer ? null : (servings ? parseInt(servings) : null),
        // Container fields
        container_id: useContainer ? containerId : null,
        container_quantity: useContainer && containerQuantity ? parseFloat(containerQuantity) : null,
        tags: tags.filter((t) => t.trim()),
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.filter((i) => i.text.trim()),
        notes: notes.trim() || null,
        rating: rating,
        made_it: madeIt,
        // Variant labels
        variant_1_label: showVariantLabels && variant1Label.trim() ? variant1Label.trim() : null,
        variant_2_label: showVariantLabels && variant2Label.trim() ? variant2Label.trim() : null,
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Portions: servings or container */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
              Porciones
            </label>
            
            {/* Toggle between servings and container */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUseContainer(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  !useContainer
                    ? "bg-[var(--color-purple)] text-white"
                    : "bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200"
                }`}
              >
                👥 Personas
              </button>
              <button
                type="button"
                onClick={() => setUseContainer(true)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  useContainer
                    ? "bg-[var(--color-purple)] text-white"
                    : "bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200"
                }`}
              >
                🍰 Recipiente
              </button>
            </div>
            
            {!useContainer ? (
              /* Servings input */
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="input"
                placeholder="4"
                min="1"
              />
            ) : (
              /* Container selection */
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={containerQuantity}
                    onChange={(e) => setContainerQuantity(e.target.value)}
                    className="input w-20"
                    placeholder="1"
                    min="0.5"
                    step="0.5"
                  />
                  <select
                    value={containerId || ""}
                    onChange={(e) => setContainerId(e.target.value || null)}
                    className="input flex-1"
                  >
                    <option value="">Selecciona recipiente...</option>
                    {containers.map((container) => (
                      <option key={container.id} value={container.id}>
                        {container.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Add new container inline */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddContainer())}
                    className="input flex-1 text-sm"
                    placeholder="Añadir nuevo recipiente..."
                    disabled={addingContainer}
                  />
                  <button
                    type="button"
                    onClick={handleAddContainer}
                    disabled={!newContainerName.trim() || addingContainer}
                    className="px-3 py-2 text-sm bg-[var(--color-purple-bg)] text-[var(--color-purple)] rounded-lg hover:bg-[var(--color-purple-bg-dark)] transition-colors disabled:opacity-50"
                  >
                    {addingContainer ? "..." : "+ Añadir"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Etiquetas
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              placeholder="Añadir etiqueta..."
            />
          </div>

          {/* Rating and Made It */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Rating (1-3 stars) */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                Valoración
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? null : star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    title={rating === star ? "Quitar valoración" : `${star} estrella${star > 1 ? 's' : ''}`}
                  >
                    <svg
                      className={`w-8 h-8 transition-colors ${
                        rating && star <= rating
                          ? "text-amber-400 fill-amber-400"
                          : "text-gray-300"
                      }`}
                      fill={rating && star <= rating ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                ))}
                {rating && (
                  <button
                    type="button"
                    onClick={() => setRating(null)}
                    className="ml-2 text-xs text-[var(--color-slate-light)] hover:text-[var(--color-slate)] transition-colors"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>

            {/* Made It checkbox */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
                Estado
              </label>
              <button
                type="button"
                onClick={() => setMadeIt(!madeIt)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  madeIt
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-white border-[var(--border-color)] text-[var(--color-slate)] hover:border-green-300"
                }`}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                  madeIt
                    ? "bg-green-500 border-green-500"
                    : "border-gray-300"
                }`}>
                  {madeIt && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="font-medium">¡Lo hice!</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Ingredientes</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVariantLabels(!showVariantLabels)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                showVariantLabels
                  ? "bg-[var(--color-purple)] text-white"
                  : "bg-[var(--color-purple-bg)] text-[var(--color-slate-light)] hover:text-[var(--color-purple)]"
              }`}
              title="Habilitar dos variantes de cantidad (ej: molde grande/pequeño)"
            >
              🍰 Variantes
            </button>
            <span className="text-xs text-[var(--color-slate-light)] bg-[var(--color-purple-bg)] px-2 py-1 rounded-full">
              💡 Usa ⇄ para convertir
            </span>
          </div>
        </div>

        {/* Variant labels */}
        {showVariantLabels && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700 mb-2">
              Define etiquetas para las dos cantidades (ej: &quot;Molde grande 26cm&quot; y &quot;Molde pequeño 16cm&quot;)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Cantidad principal
                </label>
                <input
                  type="text"
                  value={variant1Label}
                  onChange={(e) => setVariant1Label(e.target.value)}
                  className="input text-sm"
                  placeholder="Molde grande (26cm)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Cantidad alternativa
                </label>
                <input
                  type="text"
                  value={variant2Label}
                  onChange={(e) => setVariant2Label(e.target.value)}
                  className="input text-sm"
                  placeholder="Molde pequeño (16cm)"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => {
            const isExpanded = expandedIngredients.has(index);
            const hasSecondary = ingredient.amount2 || ingredient.unit2;
            const canConvert = ingredient.amount && ingredient.unit && 
              (isVolumeUnit(ingredient.unit) || isWeightUnit(ingredient.unit));
            
            // Render section header differently
            if (ingredient.isHeader) {
              return (
                <div key={index} className="flex gap-2 items-center pt-3 first:pt-0">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-amber-600">📋</span>
                    <input
                      type="text"
                      value={ingredient.name.replace(/^\*\*|\*\*$/g, '')}
                      onChange={(e) => updateIngredient(index, "name", e.target.value)}
                      className="input flex-1 font-semibold text-amber-800 bg-amber-50 border-amber-200"
                      placeholder="Nombre de la sección (ej: Para la base)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            }
            
            return (
              <div key={index} className="space-y-2">
                {/* Primary measurement row */}
                <div className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr,1fr,2fr] gap-2">
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                      className="input"
                      placeholder={showVariantLabels && variant1Label ? variant1Label.substring(0, 8) + "..." : "1"}
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
                  
                  {/* Convert button */}
                  <button
                    type="button"
                    onClick={() => canConvert ? autoConvertIngredient(index) : toggleExpandedIngredient(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      canConvert 
                        ? "text-[var(--color-purple)] hover:bg-[var(--color-purple-bg)] hover:text-[var(--color-purple)]" 
                        : "text-[var(--color-slate-light)] hover:text-[var(--color-slate)]"
                    }`}
                    title={canConvert ? "Convertir unidades automáticamente" : "Añadir medida alternativa"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                  
                  {/* Toggle expand button (show if has secondary, is expanded, or using variants) */}
                  {(hasSecondary || isExpanded || showVariantLabels) && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedIngredient(index)}
                      className="p-2 text-[var(--color-slate-light)] hover:text-[var(--color-slate)] transition-colors"
                      title={isExpanded ? "Ocultar medida alternativa" : "Mostrar medida alternativa"}
                    >
                      <svg className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  
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
                
                {/* Secondary measurement row (collapsed by default) */}
                {(isExpanded || hasSecondary) && (
                  <div className={`ml-4 flex gap-2 items-center pl-2 border-l-2 border-[var(--color-purple-bg-dark)] ${!isExpanded && hasSecondary ? 'opacity-60' : ''}`}>
                    <span className="text-xs text-[var(--color-slate-light)] font-medium whitespace-nowrap">
                      {showVariantLabels && variant2Label ? variant2Label.substring(0, 10) : "Alt"}:
                    </span>
                    <div className="flex-1 grid grid-cols-[1fr,1fr,2fr] gap-2">
                      <input
                        type="text"
                        value={ingredient.amount2 || ""}
                        onChange={(e) => updateIngredient(index, "amount2", e.target.value)}
                        className="input text-sm"
                        placeholder={showVariantLabels && variant2Label ? variant2Label.substring(0, 8) + "..." : "120"}
                      />
                      {showVariantLabels ? (
                        <input
                          type="text"
                          value={ingredient.unit2 || ""}
                          onChange={(e) => updateIngredient(index, "unit2", e.target.value)}
                          className="input text-sm"
                          placeholder="unidad"
                        />
                      ) : (
                        <select
                          value={ingredient.unit2 || ""}
                          onChange={(e) => updateIngredient(index, "unit2", e.target.value)}
                          className="input text-sm"
                        >
                          <option value="">unidad</option>
                          <optgroup label="Peso">
                            {COMMON_UNITS.weight.map(u => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Volumen">
                            {COMMON_UNITS.volume.map(u => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      )}
                      <span className="text-xs text-[var(--color-slate-light)] flex items-center">
                        {ingredient.name || "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...ingredients];
                        updated[index] = { ...updated[index], amount2: "", unit2: "" };
                        setIngredients(updated);
                        setExpandedIngredients(prev => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                      }}
                      className="p-1.5 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                      title="Eliminar medida alternativa"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-4">
          <button
            type="button"
            onClick={addIngredient}
            className="text-[var(--color-purple)] font-medium text-sm flex items-center gap-1 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Añadir ingrediente
          </button>
          <button
            type="button"
            onClick={addSectionHeader}
            className="text-amber-600 font-medium text-sm flex items-center gap-1 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Añadir sección
          </button>
        </div>
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

