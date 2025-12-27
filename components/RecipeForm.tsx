"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Recipe, type Ingredient } from "@/lib/supabase";

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
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes?.toString() || "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes?.toString() || "");
  const [servings, setServings] = useState(recipe?.servings?.toString() || "4");
  const [tags, setTags] = useState(recipe?.tags?.join(", ") || "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (recipe?.ingredients as Ingredient[]) || [{ name: "", amount: "", unit: "" }]
  );
  const [instructions, setInstructions] = useState<string[]>(
    (recipe?.instructions as string[]) || [""]
  );

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
    }
  };

  const addInstruction = () => {
    setInstructions([...instructions, ""]);
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
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
        instructions: instructions.filter((i) => i.trim()),
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
      setError("Failed to save recipe. Please try again.");
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
        <h2 className="font-display text-lg font-semibold mb-4">Basic Info</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Recipe title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder="Brief description of the recipe"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="input"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="input"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
                Prep (min)
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
              <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
                Cook (min)
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
              <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
                Servings
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
            <label className="block text-sm font-medium text-[var(--color-warm-gray)] mb-1">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input"
              placeholder="Dinner, Italian, Quick (comma-separated)"
            />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-4">Ingredients</h2>

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-[1fr,2fr,1fr] gap-2">
                <input
                  type="text"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                  className="input"
                  placeholder="1"
                />
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, "name", e.target.value)}
                  className="input"
                  placeholder="Ingredient name"
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                  className="input"
                  placeholder="cup"
                />
              </div>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-2 text-[var(--color-warm-gray-light)] hover:text-red-600 transition-colors"
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
          className="mt-3 text-[var(--color-amber)] font-medium text-sm flex items-center gap-1 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add ingredient
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl p-4 border border-[var(--border-color)]">
        <h2 className="font-display text-lg font-semibold mb-4">Instructions</h2>

        <div className="space-y-3">
          {instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-cream-dark)] text-[var(--color-warm-gray)] text-sm font-medium mt-2">
                {index + 1}
              </span>
              <textarea
                value={instruction}
                onChange={(e) => updateInstruction(index, e.target.value)}
                className="input flex-1 min-h-[60px] resize-y"
                placeholder="Describe this step..."
                rows={2}
              />
              <button
                type="button"
                onClick={() => removeInstruction(index)}
                className="p-2 text-[var(--color-warm-gray-light)] hover:text-red-600 transition-colors"
                disabled={instructions.length === 1}
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
          onClick={addInstruction}
          className="mt-3 text-[var(--color-amber)] font-medium text-sm flex items-center gap-1 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add step
        </button>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 disabled:opacity-50"
          disabled={saving || !title.trim()}
        >
          {saving ? "Saving..." : mode === "edit" ? "Update Recipe" : "Save Recipe"}
        </button>
      </div>
    </form>
  );
}

