"use client";

import { useEffect, useRef, useState } from "react";
import type { AdditiveMatch } from "@/lib/scan-additives";
import { VERDICT_LABELS } from "@/lib/additive-rules";

interface ScanSummary {
  avoid: number;
  caution: number;
  total: number;
}

interface LabelScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LabelScannerModal({
  isOpen,
  onClose,
}: LabelScannerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [flags, setFlags] = useState<AdditiveMatch[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl(null);
    setManualText("");
    setExtractedText("");
    setFlags([]);
    setSummary(null);
    setScanning(false);
    setError(null);
    setShowRawText(false);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setExtractedText("");
    setFlags([]);
    setSummary(null);
  };

  const runScan = async (mode: "image" | "text") => {
    setScanning(true);
    setError(null);

    try {
      let response: Response;

      if (mode === "image") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("Haz una foto o elige una imagen primero.");
          return;
        }
        const formData = new FormData();
        formData.append("image", file);
        response = await fetch("/api/scan-label", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!manualText.trim()) {
          setError("Pega la lista de ingredientes o haz una foto.");
          return;
        }
        response = await fetch("/api/scan-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: manualText.trim() }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al analizar la etiqueta");
      }

      setExtractedText(data.extractedText || "");
      setFlags(data.flags || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar la etiqueta");
    } finally {
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white w-full sm:max-w-lg max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col animate-fade-in">
        <div className="flex-shrink-0 p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                Escanear etiqueta
              </h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">
                Foto de ingredientes → aditivos a vigilar
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
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa de la etiqueta"
                className="w-full max-h-56 object-contain bg-gray-50"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 rounded-xl border-2 border-dashed border-[var(--color-purple-light)] bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] transition-colors flex flex-col items-center gap-2"
            >
              <svg className="w-10 h-10 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-[var(--color-purple)]">
                Abrir cámara o elegir foto
              </span>
              <span className="text-xs text-[var(--color-slate)]">
                Enfoca la lista de ingredientes
              </span>
            </button>
          )}

          {previewUrl && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 btn-secondary text-sm py-2"
              >
                Otra foto
              </button>
              <button
                type="button"
                onClick={() => runScan("image")}
                disabled={scanning}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analizando…
                  </>
                ) : (
                  "Analizar foto"
                )}
              </button>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[var(--color-slate)] mb-2 block">
              O pega los ingredientes manualmente
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              placeholder="Ingredientes: carne de cerdo, agua, sal, estabilizantes (E450, E451)…"
              className="input w-full text-sm resize-none"
            />
            <button
              type="button"
              onClick={() => runScan("text")}
              disabled={scanning || !manualText.trim()}
              className="mt-2 w-full btn-secondary text-sm py-2 disabled:opacity-50"
            >
              Analizar texto
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {summary && (
            <div
              className={`rounded-xl p-4 border ${
                summary.total === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : summary.avoid > 0
                    ? "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-200"
              }`}
            >
              {summary.total === 0 ? (
                <p className="font-medium text-emerald-800">
                  No hemos detectado aditivos de tu lista a evitar u ojo con.
                </p>
              ) : (
                <p className="font-medium text-[var(--foreground)]">
                  {summary.avoid > 0 && (
                    <span className="text-red-700">
                      {summary.avoid} a evitar
                    </span>
                  )}
                  {summary.avoid > 0 && summary.caution > 0 && " · "}
                  {summary.caution > 0 && (
                    <span className="text-amber-700">
                      {summary.caution} con precaución
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {flags.length > 0 && (
            <div className="space-y-2">
              {flags.map((flag) => (
                <div
                  key={flag.id}
                  className={`rounded-xl p-3 border ${
                    flag.verdict === "avoid"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={`font-semibold ${
                          flag.verdict === "avoid" ? "text-red-800" : "text-amber-800"
                        }`}
                      >
                        {flag.name}
                      </p>
                      <p className="text-xs text-[var(--color-slate)] mt-0.5">
                        {flag.category} · detectado: {flag.matchedOn}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                        flag.verdict === "avoid"
                          ? "bg-red-200 text-red-900"
                          : "bg-amber-200 text-amber-900"
                      }`}
                    >
                      {VERDICT_LABELS[flag.verdict]}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-slate)] mt-2">
                    {flag.summary}
                  </p>
                </div>
              ))}
            </div>
          )}

          {extractedText && (
            <div>
              <button
                type="button"
                onClick={() => setShowRawText((v) => !v)}
                className="text-sm text-[var(--color-purple)] hover:underline"
              >
                {showRawText ? "Ocultar texto leído" : "Ver texto leído"}
              </button>
              {showRawText && (
                <pre className="mt-2 text-xs whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-[var(--border-color)] text-[var(--color-slate)]">
                  {extractedText}
                </pre>
              )}
            </div>
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
