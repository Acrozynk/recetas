import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface BackupSettings {
  last_backup_date: string | null;
  reminder_days: number;
}

// GET - Get backup settings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "backup")
      .single();

    if (error) {
      // If no row exists, return defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          last_backup_date: null,
          reminder_days: 14,
        });
      }
      throw error;
    }

    return NextResponse.json(data.value as BackupSettings);
  } catch (error) {
    console.error("Error fetching backup settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup settings" },
      { status: 500 }
    );
  }
}

// POST - Update backup settings (mark backup completed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { last_backup_date, reminder_days } = body;

    // Get current settings first
    const { data: current } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "backup")
      .single();

    const currentValue = (current?.value as BackupSettings) || {
      last_backup_date: null,
      reminder_days: 14,
    };

    // Merge with new values
    const newValue: BackupSettings = {
      last_backup_date: last_backup_date !== undefined ? last_backup_date : currentValue.last_backup_date,
      reminder_days: reminder_days !== undefined ? reminder_days : currentValue.reminder_days,
    };

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "backup",
        value: newValue,
      });

    if (error) throw error;

    return NextResponse.json(newValue);
  } catch (error) {
    console.error("Error updating backup settings:", error);
    return NextResponse.json(
      { error: "Failed to update backup settings" },
      { status: 500 }
    );
  }
}

