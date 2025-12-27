"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type ShoppingItem, type MealPlan, type Ingredient } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

const CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat & Seafood",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Other",
];

function getWeekStart(): string {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return monday.toISOString().split("T")[0];
}

function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();

  // Produce
  if (
    /\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint|thyme|rosemary)\b/.test(
      lowerName
    )
  ) {
    return "Produce";
  }

  // Dairy
  if (
    /\b(milk|cheese|butter|cream|yogurt|sour cream|egg|eggs)\b/.test(lowerName)
  ) {
    return "Dairy";
  }

  // Meat & Seafood
  if (
    /\b(chicken|beef|pork|lamb|turkey|fish|salmon|shrimp|bacon|sausage|meat|steak|ground)\b/.test(
      lowerName
    )
  ) {
    return "Meat & Seafood";
  }

  // Bakery
  if (/\b(bread|roll|bun|bagel|tortilla|pita|croissant)\b/.test(lowerName)) {
    return "Bakery";
  }

  // Frozen
  if (/\b(frozen|ice cream)\b/.test(lowerName)) {
    return "Frozen";
  }

  // Beverages
  if (/\b(juice|soda|water|wine|beer|coffee|tea)\b/.test(lowerName)) {
    return "Beverages";
  }

  // Pantry (default for most dry goods, canned items, etc.)
  if (
    /\b(flour|sugar|salt|oil|vinegar|sauce|pasta|rice|bean|can|stock|broth|spice|seasoning)\b/.test(
      lowerName
    )
  ) {
    return "Pantry";
  }

  return "Other";
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");

  const weekStart = getWeekStart();

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("week_start", weekStart)
        .order("category")
        .order("checked")
        .order("name");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading shopping items:", error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const generateFromMealPlan = async () => {
    setGenerating(true);

    try {
      // Get this week's meal plans with recipe details
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data: mealPlans, error: plansError } = await supabase
        .from("meal_plans")
        .select("*, recipe:recipes(*)")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd.toISOString().split("T")[0]);

      if (plansError) throw plansError;

      if (!mealPlans || mealPlans.length === 0) {
        alert("No meals planned for this week. Add some meals to the planner first!");
        return;
      }

      // Collect all ingredients
      const ingredientMap = new Map<
        string,
        { name: string; quantity: string; category: string; recipe_id: string }
      >();

      for (const plan of mealPlans as MealPlan[]) {
        if (!plan.recipe) continue;

        const ingredients = plan.recipe.ingredients as Ingredient[];
        for (const ing of ingredients) {
          const key = ing.name.toLowerCase().trim();
          const existing = ingredientMap.get(key);

          if (existing) {
            // Combine quantities (simple append for now)
            if (ing.amount) {
              existing.quantity = existing.quantity
                ? `${existing.quantity} + ${ing.amount} ${ing.unit || ""}`.trim()
                : `${ing.amount} ${ing.unit || ""}`.trim();
            }
          } else {
            ingredientMap.set(key, {
              name: ing.name,
              quantity: ing.amount ? `${ing.amount} ${ing.unit || ""}`.trim() : "",
              category: categorizeIngredient(ing.name),
              recipe_id: plan.recipe.id,
            });
          }
        }
      }

      // Clear existing generated items for this week
      await supabase
        .from("shopping_items")
        .delete()
        .eq("week_start", weekStart)
        .not("recipe_id", "is", null);

      // Insert new items
      const newItems = Array.from(ingredientMap.values()).map((item) => ({
        ...item,
        checked: false,
        week_start: weekStart,
      }));

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("shopping_items")
          .insert(newItems);

        if (insertError) throw insertError;
      }

      loadItems();
    } catch (error) {
      console.error("Error generating shopping list:", error);
      alert("Failed to generate shopping list. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleItem = async (item: ShoppingItem) => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .update({ checked: !item.checked })
        .eq("id", item.id);

      if (error) throw error;

      setItems(
        items.map((i) =>
          i.id === item.id ? { ...i, checked: !i.checked } : i
        )
      );
    } catch (error) {
      console.error("Error toggling item:", error);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      const { error } = await supabase.from("shopping_items").insert([
        {
          name: newItemName.trim(),
          category: newItemCategory,
          checked: false,
          week_start: weekStart,
          recipe_id: null,
        },
      ]);

      if (error) throw error;

      setNewItemName("");
      loadItems();
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems(items.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const clearChecked = async () => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("week_start", weekStart)
        .eq("checked", true);

      if (error) throw error;

      loadItems();
    } catch (error) {
      console.error("Error clearing checked items:", error);
    }
  };

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      const category = item.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, ShoppingItem[]>
  );

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;

  return (
    <div className="min-h-screen pb-20">
      <Header
        title="Shopping List"
        rightAction={
          items.length > 0 && checkedCount > 0 ? (
            <button
              onClick={clearChecked}
              className="p-2 text-[var(--color-warm-gray)] hover:text-red-600 transition-colors"
              title="Clear checked items"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : undefined
        }
      />

      <main className="max-w-2xl mx-auto p-4">
        {/* Generate Button */}
        <button
          onClick={generateFromMealPlan}
          disabled={generating}
          className="w-full btn-primary mb-6 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generate from Meal Plan
            </>
          )}
        </button>

        {/* Add Item Form */}
        <form onSubmit={addItem} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="input flex-1"
            placeholder="Add item..."
          />
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className="input w-auto"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-[var(--color-warm-gray)] mb-1">
              <span>Progress</span>
              <span>
                {checkedCount} of {totalCount} items
              </span>
            </div>
            <div className="w-full bg-[var(--color-cream-dark)] rounded-full h-2">
              <div
                className="bg-[var(--color-sage)] h-2 rounded-full transition-all"
                style={{ width: `${(checkedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-[var(--color-cream-dark)] rounded w-24 mb-2" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-[var(--color-cream-dark)] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : totalCount > 0 ? (
          <div className="space-y-6">
            {CATEGORIES.filter((cat) => groupedItems[cat]?.length > 0).map(
              (category) => (
                <div key={category}>
                  <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2">
                    {category}
                  </h3>
                  <div className="bg-white rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                    {groupedItems[category].map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 transition-colors ${
                          item.checked ? "bg-[var(--color-cream-dark)]" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item)}
                          className="checkbox"
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={`${
                              item.checked
                                ? "line-through text-[var(--color-warm-gray-light)]"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.quantity && (
                            <span className="text-sm text-[var(--color-warm-gray-light)] ml-2">
                              ({item.quantity})
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-[var(--color-warm-gray-light)] hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-[var(--color-cream-dark)] rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[var(--color-warm-gray-light)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">
              No items yet
            </h2>
            <p className="text-[var(--color-warm-gray-light)] mb-4">
              Generate a list from your meal plan or add items manually
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

