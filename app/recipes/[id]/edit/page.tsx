"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, type Recipe } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import RecipeForm from "@/components/RecipeForm";

export default function EditRecipePage() {
  const params = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <Header title="Edit Recipe" showBack />
        <div className="max-w-2xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-[var(--color-cream-dark)] rounded" />
            <div className="h-32 bg-[var(--color-cream-dark)] rounded" />
            <div className="h-32 bg-[var(--color-cream-dark)] rounded" />
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
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Header title="Edit Recipe" showBack />

      <main className="max-w-2xl mx-auto p-4">
        <RecipeForm recipe={recipe} mode="edit" />
      </main>

      <BottomNav />
    </div>
  );
}

