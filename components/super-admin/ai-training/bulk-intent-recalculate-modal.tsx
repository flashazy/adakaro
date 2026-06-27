"use client";

import { Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import type {
  BulkRecalculatePreview,
  BulkRecalculateResult,
} from "@/lib/ai-training/types";

type ModalStep = "preview" | "applying" | "summary";

interface BulkIntentRecalculateModalProps {
  open: boolean;
  preview: BulkRecalculatePreview | null;
  result: BulkRecalculateResult | null;
  step: ModalStep;
  loading: boolean;
  onClose: () => void;
  onApply: () => void;
}

export function BulkIntentRecalculateModal({
  open,
  preview,
  result,
  step,
  loading,
  onClose,
  onApply,
}: BulkIntentRecalculateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Recalculate all intents"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {step === "summary" ? "Recalculation complete" : "Recalculate all intents"}
            </h2>
            <p className={saSectionSubtitle}>
              {step === "summary"
                ? "Bulk intent recalculation finished."
                : "Review proposed intent changes before applying."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "preview" && preview ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Scanned" value={preview.scanned} />
              <Stat label="Would update" value={preview.wouldUpdate} tone="warn" />
              <Stat label="Unchanged" value={preview.unchanged} />
            </div>

            {preview.changes.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">
                All active entries already match the latest intent engine. Nothing to update.
              </p>
            ) : (
              <ul className="mt-6 max-h-80 space-y-3 overflow-y-auto">
                {preview.changes.slice(0, 50).map((change) => (
                  <li
                    key={change.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                  >
                    <p className="text-sm font-medium text-slate-900">{change.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-rose-50 px-2 py-0.5 font-mono text-rose-700">
                        {change.oldIntentKey ?? "none"}
                      </span>
                      <span className="text-slate-400">↓</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-emerald-700">
                        {change.newIntentKey ?? "none"}
                      </span>
                      {change.confidence !== null ? (
                        <span className="text-slate-500">
                          {Math.round(change.confidence * 100)}% confidence
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {preview.changes.length > 50 ? (
              <p className="mt-2 text-xs text-slate-400">
                Showing first 50 of {preview.changes.length} changes.
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={saBtnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={saBtnPrimary}
                disabled={loading || preview.wouldUpdate === 0}
                onClick={onApply}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Apply all ({preview.wouldUpdate})
              </button>
            </div>
          </>
        ) : null}

        {step === "applying" ? (
          <div className="mt-8 flex flex-col items-center gap-3 py-8 text-sm text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            Recalculating intents in batches…
          </div>
        ) : null}

        {step === "summary" && result ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Stat label="Knowledge entries scanned" value={result.scanned} />
              <Stat label="Updated" value={result.updated} tone="ok" />
              <Stat label="Unchanged" value={result.unchanged} />
              <Stat label="Failed" value={result.failed} tone={result.failed > 0 ? "warn" : "neutral"} />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Duration: {(result.durationMs / 1000).toFixed(1)} seconds
            </p>
            <div className="mt-6 flex justify-end">
              <button type="button" className={saBtnPrimary} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div
      className={
        tone === "ok"
          ? "rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5"
          : tone === "warn"
            ? "rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5"
            : "rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
