import type { Instruction } from "@/lib/supabase";

/**
 * Marcador en el texto de un paso: enlace a otra receta.
 * Formato: [[receta:UUID]] o [[receta:UUID|Texto del enlace]]
 */
export const RECIPE_LINK_REGEX =
  /\[\[receta:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|([^\]]+))?\]\]/gi;

export type InstructionLinkSegment =
  | { type: "text"; text: string }
  | { type: "link"; recipeId: string; label: string };

export function splitInstructionWithRecipeLinks(stepText: string): InstructionLinkSegment[] {
  const segments: InstructionLinkSegment[] = [];
  let last = 0;
  const re = new RegExp(RECIPE_LINK_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(stepText)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", text: stepText.slice(last, m.index) });
    }
    const id = m[1];
    const label = (m[2] ?? "").trim() || "Receta";
    segments.push({ type: "link", recipeId: id, label });
    last = m.index + m[0].length;
  }
  if (last < stepText.length) {
    segments.push({ type: "text", text: stepText.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", text: stepText });
  }
  return segments;
}

/** IDs únicos de recetas enlazadas en instrucciones (excluye la propia receta). */
export function extractLinkedRecipeIdsFromInstructions(
  instructions: Instruction[],
  excludeRecipeId?: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const inst of instructions) {
    if (inst.isHeader || !inst.text) continue;
    const re = new RegExp(RECIPE_LINK_REGEX.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(inst.text)) !== null) {
      const id = m[1];
      if (excludeRecipeId && id === excludeRecipeId) continue;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

export function buildRecipeLinkToken(recipeId: string, displayLabel: string): string {
  const safe = displayLabel.replace(/\]/g, "").trim() || "Receta";
  return `[[receta:${recipeId}|${safe}]]`;
}
