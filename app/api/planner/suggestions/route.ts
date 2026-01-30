import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Suggestion {
  recipe_id: string;
  title: string;
  tags: string[];
  image_url: string | null;
  times_planned: number;
  days_since_last: number | null;
  reason: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start");
    const weekEnd = searchParams.get("week_end");

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "week_start and week_end are required" },
        { status: 400 }
      );
    }

    // Get all recipes
    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("id, title, tags, image_url");

    if (recipesError) throw recipesError;

    // Get all meal plans for history
    const { data: allPlans, error: plansError } = await supabase
      .from("meal_plans")
      .select("recipe_id, plan_date")
      .not("recipe_id", "is", null);

    if (plansError) throw plansError;

    // Get meal plans for current week to exclude
    const { data: weekPlans, error: weekPlansError } = await supabase
      .from("meal_plans")
      .select("recipe_id, plan_date")
      .gte("plan_date", weekStart)
      .lte("plan_date", weekEnd)
      .not("recipe_id", "is", null);

    if (weekPlansError) throw weekPlansError;

    // Build set of recipe IDs already planned this week
    const plannedThisWeek = new Set(
      weekPlans?.map((p) => p.recipe_id) || []
    );

    // Collect tags from recipes already planned this week for exclusion hints
    const excludedTags = new Set<string>();
    recipes?.forEach((recipe) => {
      if (plannedThisWeek.has(recipe.id) && recipe.tags) {
        recipe.tags.forEach((tag: string) => excludedTags.add(tag));
      }
    });

    // Calculate planning stats for each recipe
    const today = new Date();
    const recipeStats = new Map<
      string,
      { times_planned: number; last_planned: Date | null }
    >();

    allPlans?.forEach((plan) => {
      const stats = recipeStats.get(plan.recipe_id) || {
        times_planned: 0,
        last_planned: null,
      };
      stats.times_planned++;
      const planDate = new Date(plan.plan_date);
      if (!stats.last_planned || planDate > stats.last_planned) {
        stats.last_planned = planDate;
      }
      recipeStats.set(plan.recipe_id, stats);
    });

    // Build suggestions - recipes not planned this week
    const suggestions: Suggestion[] = (recipes || [])
      .filter((recipe) => !plannedThisWeek.has(recipe.id))
      .map((recipe) => {
        const stats = recipeStats.get(recipe.id);
        const timesPlanned = stats?.times_planned || 0;
        const lastPlanned = stats?.last_planned;

        let daysSinceLast: number | null = null;
        if (lastPlanned) {
          daysSinceLast = Math.floor(
            (today.getTime() - lastPlanned.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Generate reason based on stats
        let reason = "";
        if (timesPlanned === 0) {
          reason = "Nunca planificada";
        } else if (daysSinceLast !== null && daysSinceLast > 30) {
          reason = `Hace ${daysSinceLast} días`;
        } else if (daysSinceLast !== null && daysSinceLast > 14) {
          reason = `Hace ${daysSinceLast} días`;
        } else if (daysSinceLast !== null) {
          reason = `Hace ${daysSinceLast} días`;
        } else {
          reason = `${timesPlanned} veces`;
        }

        return {
          recipe_id: recipe.id,
          title: recipe.title,
          tags: recipe.tags || [],
          image_url: recipe.image_url,
          times_planned: timesPlanned,
          days_since_last: daysSinceLast,
          reason,
        };
      })
      // Sort by: never planned first, then by days since last (more days = higher priority)
      .sort((a, b) => {
        // Never planned recipes first
        if (a.times_planned === 0 && b.times_planned > 0) return -1;
        if (b.times_planned === 0 && a.times_planned > 0) return 1;

        // Then sort by days since last (null = never planned, handle above)
        if (a.days_since_last === null && b.days_since_last === null) {
          return a.title.localeCompare(b.title);
        }
        if (a.days_since_last === null) return -1;
        if (b.days_since_last === null) return 1;

        // More days since last = higher priority
        return b.days_since_last - a.days_since_last;
      })
      // Limit to top suggestions
      .slice(0, 10);

    return NextResponse.json({
      suggestions,
      excluded_tags: Array.from(excludedTags),
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
