import type { Ingredient, Instruction } from "@/lib/supabase";
import { formatAmount, parseAmount } from "@/lib/unit-conversion";

/**
 * Marcador en el texto de un paso: enlace a otra receta.
 * Formato: [[receta:UUID]] | [[receta:UUID|Texto]] | [[receta:UUID|Texto|0.5]]
 */
export const RECIPE_LINK_REGEX =
  /\[\[receta:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|([^|\]]*))?(?:\|([0-9]+(?:[.,][0-9]+)?))?\]\]/gi;

export type RecipeLinkRef = {
  recipeId: string;
  label: string;
  scale: number;
};

export type InstructionLinkSegment =
  | { type: "text"; text: string }
  | { type: "link"; recipeId: string; label: string; scale: number };

export type FlattenedDisplayStep = {
  key: string;
  text: string;
  isHeader: boolean;
  ingredientIndices: number[];
  sourceRecipeId: string;
  sourceTitle: string;
  scale: number;
  isLinked: boolean;
};

function parseLinkScale(raw: string | undefined): number {
  if (!raw) return 1;
  const n = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export function formatLinkScale(scale: number): string {
  if (scale === 1) return "1";
  if (scale === 0.5) return "½";
  if (scale === 1.5) return "1½";
  if (scale === 2) return "2";
  return formatAmount(scale);
}

export function splitInstructionWithRecipeLinks(
  stepText: string
): InstructionLinkSegment[] {
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
    segments.push({
      type: "link",
      recipeId: id,
      label,
      scale: parseLinkScale(m[3]),
    });
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

export function extractRecipeLinksFromText(stepText: string): RecipeLinkRef[] {
  return splitInstructionWithRecipeLinks(stepText)
    .filter((s): s is Extract<InstructionLinkSegment, { type: "link" }> => s.type === "link")
    .map((s) => ({ recipeId: s.recipeId, label: s.label, scale: s.scale }));
}

export function extractLinkedRecipeRefsFromInstructions(
  instructions: Instruction[],
  excludeRecipeId?: string
): RecipeLinkRef[] {
  const seen = new Set<string>();
  const out: RecipeLinkRef[] = [];
  for (const inst of instructions) {
    if (inst.isHeader || !inst.text) continue;
    for (const ref of extractRecipeLinksFromText(inst.text)) {
      if (excludeRecipeId && ref.recipeId === excludeRecipeId) continue;
      if (seen.has(ref.recipeId)) continue;
      seen.add(ref.recipeId);
      out.push(ref);
    }
  }
  return out;
}

/** IDs únicos de recetas enlazadas en instrucciones (excluye la propia receta). */
export function extractLinkedRecipeIdsFromInstructions(
  instructions: Instruction[],
  excludeRecipeId?: string
): string[] {
  return extractLinkedRecipeRefsFromInstructions(
    instructions,
    excludeRecipeId
  ).map((r) => r.recipeId);
}

export function buildRecipeLinkToken(
  recipeId: string,
  displayLabel: string,
  scale = 1
): string {
  const safe = displayLabel.replace(/[|\]]/g, "").trim() || "Receta";
  if (scale === 1) return `[[receta:${recipeId}|${safe}]]`;
  const scaleStr = Number.isInteger(scale) ? String(scale) : String(scale);
  return `[[receta:${recipeId}|${safe}|${scaleStr}]]`;
}

export function replaceRecipeLinksWithLabels(stepText: string): string {
  return splitInstructionWithRecipeLinks(stepText)
    .map((seg) => (seg.type === "link" ? seg.label : seg.text))
    .join("");
}

export function instructionIsOnlyRecipeLink(stepText: string): boolean {
  const segments = splitInstructionWithRecipeLinks(stepText);
  const hasLink = segments.some((s) => s.type === "link");
  const leftover = segments
    .filter((s): s is Extract<InstructionLinkSegment, { type: "text" }> => s.type === "text")
    .map((s) => s.text)
    .join("")
    .trim();
  return hasLink && leftover.length === 0;
}

export function multiplyAmountString(amount: string, multiplier: number): string {
  if (!amount.trim() || multiplier === 1) return amount;
  const num = parseAmount(amount);
  if (num == null) return amount;
  return formatAmount(num * multiplier);
}

export function scaleIngredientAmounts(
  ingredients: Ingredient[],
  scale: number
): Ingredient[] {
  if (scale === 1) return ingredients;
  return ingredients.map((ing) => {
    if (ing.isHeader || ing.name.startsWith("**")) return ing;
    return {
      ...ing,
      amount: ing.amount ? multiplyAmountString(ing.amount, scale) : ing.amount,
      amount2: ing.amount2 ? multiplyAmountString(ing.amount2, scale) : ing.amount2,
    };
  });
}

type LinkedRecipeSource = {
  id: string;
  title: string;
  instructions?: Instruction[] | string[] | null;
};

export function flattenInstructionsWithLinkedRecipes(
  parentRecipeId: string,
  parentTitle: string,
  parentInstructions: Instruction[],
  linkedById: Map<string, LinkedRecipeSource>,
  normalizeInstructions: (
    instructions: Instruction[] | string[] | null | undefined
  ) => Instruction[]
): FlattenedDisplayStep[] {
  const out: FlattenedDisplayStep[] = [];
  let seq = 0;

  const push = (step: Omit<FlattenedDisplayStep, "key">) => {
    out.push({ ...step, key: `${step.sourceRecipeId}-${seq++}` });
  };

  for (const inst of parentInstructions) {
    const links = inst.isHeader ? [] : extractRecipeLinksFromText(inst.text);
    if (links.length === 0) {
      push({
        text: inst.text,
        isHeader: !!inst.isHeader,
        ingredientIndices: inst.ingredientIndices || [],
        sourceRecipeId: parentRecipeId,
        sourceTitle: parentTitle,
        scale: 1,
        isLinked: false,
      });
      continue;
    }

    if (!instructionIsOnlyRecipeLink(inst.text)) {
      push({
        text: replaceRecipeLinksWithLabels(inst.text),
        isHeader: false,
        ingredientIndices: inst.ingredientIndices || [],
        sourceRecipeId: parentRecipeId,
        sourceTitle: parentTitle,
        scale: 1,
        isLinked: false,
      });
    }

    for (const link of links) {
      const linked = linkedById.get(link.recipeId);
      if (!linked) {
        push({
          text: link.label,
          isHeader: true,
          ingredientIndices: [],
          sourceRecipeId: link.recipeId,
          sourceTitle: link.label,
          scale: link.scale,
          isLinked: true,
        });
        continue;
      }

      const linkedSteps = normalizeInstructions(linked.instructions);
      push({
        text: link.label || linked.title,
        isHeader: true,
        ingredientIndices: [],
        sourceRecipeId: linked.id,
        sourceTitle: linked.title,
        scale: link.scale,
        isLinked: true,
      });
      for (const child of linkedSteps) {
        push({
          text: replaceRecipeLinksWithLabels(child.text),
          isHeader: !!child.isHeader,
          ingredientIndices: child.ingredientIndices || [],
          sourceRecipeId: linked.id,
          sourceTitle: linked.title,
          scale: link.scale,
          isLinked: true,
        });
      }
    }
  }

  return out;
}
