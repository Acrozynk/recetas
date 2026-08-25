import { NextResponse } from "next/server";
import {
  scanTextForAdditives,
  summarizeScanResult,
} from "@/lib/scan-additives";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Pega la lista de ingredientes para analizar." },
        { status: 400 }
      );
    }

    const result = scanTextForAdditives(text);
    return NextResponse.json({
      extractedText: text,
      result,
      summary: summarizeScanResult(result),
    });
  } catch (error) {
    console.error("Error scanning label:", error);
    const message =
      error instanceof Error ? error.message : "Error al analizar ingredientes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
