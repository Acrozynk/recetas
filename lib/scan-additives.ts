import {
  ADDITIVE_RULES,
  type AdditiveRule,
  type AdditiveVerdict,
} from "@/lib/additive-rules";

export interface AdditiveMatch {
  id: string;
  name: string;
  category: string;
  verdict: AdditiveVerdict;
  summary: string;
  matchedOn: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractECodes(text: string): Set<number> {
  const codes = new Set<number>();
  const re = /\bE[\s-]?(\d{3,4})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    codes.add(parseInt(match[1], 10));
  }
  return codes;
}

function codeMatchesRule(code: number, rule: AdditiveRule): boolean {
  if (rule.eCodes?.includes(code)) return true;
  if (rule.eCodeRanges) {
    for (const [min, max] of rule.eCodeRanges) {
      if (code >= min && code <= max) return true;
    }
  }
  return false;
}

function ruleMatchesText(text: string, normalized: string, rule: AdditiveRule): string | null {
  const eCodes = extractECodes(text);
  for (const code of eCodes) {
    if (codeMatchesRule(code, rule)) {
      return `E${code}`;
    }
  }

  if (rule.keywords) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(normalizeText(keyword))) {
        return keyword;
      }
    }
  }

  return null;
}

/** Scan ingredient label text and return caution/avoid matches. */
export function scanTextForAdditives(text: string): AdditiveMatch[] {
  if (!text.trim()) return [];

  const normalized = normalizeText(text);
  const matches: AdditiveMatch[] = [];
  const seen = new Set<string>();

  for (const rule of ADDITIVE_RULES) {
    const matchedOn = ruleMatchesText(text, normalized, rule);
    if (matchedOn && !seen.has(rule.id)) {
      seen.add(rule.id);
      matches.push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        verdict: rule.verdict,
        summary: rule.summary,
        matchedOn,
      });
    }
  }

  const verdictRank: Record<AdditiveVerdict, number> = { avoid: 0, caution: 1 };
  return matches.sort(
    (a, b) =>
      verdictRank[a.verdict] - verdictRank[b.verdict] ||
      a.name.localeCompare(b.name, "es")
  );
}

export function summarizeAdditiveMatches(matches: AdditiveMatch[]) {
  return {
    avoid: matches.filter((m) => m.verdict === "avoid").length,
    caution: matches.filter((m) => m.verdict === "caution").length,
    total: matches.length,
  };
}
