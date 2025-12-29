"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  
  // Fraction input state
  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const lastCursorPositionRef = useRef<number>(0);
  
  // Common fractions for easy insertion
  const FRACTIONS = [
    { label: "⅛", value: "⅛" },
    { label: "¼", value: "¼" },
    { label: "⅓", value: "⅓" },
    { label: "⅜", value: "⅜" },
    { label: "½", value: "½" },
    { label: "⅔", value: "⅔" },
    { label: "¾", value: "¾" },
    { label: "°", value: "°" },
  ];
  
  // Insert fraction at cursor position
  const insertFraction = useCallback((fraction: string) => {
    const input = lastFocusedInputRef.current;
    if (!input) return;
    
    const start = lastCursorPositionRef.current;
    const currentValue = input.value;
    const newValue = currentValue.slice(0, start) + fraction + currentValue.slice(start);
    
    // Create and dispatch input event to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, newValue);
      const event = new Event("input", { bubbles: true });
      input.dispatchEvent(event);
    }
    
    // Restore focus and cursor position
    requestAnimationFrame(() => {
      input.focus();
      const newPosition = start + fraction.length;
      input.setSelectionRange(newPosition, newPosition);
      lastCursorPositionRef.current = newPosition;
    });
  }, []);
  
  // Track focus on inputs
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    lastFocusedInputRef.current = e.target;
    lastCursorPositionRef.current = e.target.selectionStart || 0;
  }, []);
  
  const handleInputSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    lastCursorPositionRef.current = target.selectionStart || 0;
  }, []);

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
  // Portion type: 'personas' (just number), 'unidades' (number + custom unit), 'recipiente' (container)
  const [portionType, setPortionType] = useState<'personas' | 'unidades' | 'recipiente'>(
    recipe?.container_id ? 'recipiente' : recipe?.servings_unit ? 'unidades' : 'personas'
  );
  // Support for multiple containers (each with quantity)
  // Note: containers list is loaded async, so we initialize empty and populate in useEffect
  const [selectedContainers, setSelectedContainers] = useState<Array<{ id: string; quantity: string }>>([]);
  const [newContainerName, setNewContainerName] = useState("");
  const [addingContainer, setAddingContainer] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (recipe?.ingredients as Ingredient[]) || Array.from({ length: 5 }, () => ({ name: "", amount: "", unit: "", amount2: "", unit2: "" }))
  );
  const [expandedIngredients, setExpandedIngredients] = useState<Set<number>>(new Set());
  // Track which ingredients have their alternative section expanded
  const [showAlternative, setShowAlternative] = useState<Set<number>>(() => {
    // Initialize with indices of ingredients that already have alternatives
    const initial = new Set<number>();
    if (recipe?.ingredients) {
      (recipe.ingredients as Ingredient[]).forEach((ing, idx) => {
        if (ing.alternative?.name) {
          initial.add(idx);
        }
      });
    }
    return initial;
  });
  
  // State for moving section headers (click-based, more reliable than drag & drop)
  const [movingSectionIndex, setMovingSectionIndex] = useState<number | null>(null);
  
  // Variant labels for recipes with two sets of ingredient amounts
  // These are now derived from selected containers when in 'recipiente' mode
  const variant1Label = selectedContainers[0] 
    ? containers.find(c => c.id === selectedContainers[0].id)?.name || ""
    : "";
  const variant2Label = selectedContainers[1]
    ? containers.find(c => c.id === selectedContainers[1].id)?.name || ""
    : "";
  const showVariantLabels = selectedContainers.length >= 2;
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

  // Initialize selectedContainers after containers list is loaded
  useEffect(() => {
    if (containers.length === 0 || selectedContainers.length > 0) return;
    
    const initial: Array<{ id: string; quantity: string }> = [];
    
    // Add primary container
    if (recipe?.container_id) {
      initial.push({ 
        id: recipe.container_id, 
        quantity: recipe.container_quantity?.toString() || "1" 
      });
    }
    
    // Add second container from variant_2_label (find by name)
    if (recipe?.variant_2_label) {
      const secondContainer = containers.find(c => c.name === recipe.variant_2_label);
      if (secondContainer && secondContainer.id !== recipe?.container_id) {
        initial.push({ id: secondContainer.id, quantity: "1" });
      }
    }
    
    if (initial.length > 0) {
      setSelectedContainers(initial);
    }
  }, [containers, recipe, selectedContainers.length]);

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
        // Auto-add to selected containers if less than 2 selected
        if (selectedContainers.length < 2) {
          setSelectedContainers([...selectedContainers, { id: data.container.id, quantity: "1" }]);
        }
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

  // Add a container to selection
  const addContainerToSelection = (containerId: string) => {
    if (!containerId || selectedContainers.some(c => c.id === containerId)) return;
    setSelectedContainers([...selectedContainers, { id: containerId, quantity: "1" }]);
  };

  // Remove a container from selection
  const removeContainerFromSelection = (containerId: string) => {
    setSelectedContainers(selectedContainers.filter(c => c.id !== containerId));
  };

  // Update container quantity
  const updateContainerQuantity = (containerId: string, quantity: string) => {
    setSelectedContainers(selectedContainers.map(c => 
      c.id === containerId ? { ...c, quantity } : c
    ));
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "", amount2: "", unit2: "" }]);
  };

  // Insert ingredient at specific position
  const insertIngredientAt = (index: number) => {
    const newIngredient = { name: "", amount: "", unit: "", amount2: "", unit2: "" };
    const newIngredients = [
      ...ingredients.slice(0, index),
      newIngredient,
      ...ingredients.slice(index)
    ];
    setIngredients(newIngredients);
    
    // Update instruction indices for ingredients after the insertion point
    setInstructions(instructions.map(instruction => ({
      ...instruction,
      ingredientIndices: instruction.ingredientIndices.map(i => i >= index ? i + 1 : i)
    })));
  };

  const addSectionHeader = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "", isHeader: true }]);
  };

  // Start moving a section (click-based)
  const startMovingSection = (headerIndex: number) => {
    setMovingSectionIndex(headerIndex);
  };

  // Cancel moving
  const cancelMovingSection = () => {
    setMovingSectionIndex(null);
  };

  // Place section at target position
  const placeSection = (targetPosition: number) => {
    if (movingSectionIndex !== null) {
      moveSectionToPosition(movingSectionIndex, targetPosition);
      setMovingSectionIndex(null);
    }
  };

  // Move entire section (header + all ingredients until next header)
  const moveSectionToPosition = (sourceHeaderIndex: number, targetPosition: number) => {
    if (sourceHeaderIndex === targetPosition || sourceHeaderIndex === targetPosition - 1) return;
    
    // Find where this section ends (next header or end of list)
    let sectionEndIndex = sourceHeaderIndex + 1;
    while (sectionEndIndex < ingredients.length && !ingredients[sectionEndIndex].isHeader) {
      sectionEndIndex++;
    }
    
    // Extract the entire section (header + its ingredients)
    const sectionToMove = ingredients.slice(sourceHeaderIndex, sectionEndIndex);
    
    // Create new array without the section
    const withoutSection = [
      ...ingredients.slice(0, sourceHeaderIndex),
      ...ingredients.slice(sectionEndIndex)
    ];
    
    // Adjust target position if it's after the removed section
    let adjustedTarget = targetPosition;
    if (targetPosition > sourceHeaderIndex) {
      adjustedTarget = targetPosition - sectionToMove.length;
    }
    
    // Insert section at new position
    const newIngredients = [
      ...withoutSection.slice(0, adjustedTarget),
      ...sectionToMove,
      ...withoutSection.slice(adjustedTarget)
    ];
    
    // Build index mapping for instruction updates
    const indexMapping = new Map<number, number>();
    ingredients.forEach((ing, oldIdx) => {
      const newIdx = newIngredients.indexOf(ing);
      if (newIdx !== -1) {
        indexMapping.set(oldIdx, newIdx);
      }
    });
    
    setIngredients(newIngredients);
    setInstructions(instructions.map(instruction => ({
      ...instruction,
      ingredientIndices: instruction.ingredientIndices
        .map(i => indexMapping.get(i) ?? i)
        .sort((a, b) => a - b)
    })));
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

  const toggleShowAlternative = (index: number) => {
    setShowAlternative(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        // Clear the alternative when hiding
        const updated = [...ingredients];
        updated[index] = { ...updated[index], alternative: undefined };
        setIngredients(updated);
      } else {
        next.add(index);
        // Initialize empty alternative
        const updated = [...ingredients];
        if (!updated[index].alternative) {
          updated[index] = { ...updated[index], alternative: { name: "", amount: "", unit: "" } };
          setIngredients(updated);
        }
      }
      return next;
    });
  };

  const updateAlternative = (index: number, field: "name" | "amount" | "unit", value: string) => {
    const updated = [...ingredients];
    const currentAlt = updated[index].alternative || { name: "", amount: "", unit: "" };
    updated[index] = { 
      ...updated[index], 
      alternative: { ...currentAlt, [field]: value }
    };
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

  const addInstructionSectionHeader = () => {
    setInstructions([...instructions, { text: "", ingredientIndices: [], isHeader: true }]);
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

  // Get ingredient sections (groups of ingredients under each header)
  const getIngredientSections = () => {
    const sections: Array<{ name: string; startIndex: number; ingredientIndices: number[] }> = [];
    let currentSection: { name: string; startIndex: number; ingredientIndices: number[] } | null = null;
    
    ingredients.forEach((ingredient, index) => {
      if (ingredient.isHeader) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = { name: ingredient.name || 'Sin nombre', startIndex: index, ingredientIndices: [] };
      } else if (ingredient.name.trim()) {
        if (currentSection) {
          currentSection.ingredientIndices.push(index);
        } else {
          // Ingredients before any header - create default section
          if (sections.length === 0 || sections[sections.length - 1].name !== 'Ingredientes') {
            currentSection = { name: 'Ingredientes', startIndex: -1, ingredientIndices: [index] };
          } else {
            sections[sections.length - 1].ingredientIndices.push(index);
          }
        }
      }
    });
    
    // Don't forget the last section
    if (currentSection && currentSection.ingredientIndices.length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  // Toggle all ingredients in a section for a step
  const toggleSectionInStep = (stepIndex: number, sectionIndices: number[]) => {
    const updated = [...instructions];
    const currentIndices = updated[stepIndex].ingredientIndices;
    
    // Check if ALL ingredients in the section are already selected
    const allSelected = sectionIndices.every(idx => currentIndices.includes(idx));
    
    if (allSelected) {
      // Remove all ingredients in this section
      updated[stepIndex] = {
        ...updated[stepIndex],
        ingredientIndices: currentIndices.filter(i => !sectionIndices.includes(i))
      };
    } else {
      // Add all ingredients in this section
      const newIndices = [...new Set([...currentIndices, ...sectionIndices])].sort((a, b) => a - b);
      updated[stepIndex] = {
        ...updated[stepIndex],
        ingredientIndices: newIndices
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
        servings: portionType === 'recipiente' ? null : (servings ? parseInt(servings) : null),
        // "unidades" marker when using unit-based portions, null = personas
        servings_unit: portionType === 'unidades' ? "unidades" : null,
        // Container fields - use first selected container as primary
        container_id: portionType === 'recipiente' && selectedContainers[0] ? selectedContainers[0].id : null,
        container_quantity: portionType === 'recipiente' && selectedContainers[0] ? parseFloat(selectedContainers[0].quantity) : null,
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

      {/* Top Save Buttons (only in edit mode) */}
      {mode === "edit" && (
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
            {saving ? "Guardando..." : "Actualizar Receta"}
          </button>
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
            
            {/* Toggle between personas, unidades, and container */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPortionType('personas')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  portionType === 'personas'
                    ? "bg-[var(--color-purple)] text-white"
                    : "bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200"
                }`}
              >
                👥 Personas
              </button>
              <button
                type="button"
                onClick={() => setPortionType('unidades')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  portionType === 'unidades'
                    ? "bg-[var(--color-purple)] text-white"
                    : "bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200"
                }`}
              >
                🔢 Unidades
              </button>
              <button
                type="button"
                onClick={() => setPortionType('recipiente')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  portionType === 'recipiente'
                    ? "bg-[var(--color-purple)] text-white"
                    : "bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200"
                }`}
              >
                🍰 Recipiente
              </button>
            </div>
            
            {portionType === 'personas' ? (
              /* Servings input - just number of people */
              <div className="space-y-2">
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="input w-full"
                  placeholder="4"
                  min="1"
                />
              </div>
            ) : portionType === 'unidades' ? (
              /* Servings input - just number of units */
              <div className="space-y-2">
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="input w-full"
                  placeholder="10"
                  min="1"
                />
              </div>
            ) : (
              /* Container selection - supports multiple */
              <div className="space-y-3">
                {/* Selected containers list */}
                {selectedContainers.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs text-[var(--color-slate-light)]">
                      Recipientes seleccionados {selectedContainers.length >= 2 && <span className="text-amber-600">(variantes activas)</span>}
                    </label>
                    {selectedContainers.map((selected, idx) => {
                      const container = containers.find(c => c.id === selected.id);
                      return (
                        <div 
                          key={selected.id} 
                          className={`grid items-center gap-2 p-2 rounded-lg border ${idx === 0 ? 'bg-[var(--color-purple-bg)] border-[var(--color-purple)]' : 'bg-amber-50 border-amber-300'}`}
                          style={{ gridTemplateColumns: '24px 50px 1fr 24px' }}
                        >
                          <span>{idx === 0 ? '🥇' : '🥈'}</span>
                          <input
                            type="number"
                            value={selected.quantity}
                            onChange={(e) => updateContainerQuantity(selected.id, e.target.value)}
                            className="text-center text-sm py-1 px-1 rounded-md border border-[var(--border-color)]"
                            style={{ backgroundColor: 'white', color: '#451A03', width: '50px' }}
                            placeholder="1"
                            min="0.5"
                            step="0.5"
                          />
                          <span className="text-sm text-[var(--foreground)]">
                            {container?.name || 'Recipiente no encontrado'}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeContainerFromSelection(selected.id)}
                            className="p-1 text-[var(--color-slate-light)] hover:text-red-600 transition-colors justify-self-end"
                            title="Quitar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Add container selector */}
                <div>
                  <label className="block text-xs text-[var(--color-slate-light)] mb-1">
                    {selectedContainers.length === 0 ? 'Selecciona un recipiente' : 'Añadir otro recipiente (para variante)'}
                  </label>
                  <select
                    value=""
                    onChange={(e) => addContainerToSelection(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">-- Selecciona recipiente --</option>
                    {containers
                      .filter(c => !selectedContainers.some(sc => sc.id === c.id))
                      .map((container) => (
                        <option key={container.id} value={container.id}>
                          {container.name}
                        </option>
                      ))}
                  </select>
                  {containers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No hay recipientes. Añade uno nuevo abajo.
                    </p>
                  )}
                  {selectedContainers.length >= 2 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Con 2 recipientes, puedes añadir cantidades alternativas en los ingredientes
                    </p>
                  )}
                </div>
                
                {/* Add new container inline */}
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <label className="block text-xs text-[var(--color-slate-light)] mb-1">
                    Crear nuevo recipiente
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newContainerName}
                      onChange={(e) => setNewContainerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newContainerName.trim()) {
                            handleAddContainer();
                          }
                        }
                      }}
                      className="input flex-1"
                      placeholder="Ej: Molde redondo 26cm"
                      disabled={addingContainer}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newContainerName.trim()) {
                          handleAddContainer();
                        }
                      }}
                      disabled={!newContainerName.trim() || addingContainer}
                      className="px-4 py-2 bg-[var(--color-purple)] text-white rounded-lg hover:bg-[var(--color-purple-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                    >
                      {addingContainer ? "Añadiendo..." : "+ Añadir"}
                    </button>
                  </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Ingredientes</h2>
          <div className="flex items-center gap-2">
            {showVariantLabels && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                🍰 {variant1Label} / {variant2Label}
              </span>
            )}
            <span className="text-xs text-[var(--color-slate-light)] bg-[var(--color-purple-bg)] px-2 py-1 rounded-full">
              💡 Usa ⇄ para convertir
            </span>
          </div>
        </div>
        
        {/* Fraction buttons toolbar - sticky */}
        <div className="flex items-center gap-2 mb-4 pb-3 pt-3 -mt-3 border-b border-[var(--border-color)] sticky top-0 z-10 bg-[var(--background)]">
          <span className="text-sm text-[var(--color-slate-light)] mr-1">Fracciones:</span>
          {FRACTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => insertFraction(f.value)}
              className="px-3 py-2 text-lg font-medium bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] text-[var(--color-purple)] rounded-lg transition-colors min-w-[44px]"
              title={`Insertar ${f.label}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Variant info banner - shows when 2+ containers selected */}
        {showVariantLabels && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700">
              📐 <strong>Variantes activas:</strong> Usa el botón <span className="inline-flex items-center px-1 py-0.5 bg-white rounded border">↓</span> en cada ingrediente para añadir la cantidad alternativa para <strong>{variant2Label}</strong>
            </p>
          </div>
        )}

        <div className="space-y-3">
          {/* Info banner when moving a section */}
          {movingSectionIndex !== null && (
            <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-center justify-between">
              <span className="text-sm text-amber-800 font-medium">
                📋 Moviendo sección completa: <strong>{ingredients[movingSectionIndex].name || 'Sección'}</strong> — Haz click en una zona amarilla para colocarla
              </span>
              <button
                type="button"
                onClick={cancelMovingSection}
                className="text-amber-600 hover:text-amber-800 text-sm font-medium"
              >
                ✕ Cancelar
              </button>
            </div>
          )}
          
          {/* Drop zone at the very beginning */}
          {movingSectionIndex !== null && movingSectionIndex !== 0 && (
            <button
              type="button"
              onClick={() => placeSection(0)}
              className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-sm font-medium">⬆️ Colocar aquí (al principio)</span>
            </button>
          )}
          {ingredients.map((ingredient, index) => {
            const isExpanded = expandedIngredients.has(index);
            const hasSecondary = ingredient.amount2 || ingredient.unit2;
            const canConvert = ingredient.amount && ingredient.unit && 
              (isVolumeUnit(ingredient.unit) || isWeightUnit(ingredient.unit));
            
            // Render section header differently
            if (ingredient.isHeader) {
              const isBeingMoved = movingSectionIndex === index;
              // Show drop zone before this header if we're moving a DIFFERENT section header
              const showDropZone = movingSectionIndex !== null && 
                movingSectionIndex !== index && 
                movingSectionIndex !== index - 1;
              
              return (
                <div key={index}>
                  {/* Drop zone before this section */}
                  {showDropZone && (
                    <button
                      type="button"
                      onClick={() => placeSection(index)}
                      className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-2 mb-2"
                    >
                      <span className="text-sm font-medium">📋 Colocar sección aquí</span>
                    </button>
                  )}
                  <div 
                    className={`flex gap-2 items-center pt-3 first:pt-0 rounded-lg transition-all ${
                      isBeingMoved ? "opacity-50 bg-amber-100 ring-2 ring-amber-400" : ""
                    }`}
                  >
                    {/* Move button */}
                    <button
                      type="button"
                      onClick={() => movingSectionIndex === index ? cancelMovingSection() : startMovingSection(index)}
                      className={`p-2 -m-1 rounded transition-colors ${
                        isBeingMoved 
                          ? "text-amber-700 bg-amber-200" 
                          : "text-amber-400 hover:text-amber-600 hover:bg-amber-100"
                      }`}
                      title={isBeingMoved ? "Cancelar movimiento" : "Mover esta sección"}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                    
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
                </div>
              );
            }
            
            // Show drop zone before regular ingredients too (when moving a section header)
            const showIngredientDropZone = movingSectionIndex !== null && 
              movingSectionIndex !== index &&
              movingSectionIndex !== index - 1;
            
            return (
              <div key={index} className="space-y-2 group/ingredient">
                {/* Drop zone before this ingredient */}
                {showIngredientDropZone && (
                  <button
                    type="button"
                    onClick={() => placeSection(index)}
                    className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-sm font-medium">📋 Colocar sección aquí</span>
                  </button>
                )}
                {/* Insert button - shows on hover */}
                {movingSectionIndex === null && (
                  <button
                    type="button"
                    onClick={() => insertIngredientAt(index)}
                    className="w-full py-1 opacity-0 group-hover/ingredient:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[var(--color-purple)] hover:text-[var(--color-purple-dark)]"
                    title="Insertar ingrediente aquí"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs">Insertar aquí</span>
                  </button>
                )}
                {/* Primary measurement row - horizontal layout with CSS Grid */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '70px 100px 1fr' }}>
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                      onFocus={handleInputFocus}
                      onSelect={handleInputSelect}
                      className="input text-center"
                      placeholder="1"
                    />
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                      onFocus={handleInputFocus}
                      onSelect={handleInputSelect}
                      className="input"
                      placeholder="g"
                      list="unit-suggestions"
                    />
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, "name", e.target.value)}
                      onFocus={handleInputFocus}
                      onSelect={handleInputSelect}
                      className="input"
                      placeholder="Nombre del ingrediente"
                    />
                  </div>
                  
                  {/* Convert button */}
                  <button
                    type="button"
                    onClick={() => canConvert ? autoConvertIngredient(index) : toggleExpandedIngredient(index)}
                    className={`p-2 shrink-0 rounded-lg transition-colors ${
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
                      className="p-2 shrink-0 text-[var(--color-slate-light)] hover:text-[var(--color-slate)] transition-colors"
                      title={isExpanded ? "Ocultar medida alternativa" : "Mostrar medida alternativa"}
                    >
                      <svg className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Alternative ingredient toggle button */}
                  <button
                    type="button"
                    onClick={() => toggleShowAlternative(index)}
                    className={`p-2 shrink-0 rounded-lg transition-colors font-bold text-sm ${
                      showAlternative.has(index)
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-[var(--color-slate-light)] hover:text-emerald-600 hover:bg-emerald-50"
                    }`}
                    title={showAlternative.has(index) ? "Quitar alternativa" : "Añadir ingrediente alternativo (ej: polvo de hornear o bicarbonato)"}
                  >
                    o
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 shrink-0 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                    disabled={ingredients.length === 1}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Alternative ingredient row */}
                {showAlternative.has(index) && (
                  <div className="ml-4 flex items-center gap-2 pl-2 border-l-2 border-emerald-300 bg-emerald-50/50 rounded-r-lg py-2 pr-2">
                    <span className="text-xs text-emerald-700 font-medium" style={{ width: '20px' }}>
                      o
                    </span>
                    <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '60px 90px 1fr' }}>
                      <input
                        type="text"
                        value={ingredient.alternative?.amount || ""}
                        onChange={(e) => updateAlternative(index, "amount", e.target.value)}
                        onFocus={handleInputFocus}
                        onSelect={handleInputSelect}
                        className="input text-sm text-center"
                        placeholder="⅛"
                      />
                      <input
                        type="text"
                        value={ingredient.alternative?.unit || ""}
                        onChange={(e) => updateAlternative(index, "unit", e.target.value)}
                        onFocus={handleInputFocus}
                        onSelect={handleInputSelect}
                        className="input text-sm"
                        placeholder="cdta"
                        list="unit-suggestions"
                      />
                      <input
                        type="text"
                        value={ingredient.alternative?.name || ""}
                        onChange={(e) => updateAlternative(index, "name", e.target.value)}
                        onFocus={handleInputFocus}
                        onSelect={handleInputSelect}
                        className="input text-sm"
                        placeholder="Nombre del ingrediente alternativo"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleShowAlternative(index)}
                      className="p-1.5 shrink-0 text-emerald-600 hover:text-red-600 transition-colors"
                      title="Quitar alternativa"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Secondary measurement row (collapsed by default) */}
                {(isExpanded || hasSecondary) && (
                  <div className={`ml-4 space-y-2 pl-2 border-l-2 border-[var(--color-purple-bg-dark)] ${!isExpanded && hasSecondary ? 'opacity-60' : ''}`}>
                    {/* Main ingredient variant row */}
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-xs text-[var(--color-slate-light)] font-medium shrink-0"
                        style={{ width: '30px' }}
                        title={showVariantLabels && variant2Label ? variant2Label : "Alternativo"}
                      >
                        {showVariantLabels && variant2Label ? "🥈" : "Alt"}:
                      </span>
                      <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '60px 90px 1fr' }}>
                        <input
                          type="text"
                          value={ingredient.amount2 || ""}
                          onChange={(e) => updateIngredient(index, "amount2", e.target.value)}
                          onFocus={handleInputFocus}
                          onSelect={handleInputSelect}
                          className="input text-sm text-center"
                          placeholder="120"
                        />
                        <input
                          type="text"
                          value={ingredient.unit2 || ingredient.unit || ""}
                          onChange={(e) => updateIngredient(index, "unit2", e.target.value)}
                          className="input text-sm"
                          placeholder={ingredient.unit || "g"}
                          list="unit-suggestions"
                        />
                        <span className="text-xs text-[var(--color-slate-light)] flex items-center truncate">
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
                        className="p-1.5 shrink-0 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                        title="Eliminar medida alternativa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Alternative ingredient variant row - only show if alternative exists and variants enabled */}
                    {showAlternative.has(index) && ingredient.alternative?.name && (
                      <div className="flex items-center gap-2 bg-emerald-50/50 rounded-r-lg py-1 pr-2">
                        <span className="text-xs text-emerald-600 font-medium shrink-0" style={{ width: '30px' }}>
                          o
                        </span>
                        <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '60px 90px 1fr' }}>
                          <input
                            type="text"
                            value={ingredient.alternative?.amount2 || ""}
                            onChange={(e) => {
                              const updated = [...ingredients];
                              const currentAlt = updated[index].alternative || { name: "", amount: "", unit: "" };
                              updated[index] = { 
                                ...updated[index], 
                                alternative: { ...currentAlt, amount2: e.target.value }
                              };
                              setIngredients(updated);
                            }}
                            onFocus={handleInputFocus}
                            onSelect={handleInputSelect}
                            className="input text-sm text-center"
                            placeholder="—"
                          />
                          <input
                            type="text"
                            value={ingredient.alternative?.unit2 || ingredient.alternative?.unit || ""}
                            onChange={(e) => {
                              const updated = [...ingredients];
                              const currentAlt = updated[index].alternative || { name: "", amount: "", unit: "" };
                              updated[index] = { 
                                ...updated[index], 
                                alternative: { ...currentAlt, unit2: e.target.value }
                              };
                              setIngredients(updated);
                            }}
                            className="input text-sm"
                            placeholder={ingredient.alternative?.unit || "g"}
                            list="unit-suggestions"
                          />
                          <span className="text-xs text-emerald-600 flex items-center truncate">
                            {ingredient.alternative?.name || "—"}
                          </span>
                        </div>
                        <div className="w-7"></div> {/* Spacer to align with delete button above */}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Drop zone at the very end */}
          {movingSectionIndex !== null && movingSectionIndex < ingredients.length - 1 && (
            <button
              type="button"
              onClick={() => placeSection(ingredients.length)}
              className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span className="text-sm font-medium">⬇️ Colocar aquí (al final)</span>
            </button>
          )}
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
          {instructions.map((instruction, stepIndex) => {
            // Calculate step number (only counting non-headers)
            const stepNumber = instructions.slice(0, stepIndex + 1).filter(i => !i.isHeader).length;
            
            // Render section header
            if (instruction.isHeader) {
              return (
                <div key={stepIndex} className="flex gap-2 items-center pt-3 first:pt-0">
                  <div className="flex-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <input
                      type="text"
                      value={instruction.text}
                      onChange={(e) => updateInstructionText(stepIndex, e.target.value)}
                      className="input flex-1 font-semibold text-amber-800 bg-amber-50 border-amber-200"
                      placeholder="Nombre de la sección (ej: Para la base)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInstruction(stepIndex)}
                    className="p-2 text-[var(--color-slate-light)] hover:text-red-600 transition-colors"
                    title="Eliminar sección"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            }
            
            // Render regular instruction step
            return (
              <div key={stepIndex} className="border border-[var(--border-color)] rounded-lg p-3 bg-[var(--color-purple-bg)]">
                <div className="flex gap-2 items-start mb-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-purple)] text-white text-sm font-medium mt-2">
                    {stepNumber}
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
                    disabled={instructions.filter(i => !i.isHeader).length === 1}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Section chips for this step */}
                {(() => {
                  const sections = getIngredientSections();
                  if (sections.length === 0) return null;
                  
                  return (
                    <div className="ml-8">
                      <div className="flex flex-wrap gap-2">
                        {sections.map((section, sectionIdx) => {
                          // Check if ALL ingredients in this section are selected
                          const allSelected = section.ingredientIndices.every(idx => 
                            instruction.ingredientIndices.includes(idx)
                          );
                          // Check if SOME ingredients in this section are selected
                          const someSelected = section.ingredientIndices.some(idx => 
                            instruction.ingredientIndices.includes(idx)
                          );
                          
                          return (
                            <button
                              key={sectionIdx}
                              type="button"
                              onClick={() => toggleSectionInStep(stepIndex, section.ingredientIndices)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                allSelected
                                  ? "bg-[var(--color-purple)] text-white shadow-sm"
                                  : someSelected
                                  ? "bg-[var(--color-purple-bg)] border border-[var(--color-purple)] text-[var(--color-purple)]"
                                  : "bg-white border border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple)] hover:text-[var(--color-purple)]"
                              }`}
                              title={`${section.ingredientIndices.length} ingredientes`}
                            >
                              {allSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {someSelected && !allSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              )}
                              {section.name}
                              <span className={`text-[10px] ${allSelected ? 'text-white/70' : 'text-[var(--color-slate-light)]'}`}>
                                ({section.ingredientIndices.length})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3">
          <button
            type="button"
            onClick={addInstruction}
            className="text-[var(--color-purple)] font-medium text-sm flex items-center gap-1 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Añadir paso
          </button>
          <button
            type="button"
            onClick={addInstructionSectionHeader}
            className="text-amber-600 font-medium text-sm flex items-center gap-1 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Añadir sección
          </button>
        </div>
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

      {/* Unit suggestions datalist - shared by all unit inputs */}
      <datalist id="unit-suggestions">
        {COMMON_UNITS.all.map(u => (
          <option key={u.value} value={u.value} />
        ))}
      </datalist>
    </form>
  );
}

