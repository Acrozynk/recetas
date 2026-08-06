import type { CSSProperties } from "react";

/** Stable id stored in shopping_items.supermarket (never changes when renaming). */
export type SupermarketId = string;

export interface SupermarketConfig {
  id: SupermarketId;
  name: string;
  enabled: boolean;
  /** Hex color, e.g. #15803d */
  color: string;
  sortOrder: number;
  builtin?: boolean;
}

export const SUPERMARKETS_SETTINGS_KEY = "supermarkets";

export const DEFAULT_SUPERMARKETS: SupermarketConfig[] = [
  {
    id: "DIA",
    name: "DIA",
    enabled: true,
    color: "#b91c1c",
    sortOrder: 0,
    builtin: true,
  },
  {
    id: "Consum",
    name: "Consum",
    enabled: true,
    color: "#c2410c",
    sortOrder: 1,
    builtin: true,
  },
  {
    id: "Mercadona",
    name: "Mercadona",
    enabled: true,
    color: "#15803d",
    sortOrder: 2,
    builtin: true,
  },
];

export function normalizeSupermarkets(raw: unknown): SupermarketConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_SUPERMARKETS.map((s) => ({ ...s }));
  }

  const parsed: SupermarketConfig[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<SupermarketConfig>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    parsed.push({
      id,
      name,
      enabled: row.enabled !== false,
      color: sanitizeHexColor(row.color) ?? "#6366f1",
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : parsed.length,
      builtin: !!row.builtin,
    });
  }

  if (parsed.length === 0) {
    return DEFAULT_SUPERMARKETS.map((s) => ({ ...s }));
  }

  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sanitizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const h = v.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return null;
}

export function slugifySupermarketId(name: string): string {
  const base =
    name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tienda";
  return base;
}

export function uniqueSupermarketId(name: string, existingIds: string[]): string {
  let id = slugifySupermarketId(name);
  if (!existingIds.includes(id)) return id;
  let n = 2;
  while (existingIds.includes(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

export function getEnabledSupermarkets(all: SupermarketConfig[]): SupermarketConfig[] {
  return [...all].filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSupermarketById(
  all: SupermarketConfig[],
  id: SupermarketId
): SupermarketConfig | undefined {
  return all.find((s) => s.id === id);
}

/** Inline styles for supermarket tabs / headers from a hex color. */
export function supermarketTabStyle(color: string, selected: boolean): CSSProperties {
  if (selected) {
    return {
      backgroundColor: `${color}18`,
      color,
      borderColor: `${color}66`,
    };
  }
  return {
    backgroundColor: "white",
    color: "var(--color-slate)",
    borderColor: "var(--border-color)",
  };
}

export function supermarketBadgeStyle(color: string, selected: boolean): CSSProperties {
  if (selected) {
    return {
      backgroundColor: "rgba(255,255,255,0.92)",
      color: "var(--foreground)",
    };
  }
  return {
    backgroundColor: color,
    color: "#fff",
  };
}

export function supermarketHeaderStyle(color: string): CSSProperties {
  return {
    backgroundColor: `${color}14`,
    color,
  };
}

export const SELECTED_SUPERMARKET_STORAGE_KEY = "recetas-selected-supermarket";

export function pickInitialSupermarketId(
  enabled: SupermarketConfig[],
  storedId: string | null
): SupermarketId {
  if (storedId && enabled.some((s) => s.id === storedId)) return storedId;
  return enabled[0]?.id ?? DEFAULT_SUPERMARKETS[0].id;
}

export type SupermarketName = SupermarketId;
