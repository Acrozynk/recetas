"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SUPERMARKETS,
  getEnabledSupermarkets,
  normalizeSupermarkets,
  type SupermarketConfig,
} from "@/lib/supermarkets";

export function useSupermarkets() {
  const [supermarkets, setSupermarkets] = useState<SupermarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/supermarkets", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Error loading supermarkets"
        );
      }
      const data = await response.json();
      const next = normalizeSupermarkets(data);
      setSupermarkets((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    } catch (err) {
      console.error("Error loading supermarkets:", err);
      setError(err instanceof Error ? err.message : "Error loading supermarkets");
      setSupermarkets((prev) => {
        const fallback = DEFAULT_SUPERMARKETS.map((s) => ({ ...s }));
        return JSON.stringify(prev) === JSON.stringify(fallback) ? prev : fallback;
      });
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const saveSupermarkets = useCallback(async (next: SupermarketConfig[]) => {
    const normalized = normalizeSupermarkets(next);
    const response = await fetch("/api/supermarkets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supermarkets: normalized }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body.error === "string" ? body.error : "Error saving supermarkets"
      );
    }
    const data = await response.json();
    const saved = normalizeSupermarkets(data);
    setSupermarkets(saved);
    return saved;
  }, []);

  const enabledSupermarkets = useMemo(
    () => getEnabledSupermarkets(supermarkets),
    [supermarkets]
  );

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    supermarkets,
    enabledSupermarkets,
    loading,
    error,
    reload,
    saveSupermarkets,
  };
}
