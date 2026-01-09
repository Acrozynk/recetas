"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

interface Stats {
  total: number;
  accepted: number;
  edited: number;
  discarded: number;
}

export default function ImportCompletePage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/import-session");
      const data = await response.json();

      if (data.session) {
        const recipes = data.session.recipes;
        setStats({
          total: recipes.length,
          accepted: recipes.filter((r: { status: string }) => r.status === "accepted").length,
          edited: recipes.filter((r: { status: string }) => r.status === "edited").length,
          discarded: recipes.filter((r: { status: string }) => r.status === "discarded").length,
        });
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const imported = (stats?.accepted || 0) + (stats?.edited || 0);

  return (
    <div className="min-h-screen pb-20">
      <Header title="Importación Completa" />

      <main className="max-w-md mx-auto p-4 pt-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">
            ¡Importación Completa!
          </h1>
          <p className="text-[var(--color-slate)]">
            Has revisado todas las recetas
          </p>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl border border-[var(--border-color)] p-6 mb-6">
          <h2 className="font-semibold mb-4">Resumen</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-slate)]">Total revisadas</span>
              <span className="font-semibold">{stats?.total || 0}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Importadas
              </span>
              <span className="font-semibold text-green-600">{imported}</span>
            </div>
            
            {stats?.edited ? (
              <div className="flex justify-between items-center pl-5 text-sm">
                <span className="text-[var(--color-slate)]">
                  ({stats.accepted} sin cambios, {stats.edited} editadas)
                </span>
              </div>
            ) : null}
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Descartadas
              </span>
              <span className="font-semibold text-red-600">{stats?.discarded || 0}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push("/")}
            className="btn-primary w-full"
          >
            Ver Mis Recetas
          </button>
          
          <button
            onClick={() => router.push("/recipes/import")}
            className="btn-secondary w-full"
          >
            Importar Más Recetas
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}












