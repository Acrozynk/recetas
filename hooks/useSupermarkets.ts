"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/supermarkets");
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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

  const enabledSupermarkets = getEnabledSupermarkets(supermarkets);

  return {
    supermarkets,
    enabledSupermarkets,
    loading,
    error,
    reload: load,
    saveSupermarkets,
  };
}
