"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKUP_STORAGE_KEY = "recetas-last-backup";
const REMINDER_DISMISSED_KEY = "recetas-reminder-dismissed";
const DEFAULT_REMINDER_DAYS = 14; // Remind every 2 weeks

interface BackupReminderProps {
  reminderDays?: number;
}

export default function BackupReminder({
  reminderDays = DEFAULT_REMINDER_DAYS,
}: BackupReminderProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [daysSinceBackup, setDaysSinceBackup] = useState<number | null>(null);

  useEffect(() => {
    checkBackupStatus();
  }, [reminderDays]);

  const checkBackupStatus = () => {
    try {
      const lastBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
      const dismissed = localStorage.getItem(REMINDER_DISMISSED_KEY);

      // If dismissed today, don't show
      if (dismissed) {
        const dismissedDate = new Date(dismissed);
        const today = new Date();
        if (dismissedDate.toDateString() === today.toDateString()) {
          return;
        }
      }

      if (!lastBackup) {
        // Never backed up
        setDaysSinceBackup(null);
        setShowReminder(true);
        return;
      }

      const lastBackupDate = new Date(lastBackup);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      setDaysSinceBackup(diffDays);

      if (diffDays >= reminderDays) {
        setShowReminder(true);
      }
    } catch {
      // localStorage not available
    }
  };

  const dismissReminder = () => {
    try {
      localStorage.setItem(REMINDER_DISMISSED_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setShowReminder(false);
  };

  if (!showReminder) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-white border-2 border-[var(--color-orange)] rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-[var(--color-orange)] rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-[var(--foreground)]">
              ¡Hora de hacer backup!
            </h3>
            <p className="text-sm text-[var(--color-slate)] mt-0.5">
              {daysSinceBackup === null
                ? "Nunca has exportado tus recetas. Protege tu colección."
                : `Han pasado ${daysSinceBackup} días desde tu último backup.`}
            </p>
            <div className="flex gap-2 mt-3">
              <Link
                href="/settings"
                className="flex-1 text-center text-sm font-medium py-2 px-3 bg-[var(--color-orange)] text-white rounded-lg hover:bg-[var(--color-orange-dark)] transition-colors"
              >
                Exportar ahora
              </Link>
              <button
                onClick={dismissReminder}
                className="text-sm font-medium py-2 px-3 text-[var(--color-slate)] hover:bg-[var(--color-purple-bg-dark)] rounded-lg transition-colors"
              >
                Después
              </button>
            </div>
          </div>
          <button
            onClick={dismissReminder}
            className="flex-shrink-0 text-[var(--color-slate-light)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility functions to manage backup state
export function markBackupCompleted() {
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, new Date().toISOString());
    localStorage.removeItem(REMINDER_DISMISSED_KEY);
  } catch {
    // localStorage not available
  }
}

export function getLastBackupDate(): Date | null {
  try {
    const lastBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    return lastBackup ? new Date(lastBackup) : null;
  } catch {
    return null;
  }
}

export function getReminderDays(): number {
  try {
    const days = localStorage.getItem("recetas-reminder-days");
    return days ? parseInt(days, 10) : DEFAULT_REMINDER_DAYS;
  } catch {
    return DEFAULT_REMINDER_DAYS;
  }
}

export function setReminderDays(days: number) {
  try {
    localStorage.setItem("recetas-reminder-days", days.toString());
  } catch {
    // ignore
  }
}





