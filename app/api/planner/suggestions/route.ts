import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Tags that indicate main ingredient/dish type - avoid duplicates in same week
const EXCLUSIVE_TAGS = [
  "pasta",
  "arroz",
  "pizza",
  "legumbres",
  "patatas",
  "quinoa",
  "cuscús",
  "polenta",
];

// Map meal types to Spanish tag equivalents
const MEAL_TYPE_TO_TAG: Record<string, string[]> = {
  breakfast: ["desayuno"],
  lunch: ["comida", "almuerzo"],
  snack: ["merienda"],
  dinner: ["cena"],
};

interface SuggestionResult {
  recipe_id: string;
  title: string;
  tags: string[];
  image_url: string | null;
  times_planned: number;
  days_since_last: number | null;
  reason: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mealType = searchParams.get("meal_type") || "lunch";
    const dateStr = searchParams.get("date");
    const weekStart = searchParams.get("week_start");
    const weekEnd = searchParams.get("week_end");

    if (!dateStr || !weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "date, week_start and week_end are required" },
        { status: 400 }
      );
    }

    // Get all recipes
    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("id, title, tags, image_url, rating, made_it")
      .order("title");

    if (recipesError) throw recipesError;

    // Get meal plan history (last 90 days for frequency analysis)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: mealHistory, error: historyError } = await supabase
      .from("meal_plans")
      .select("recipe_id, plan_date")
      .gte("plan_date", ninetyDaysAgo.toISOString().split("T")[0])
      .order("plan_date", { ascending: false });

    if (historyError) throw historyError;

    // Get current week's meal plans (to avoid tag conflicts)
    const { data: weekPlans, error: weekError } = await supabase
      .from("meal_plans")
      .select("recipe_id, recipe:recipes(tags)")
      .gte("plan_date", weekStart)
      .lte("plan_date", weekEnd);

    if (weekError) throw weekError;

    // Calculate recipe usage stats
    const recipeStats = new Map<
      string,
      { timesPlanned: number; lastPlanned: string | null }
    >();

    for (const plan of mealHistory || []) {
      const stats = recipeStats.get(plan.recipe_id) || {
        timesPlanned: 0,
        lastPlanned: null,
      };
      stats.timesPlanned++;
      if (!stats.lastPlanned || plan.plan_date > stats.lastPlanned) {
        stats.lastPlanned = plan.plan_date;
      }
      recipeStats.set(plan.recipe_id, stats);
    }

    // Get exclusive tags already used this week
    const usedExclusiveTags = new Set<string>();
    for (const plan of weekPlans || []) {
      const tags = (plan.recipe as { tags?: string[] })?.tags || [];
      for (const tag of tags) {
        const normalizedTag = tag.toLowerCase().trim();
        if (EXCLUSIVE_TAGS.includes(normalizedTag)) {
          usedExclusiveTags.add(normalizedTag);
        }
      }
    }

    // Get recipes already planned this week
    const plannedRecipeIds = new Set(
      (weekPlans || []).map((p) => p.recipe_id)
    );

    // Score and filter recipes
    const suggestions: SuggestionResult[] = [];
    const today = new Date();

    for (const recipe of recipes || []) {
      // Skip if already planned this week
      if (plannedRecipeIds.has(recipe.id)) continue;

      const recipeTags = (recipe.tags || []).map((t: string) =>
        t.toLowerCase().trim()
      );

      // Check if recipe matches the meal type
      const mealTypeTags = MEAL_TYPE_TO_TAG[mealType] || [];
      const matchesMealType =
        mealTypeTags.length === 0 ||
        recipeTags.some((tag: string) => mealTypeTags.includes(tag)) ||
        !recipeTags.some((tag: string) =>
          Object.values(MEAL_TYPE_TO_TAG).flat().includes(tag)
        );

      if (!matchesMealType) continue;

      // Check for exclusive tag conflicts
      const hasExclusiveConflict = recipeTags.some((tag: string) =>
        usedExclusiveTags.has(tag)
      );
      if (hasExclusiveConflict) continue;

      const stats = recipeStats.get(recipe.id);
      const timesPlanned = stats?.timesPlanned || 0;
      const lastPlanned = stats?.lastPlanned;

      let daysSinceLast: number | null = null;
      if (lastPlanned) {
        const lastDate = new Date(lastPlanned);
        daysSinceLast = Math.floor(
          (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // Determine reason and priority
      let reason = "";
      let score = 0;

      if (timesPlanned >= 3 && daysSinceLast !== null && daysSinceLast >= 14) {
        // Frequently made but not recently - high priority
        reason = `Sueles hacerla (${timesPlanned}x) pero hace ${daysSinceLast} días`;
        score = 100 + timesPlanned * 2 + Math.min(daysSinceLast, 30);
      } else if (timesPlanned >= 2 && daysSinceLast !== null && daysSinceLast >= 21) {
        // Made a few times, over 3 weeks ago
        reason = `La hiciste ${timesPlanned} veces, última hace ${daysSinceLast} días`;
        score = 80 + timesPlanned + Math.min(daysSinceLast - 21, 20);
      } else if (recipe.rating && recipe.rating >= 2 && (!daysSinceLast || daysSinceLast >= 14)) {
        // Highly rated and not recently made
        reason =
          recipe.rating === 3
            ? "⭐ Favorita" + (daysSinceLast ? ` (hace ${daysSinceLast} días)` : "")
            : "Bien valorada" + (daysSinceLast ? ` (hace ${daysSinceLast} días)` : "");
        score = 60 + recipe.rating * 10 + (daysSinceLast || 30);
      } else if (recipe.made_it && timesPlanned === 0) {
        // Made but never planned
        reason = "Ya la has hecho pero no está planificada";
        score = 40;
      } else if (timesPlanned === 0 && !recipe.made_it) {
        // Never made - suggest occasionally
        reason = "Aún no la has probado";
        score = 20;
      } else {
        // Default: lower priority
        continue;
      }

      suggestions.push({
        recipe_id: recipe.id,
        title: recipe.title,
        tags: recipe.tags || [],
        image_url: recipe.image_url,
        times_planned: timesPlanned,
        days_since_last: daysSinceLast,
        reason,
      });
    }

    // Sort by score (implicitly through reason priority) and limit
    suggestions.sort((a, b) => {
      // Sort by reason priority (encoded in the message structure)
      const priorityOrder = [
        "Sueles hacerla",
        "La hiciste",
        "⭐ Favorita",
        "Bien valorada",
        "Ya la has hecho",
        "Aún no la has probado",
      ];

      const getPriority = (reason: string) =>
        priorityOrder.findIndex((p) => reason.startsWith(p));

      const aPriority = getPriority(a.reason);
      const bPriority = getPriority(b.reason);

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Within same priority, sort by times_planned and days_since_last
      if (a.times_planned !== b.times_planned)
        return b.times_planned - a.times_planned;
      return (b.days_since_last || 0) - (a.days_since_last || 0);
    });

    // Return top suggestions
    return NextResponse.json({
      suggestions: suggestions.slice(0, 8),
      excluded_tags: Array.from(usedExclusiveTags),
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
















