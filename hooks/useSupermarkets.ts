"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SUPERMARKETS,
  getEnabledSupermarkets,
  normalizeSupermarkets,
  type SupermarketConfig,
} from "@/lib/supermarkets";

export function useSupermarkets() {
  const [supermarkets, setSupermarkets] = useState<SupermarketConfig[]>(
    DEFAULT_SUPERMARKETS
  );
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
      setSupermarkets(normalizeSupermarkets(data));
    } catch (err) {
      console.error("Error loading supermarkets:", err);
      setError(err instanceof Error ? err.message : "Error loading supermarkets");
      setSupermarkets(DEFAULT_SUPERMARKETS.map((s) => ({ ...s })));
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

  return {
    supermarkets,
    enabledSupermarkets,
    loading,
    error,
    reload: () => load(true),
    saveSupermarkets,
  };
}
