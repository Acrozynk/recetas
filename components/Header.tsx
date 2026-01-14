"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string; // Si se especifica, navega a esta ruta en lugar de usar historial
  useHistoryBack?: boolean; // Si es true, usa el historial del navegador para volver
  showAdd?: boolean;
  rightAction?: React.ReactNode;
  showMascot?: boolean;
}

export default function Header({
  title,
  showBack = false,
  backHref = "/", // Por defecto vuelve a la página principal
  useHistoryBack = true, // Por defecto usa el historial para preservar filtros
  showAdd = false,
  rightAction,
  showMascot = false,
}: HeaderProps) {
  const router = useRouter();
  
  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback to the specified href if no history
      router.push(backHref);
    }
  };
  
  return (
    <header className="sticky top-0 bg-[var(--background)] border-b border-[var(--border-color)] z-40">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto lg:px-8">
        <div className="flex items-center gap-3">
          {showBack && (
            useHistoryBack ? (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            ) : (
              <Link
                href={backHref}
                className="p-2 -ml-2 text-[var(--color-slate)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
            )
          )}
          {showMascot && (
            <Image
              src="/remy.png"
              alt="Remy"
              width={48}
              height={48}
              className="object-contain"
            />
          )}
          <h1 className="font-display text-xl font-semibold text-[var(--foreground)]">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {showAdd && (
            <Link
              href="/recipes/new"
              className="p-2 text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </Link>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}

