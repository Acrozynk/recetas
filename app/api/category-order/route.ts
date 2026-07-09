import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupermarketName, SupermarketCategoryOrder } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/lib/supabase";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SETTINGS_KEY = "category_order";

/** Per-supermarket ordered category names stored in app_settings (PostgREST-safe). */
type CategoryOrderSettings = Partial<Record<SupermarketName, string[]>>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

function isSchemaCacheError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("pgrst205") ||
    msg.includes("could not find the table")
  );
}

function toRows(
  supermarket: SupermarketName,
  categories: string[]
): SupermarketCategoryOrder[] {
  const now = new Date().toISOString();
  return categories.map((category, index) => ({
    id: `${supermarket}-${index}`,
    supermarket,
    category,
    sort_order: index + 1,
    created_at: now,
    updated_at: now,
  }));
}

async function loadSettings(): Promise<CategoryOrderSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) throw error;
  return (data?.value as CategoryOrderSettings) || {};
}

async function saveSettings(settings: CategoryOrderSettings): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({
    key: SETTINGS_KEY,
    value: settings,
  });
  if (error) throw error;
}

/** Best-effort read from the dedicated table (may fail if PostgREST cache is stale). */
async function loadFromLegacyTable(
  supermarket: SupermarketName | null
): Promise<SupermarketCategoryOrder[] | null> {
  try {
    let query = supabase
      .from("supermarket_category_order")
      .select("*")
      .order("sort_order", { ascending: true });

    if (supermarket) {
      query = query.eq("supermarket", supermarket);
    }

    const { data, error } = await query;
    if (error) {
      if (isSchemaCacheError(error)) return null;
      throw error;
    }
    return (data as SupermarketCategoryOrder[]) || [];
  } catch (error) {
    if (isSchemaCacheError(error)) return null;
    throw error;
  }
}

async function saveToLegacyTable(
  supermarket: SupermarketName,
  categories: string[]
): Promise<void> {
  try {
    const { error: deleteError } = await supabase
      .from("supermarket_category_order")
      .delete()
      .eq("supermarket", supermarket);

    if (deleteError) {
      if (isSchemaCacheError(deleteError)) return;
      throw deleteError;
    }

    const rows = categories.map((category, index) => ({
      supermarket,
      category,
      sort_order: index + 1,
    }));

    const { error: insertError } = await supabase
      .from("supermarket_category_order")
      .insert(rows);

    if (insertError) {
      if (isSchemaCacheError(insertError)) return;
      throw insertError;
    }
  } catch (error) {
    if (isSchemaCacheError(error)) return;
    throw error;
  }
}

// GET category order for a supermarket
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supermarket = searchParams.get("supermarket") as SupermarketName | null;

    const settings = await loadSettings();

    if (supermarket) {
      const stored = settings[supermarket];
      if (stored && stored.length > 0) {
        return NextResponse.json(toRows(supermarket, stored));
      }

      const legacy = await loadFromLegacyTable(supermarket);
      if (legacy && legacy.length > 0) {
        return NextResponse.json(legacy);
      }

      return NextResponse.json(toRows(supermarket, [...DEFAULT_CATEGORIES]));
    }

    const allRows: SupermarketCategoryOrder[] = [];
    const markets: SupermarketName[] = ["DIA", "Consum", "Mercadona"];
    for (const market of markets) {
      const stored = settings[market];
      if (stored && stored.length > 0) {
        allRows.push(...toRows(market, stored));
        continue;
      }
      const legacy = await loadFromLegacyTable(market);
      if (legacy && legacy.length > 0) {
        allRows.push(...legacy);
      } else {
        allRows.push(...toRows(market, [...DEFAULT_CATEGORIES]));
      }
    }

    return NextResponse.json(allRows);
  } catch (error) {
    console.error("Error fetching category order:", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}

// PUT update category order for a supermarket
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { supermarket, categories } = body as {
      supermarket: SupermarketName;
      categories: string[];
    };

    if (!supermarket || !categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: "Supermarket and categories array are required" },
        { status: 400 }
      );
    }

    const settings = await loadSettings();
    settings[supermarket] = categories;
    await saveSettings(settings);

    // Keep legacy table in sync when PostgREST can see it
    await saveToLegacyTable(supermarket, categories);

    return NextResponse.json(toRows(supermarket, categories));
  } catch (error) {
    console.error("Error updating category order:", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}
