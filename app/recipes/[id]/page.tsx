"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase, type Recipe, type Ingredient } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadRecipe(params.id as string);
    }
  }, [params.id]);

  const loadRecipe = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setRecipe(data);
    } catch (error) {
      console.error("Error loading recipe:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;

    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipe.id);

      if (error) throw error;
      router.push("/");
    } catch (error) {
      console.error("Error deleting recipe:", error);
    }
  };

  const scaleAmount = (amount: string): string => {
    if (servingMultiplier === 1) return amount;

    // Try to parse and scale the amount
    const numMatch = amount.match(/^([\d./]+)\s*(.*)$/);
    if (numMatch) {
      let num: number;
      if (numMatch[1].includes("/")) {
        const [numerator, denominator] = numMatch[1].split("/");
        num = parseInt(numerator) / parseInt(denominator);
      } else {
        num = parseFloat(numMatch[1]);
      }

      const scaled = num * servingMultiplier;
      const scaledStr =
        scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(2).replace(/\.?0+$/, "");
      return `${scaledStr} ${numMatch[2]}`.trim();
    }

    return amount;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Loading..." showBack />
        <div className="animate-pulse">
          <div className="aspect-video bg-[var(--color-cream-dark)]" />
          <div className="p-4 max-w-4xl mx-auto">
            <div className="h-8 bg-[var(--color-cream-dark)] rounded w-3/4 mb-4" />
            <div className="h-4 bg-[var(--color-cream-dark)] rounded w-1/2 mb-8" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-[var(--color-cream-dark)] rounded" />
              ))}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Recipe Not Found" showBack />
        <div className="text-center py-12">
          <p className="text-[var(--color-warm-gray-light)]">
            This recipe doesn&apos;t exist or was deleted.
          </p>
          <Link href="/" className="btn-primary inline-block mt-4">
            Back to Recipes
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-screen pb-20">
      <Header
        title=""
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="p-2 text-[var(--color-warm-gray)] hover:text-[var(--color-amber)] hover:bg-[var(--color-cream-dark)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-[var(--color-warm-gray)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        }
      />

      <main>
        {/* Hero Image */}
        {recipe.image_url && (
          <div className="relative aspect-video bg-[var(--color-cream-dark)]">
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4">
          {/* Title and Meta */}
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--foreground)] mb-2">
              {recipe.title}
            </h1>

            {recipe.description && (
              <p className="text-[var(--color-warm-gray)] mb-4">
                {recipe.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-warm-gray-light)]">
              {recipe.prep_time_minutes && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Prep: {recipe.prep_time_minutes} min
                </span>
              )}
              {recipe.cook_time_minutes && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  Cook: {recipe.cook_time_minutes} min
                </span>
              )}
              {totalTime > 0 && (
                <span className="font-medium text-[var(--color-amber)]">
                  Total: {totalTime} min
                </span>
              )}
            </div>

            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {recipe.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-sm text-[var(--color-amber)] hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View original recipe
              </a>
            )}
          </div>

          {/* Serving Adjuster */}
          {recipe.servings && (
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[var(--border-color)] mb-6">
              <span className="font-medium text-[var(--color-warm-gray)]">
                Servings:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-cream-dark)] hover:bg-[var(--border-color)] transition-colors"
                >
                  −
                </button>
                <span className="w-12 text-center font-semibold text-[var(--color-amber)]">
                  {Math.round(recipe.servings * servingMultiplier)}
                </span>
                <button
                  onClick={() => setServingMultiplier(servingMultiplier + 0.5)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-cream-dark)] hover:bg-[var(--border-color)] transition-colors"
                >
                  +
                </button>
              </div>
              {servingMultiplier !== 1 && (
                <button
                  onClick={() => setServingMultiplier(1)}
                  className="text-sm text-[var(--color-amber)] hover:underline ml-auto"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-[1fr,2fr] gap-6">
            {/* Ingredients */}
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-4">
                Ingredients
              </h2>
              <ul className="space-y-2">
                {(recipe.ingredients as Ingredient[]).map((ingredient, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-2 hover:bg-[var(--color-cream-dark)] rounded-lg transition-colors"
                  >
                    <input type="checkbox" className="checkbox mt-0.5" />
                    <span>
                      <strong className="font-medium">
                        {scaleAmount(ingredient.amount)}
                        {ingredient.unit && ` ${ingredient.unit}`}
                      </strong>{" "}
                      {ingredient.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-4">
                Instructions
              </h2>
              <ol className="space-y-4">
                {(recipe.instructions as string[]).map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-amber)] text-white font-semibold text-sm">
                      {i + 1}
                    </span>
                    <p className="pt-1 text-[var(--color-warm-gray)]">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="font-display text-xl font-semibold mb-2">
              Delete Recipe?
            </h3>
            <p className="text-[var(--color-warm-gray)] mb-6">
              Are you sure you want to delete &quot;{recipe.title}&quot;? This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

