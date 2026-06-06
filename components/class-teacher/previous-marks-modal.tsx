"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, Loader2, X } from "lucide-react";
import {
  computeHistoricalMarksSummary,
  HistoricalMarksEmptyState,
  HistoricalMarksGroupedList,
  HistoricalMarksSummaryCards,
} from "@/components/class-teacher/historical-marks-display";
import type { HistoricalMarksClassGroup } from "@/lib/gradebook/load-historical-marks-for-class-teacher";

export function ViewPreviousMarksLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 text-left text-xs font-medium text-school-primary hover:underline dark:text-school-primary"
    >
      View previous marks
    </button>
  );
}

export function PreviousMarksModal({
  open,
  studentName,
  groups,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  studentName: string;
  groups: HistoricalMarksClassGroup[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const summary = useMemo(
    () => computeHistoricalMarksSummary(groups),
    [groups]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, onClose]);

  if (!mounted || !rendered) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out dark:bg-black/70 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="previous-marks-title"
        aria-describedby="previous-marks-desc"
        className={`relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.98] opacity-0 sm:translate-y-0"
        }`}
      >
        <div className="relative shrink-0 border-b border-slate-200 px-4 py-4 dark:border-zinc-700 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
              aria-hidden
            >
              <GraduationCap className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2
                id="previous-marks-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Previous academic records
              </h2>
              <p
                id="previous-marks-desc"
                className="mt-1 text-sm text-slate-500 dark:text-zinc-400"
              >
                Marks recorded before {studentName} joined this class.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading previous academic records…
            </div>
          ) : error ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
              role="alert"
            >
              Could not load previous academic records ({error}).
            </p>
          ) : groups.length === 0 ? (
            <HistoricalMarksEmptyState />
          ) : (
            <div className="space-y-5">
              <section aria-label="Marks summary">
                <HistoricalMarksSummaryCards summary={summary} />
              </section>
              <HistoricalMarksGroupedList groups={groups} />
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50 sm:px-5">
          <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
            Historical marks are read-only and remain attached to the class
            where they were originally recorded.
          </p>
        </footer>
      </div>
    </div>,
    document.body
  );
}
