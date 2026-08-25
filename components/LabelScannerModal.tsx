"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCatalogForBrowse,
  VERDICT_LABELS,
  type AdditiveEntry,
  type AdditiveVerdict,
} from "@/lib/additive-catalog";
import {
  scanTextForAdditives,
  summarizeScanResult,
  type AdditiveMatch,
  type ScanResult,
} from "@/lib/scan-additives";

interface LabelScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "analyze" | "guide";

function VerdictBadge({ verdict }: { verdict: AdditiveVerdict }) {
  const styles: Record<AdditiveVerdict, string> = {
    avoid: "bg-red-200 text-red-900",
    caution: "bg-amber-200 text-amber-900",
    ok: "bg-emerald-200 text-emerald-900",
  };
  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${styles[verdict]}`}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

function MatchCard({ match }: { match: AdditiveMatch }) {
  const border: Record<AdditiveVerdict, string> = {
    avoid: "bg-red-50 border-red-200",
    caution: "bg-amber-50 border-amber-200",
    ok: "bg-emerald-50 border-emerald-200",
  };
  const title: Record<AdditiveVerdict, string> = {
    avoid: "text-red-800",
    caution: "text-amber-800",
    ok: "text-emerald-800",
  };

  return (
    <div className={`rounded-xl p-3 border ${border[match.verdict]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold ${title[match.verdict]}`}>{match.name}</p>
          <p className="text-xs text-[var(--color-slate)] mt-0.5">
            {match.category} · detectado: {match.matchedOn}
          </p>
        </div>
        <VerdictBadge verdict={match.verdict} />
      </div>
      <p className="text-sm text-[var(--color-slate)] mt-2">{match.summary}</p>
    </div>
  );
}

function GuideEntry({ entry }: { entry: AdditiveEntry }) {
  return (
    <div className="rounded-lg p-3 border border-[var(--border-color)] bg-white">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-[var(--foreground)]">{entry.name}</p>
        <VerdictBadge verdict={entry.verdict} />
      </div>
      <p className="text-xs text-[var(--color-slate)] mt-1">{entry.category}</p>
      <p className="text-sm text-[var(--color-slate)] mt-1.5">{entry.summary}</p>
    </div>
  );
}

function ResultSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: AdditiveMatch[];
  emptyMessage?: string;
}) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-slate-light)]">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <MatchCard key={item.id} match={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LabelScannerModal({
  isOpen,
  onClose,
}: LabelScannerModalProps) {
  const [tab, setTab] = useState<Tab>("analyze");
  const [ingredientText, setIngredientText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [guideQuery, setGuideQuery] = useState("");

  const catalog = useMemo(() => getCatalogForBrowse(), []);

  const filteredCatalog = useMemo(() => {
    const q = guideQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        (entry.eCode != null && `e${entry.eCode}`.includes(q.replace(/\s/g, "")))
    );
  }, [catalog, guideQuery]);

  useEffect(() => {
    if (!isOpen) return;
    setTab("analyze");
    setIngredientText("");
    setScanResult(null);
    setGuideQuery("");
  }, [isOpen]);

  const runScan = () => {
    if (!ingredientText.trim()) return;
    setScanResult(scanTextForAdditives(ingredientText.trim()));
  };

  const summary = scanResult ? summarizeScanResult(scanResult) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white w-full sm:max-w-lg max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col animate-fade-in">
        <div className="flex-shrink-0 p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                Guía de aditivos
              </h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">
                Pega ingredientes o consulta la lista completa
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-purple-bg-dark)] rounded-full transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-[var(--color-purple-bg)] rounded-xl">
            <button
              type="button"
              onClick={() => setTab("analyze")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === "analyze"
                  ? "bg-white text-[var(--color-purple)] shadow-sm"
                  : "text-[var(--color-slate)]"
              }`}
            >
              Analizar texto
            </button>
            <button
              type="button"
              onClick={() => setTab("guide")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === "guide"
                  ? "bg-white text-[var(--color-purple)] shadow-sm"
                  : "text-[var(--color-slate)]"
              }`}
            >
              Ver todos ({catalog.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "analyze" ? (
            <>
              <div>
                <label className="text-sm font-medium text-[var(--color-slate)] mb-2 block">
                  Lista de ingredientes
                </label>
                <textarea
                  value={ingredientText}
                  onChange={(e) => setIngredientText(e.target.value)}
                  rows={5}
                  placeholder="Ingredientes: carne de cerdo, agua, sal, estabilizantes (E450, E451), aroma…"
                  className="input w-full text-sm resize-none"
                />
                <button
                  type="button"
                  onClick={runScan}
                  disabled={!ingredientText.trim()}
                  className="mt-2 w-full btn-primary text-sm py-2.5 disabled:opacity-50"
                >
                  Analizar
                </button>
              </div>

              {summary && (
                <div className="rounded-xl p-3 border border-[var(--border-color)] bg-[var(--color-purple-bg)] text-sm">
                  <span className="text-red-700 font-medium">{summary.avoid} evitar</span>
                  {" · "}
                  <span className="text-amber-700 font-medium">{summary.caution} ojo</span>
                  {" · "}
                  <span className="text-emerald-700 font-medium">{summary.ok} tranquilos</span>
                  {summary.unknown > 0 && (
                    <>
                      {" · "}
                      <span className="text-[var(--color-slate)] font-medium">
                        {summary.unknown} E no en guía
                      </span>
                    </>
                  )}
                </div>
              )}

              {scanResult && (
                <div className="space-y-4">
                  <ResultSection
                    title="Evitar si puedes"
                    items={scanResult.avoid}
                    emptyMessage="Ninguno detectado."
                  />
                  <ResultSection
                    title="Ojo"
                    items={scanResult.caution}
                    emptyMessage="Ninguno detectado."
                  />
                  <ResultSection
                    title="Tranquilos"
                    items={scanResult.ok}
                    emptyMessage="Ninguno detectado."
                  />
                  {scanResult.unknown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                        Códigos E no en la guía
                      </h3>
                      <div className="space-y-2">
                        {scanResult.unknown.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl p-3 border border-gray-200 bg-gray-50"
                          >
                            <p className="font-semibold text-[var(--foreground)]">
                              {item.label}
                            </p>
                            <p className="text-sm text-[var(--color-slate)] mt-1">
                              {item.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <input
                type="search"
                value={guideQuery}
                onChange={(e) => setGuideQuery(e.target.value)}
                placeholder="Buscar por nombre, E-number o categoría…"
                className="input w-full text-sm"
              />
              <p className="text-xs text-[var(--color-slate)]">
                Códigos E ordenados por número; resto alfabético.{" "}
                {filteredCatalog.length} de {catalog.length} entradas.
              </p>
              <div className="space-y-2">
                {filteredCatalog.map((entry) => (
                  <GuideEntry key={entry.id} entry={entry} />
                ))}
                {filteredCatalog.length === 0 && (
                  <p className="text-sm text-center text-[var(--color-slate-light)] py-6">
                    Sin resultados para «{guideQuery}»
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-shrink-0 p-4 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="w-full btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
