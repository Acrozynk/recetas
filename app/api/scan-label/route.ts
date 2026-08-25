import { NextResponse } from "next/server";
import {
  scanTextForAdditives,
  summarizeAdditiveMatches,
} from "@/lib/scan-additives";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function extractIngredientsFromImage(
  base64: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Añádela a las variables de entorno para escanear etiquetas."
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are reading a food product label photo. Extract ONLY the ingredients list (in Spanish or English) exactly as written on the package.
Include E-numbers, additives, allergens section if visible, and any processing phrases like "carne separada mecánicamente".
Return plain text only — no markdown, no commentary. If you cannot read an ingredients list, return an empty string.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vision API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Se requiere una imagen (campo image)." },
          { status: 400 }
        );
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "El archivo debe ser una imagen." },
          { status: 400 }
        );
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "La imagen es demasiado grande (máx. 8 MB)." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const extractedText = await extractIngredientsFromImage(base64, file.type);
      const flags = scanTextForAdditives(extractedText);

      return NextResponse.json({
        extractedText,
        flags,
        summary: summarizeAdditiveMatches(flags),
      });
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Envía una imagen (multipart) o un texto de ingredientes (JSON)." },
        { status: 400 }
      );
    }

    const flags = scanTextForAdditives(text);
    return NextResponse.json({
      extractedText: text,
      flags,
      summary: summarizeAdditiveMatches(flags),
    });
  } catch (error) {
    console.error("Error scanning label:", error);
    const message =
      error instanceof Error ? error.message : "Error al escanear la etiqueta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
