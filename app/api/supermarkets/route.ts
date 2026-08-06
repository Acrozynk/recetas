import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SUPERMARKETS,
  SUPERMARKETS_SETTINGS_KEY,
  normalizeSupermarkets,
  type SupermarketConfig,
} from "@/lib/supermarkets";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

async function loadSupermarkets(): Promise<SupermarketConfig[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SUPERMARKETS_SETTINGS_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) {
    return DEFAULT_SUPERMARKETS.map((s) => ({ ...s }));
  }
  return normalizeSupermarkets(data.value);
}

export async function GET() {
  try {
    const supermarkets = await loadSupermarkets();
    return NextResponse.json(supermarkets);
  } catch (error) {
    console.error("Error fetching supermarkets:", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const supermarkets = normalizeSupermarkets(body?.supermarkets ?? body);

    if (supermarkets.filter((s) => s.enabled).length === 0) {
      return NextResponse.json(
        { error: "At least one supermarket must stay enabled" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("app_settings").upsert({
      key: SUPERMARKETS_SETTINGS_KEY,
      value: supermarkets,
    });

    if (error) throw error;

    return NextResponse.json(supermarkets);
  } catch (error) {
    console.error("Error saving supermarkets:", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    );
  }
}
