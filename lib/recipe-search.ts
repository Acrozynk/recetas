/**
 * Normalize for case/accent-insensitive recipe text search.
 * Trims and collapses whitespace so trailing spaces do not break substring matches.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isSearchQueryEmpty(query: string): boolean {
  return normalizeSearchText(query) === "";
}

/**
 * True if every whitespace-separated token in `query` appears somewhere in `haystack`
 * (substring match on normalized strings). Empty query matches everything.
 */
export function haystackMatchesSearchTokens(haystack: string, query: string): boolean {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  const nh = normalizeSearchText(haystack);
  return nq.split(" ").every((token) => nh.includes(token));
}

/**
 * Same as matching against title, description, and tag names combined.
 */
export function recipeTextMatchesQuery(
  fields: { title: string; description?: string | null; tags?: string[] | null },
  query: string
): boolean {
  if (isSearchQueryEmpty(query)) return true;
  const parts = [
    fields.title,
    fields.description ?? "",
    ...(fields.tags ?? []),
  ];
  const combined = normalizeSearchText(parts.join(" "));
  const nq = normalizeSearchText(query);
  return nq.split(" ").every((token) => combined.includes(token));
}
