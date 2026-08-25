import {
  ADDITIVE_BY_E_CODE,
  ADDITIVE_CATALOG,
  type AdditiveEntry,
  type AdditiveVerdict,
} from "@/lib/additive-catalog";

export interface AdditiveMatch {
  id: string;
  name: string;
  category: string;
  verdict: AdditiveVerdict;
  summary: string;
  matchedOn: string;
}

export interface UnknownMatch {
  label: string;
  detail: string;
}

export interface ScanResult {
  avoid: AdditiveMatch[];
  caution: AdditiveMatch[];
  ok: AdditiveMatch[];
  unknown: UnknownMatch[];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractECodes(text: string): number[] {
  const codes: number[] = [];
  const seen = new Set<number>();
  const re = /\bE[\s-]?(\d{3,4})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const code = parseInt(match[1], 10);
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

function entryMatchesText(
  entry: AdditiveEntry,
  text: string,
  normalized: string,
  matchedECodes: Set<number>
): string | null {
  if (entry.eCode != null) {
    const re = new RegExp(`\\bE[\\s-]?${entry.eCode}\\b`, "i");
    if (re.test(text)) {
      matchedECodes.add(entry.eCode);
      return `E${entry.eCode}`;
    }
  }

  if (entry.keywords) {
    for (const keyword of entry.keywords) {
      const nk = normalizeText(keyword);
      if (nk.length >= 4 && normalized.includes(nk)) {
        return keyword;
      }
    }
  }

  return null;
}

function pushMatch(
  matches: AdditiveMatch[],
  seen: Set<string>,
  entry: AdditiveEntry,
  matchedOn: string
) {
  if (seen.has(entry.id)) return;
  seen.add(entry.id);
  matches.push({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    verdict: entry.verdict,
    summary: entry.summary,
    matchedOn,
  });
}

function sortMatches(matches: AdditiveMatch[]): AdditiveMatch[] {
  const rank: Record<AdditiveVerdict, number> = { avoid: 0, caution: 1, ok: 2 };
  return [...matches].sort(
    (a, b) =>
      rank[a.verdict] - rank[b.verdict] ||
      a.name.localeCompare(b.name, "es")
  );
}

/** Analiza texto de ingredientes contra el catálogo completo. */
export function scanTextForAdditives(text: string): ScanResult {
  const empty: ScanResult = { avoid: [], caution: [], ok: [], unknown: [] };
  if (!text.trim()) return empty;

  const normalized = normalizeText(text);
  const allMatches: AdditiveMatch[] = [];
  const seen = new Set<string>();
  const matchedECodes = new Set<number>();

  for (const entry of ADDITIVE_CATALOG) {
    if (
      entry.id === "nitritos-generico" &&
      [249, 250, 251, 252].some((c) => matchedECodes.has(c))
    ) {
      continue;
    }
    const matchedOn = entryMatchesText(entry, text, normalized, matchedECodes);
    if (matchedOn) {
      pushMatch(allMatches, seen, entry, matchedOn);
    }
  }

  const unknown: UnknownMatch[] = [];
  for (const code of extractECodes(text)) {
    if (matchedECodes.has(code)) continue;
    if (ADDITIVE_BY_E_CODE.has(code)) {
      const entry = ADDITIVE_BY_E_CODE.get(code)!;
      pushMatch(allMatches, seen, entry, `E${code}`);
      matchedECodes.add(code);
      continue;
    }
    unknown.push({
      label: `E${code}`,
      detail: "Código E no está en tu guía. Búscalo aparte o revisa la etiqueta.",
    });
  }

  unknown.sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));

  const sorted = sortMatches(allMatches);
  return {
    avoid: sorted.filter((m) => m.verdict === "avoid"),
    caution: sorted.filter((m) => m.verdict === "caution"),
    ok: sorted.filter((m) => m.verdict === "ok"),
    unknown,
  };
}

export function summarizeScanResult(result: ScanResult) {
  return {
    avoid: result.avoid.length,
    caution: result.caution.length,
    ok: result.ok.length,
    unknown: result.unknown.length,
    flagged: result.avoid.length + result.caution.length,
  };
}
