"use client";

import { Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import type { DuplicateCheckApiResult } from "./knowledge-duplicate-panel";

interface KnowledgeNearDuplicateModalProps {
  open: boolean;
  check: DuplicateCheckApiResult | null;
  saving?: boolean;
  onConfirm: () => void;
  onViewExisting: () => void;
  onClose: () => void;
}

export function KnowledgeNearDuplicateModal({
  open,
  check,
  saving = false,
  onConfirm,
  onViewExisting,
  onClose,
}: KnowledgeNearDuplicateModalProps) {
  if (!open || !check?.nearDuplicateMatch) return null;

  const match = check.nearDuplicateMatch;

  return (
    <div className="fixed inset-0 z-[225] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="w-full max-w-lg rounded-2xl border border-orange-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Near duplicate detected"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Near Duplicate Detected</h2>
            <p className={saSectionSubtitle}>
              A similar entry with the same intent already exists ({match.similarity}%
              similar).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Existing
          </p>
          <p className="mt-1 font-medium text-slate-900">{match.entry.question}</p>
          <p className="mt-1 text-xs text-orange-800">
            Intent: {match.entryIntentSignature.label}
          </p>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          You can still save, but consider updating the existing entry instead.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={saBtnPrimary}
            disabled={saving}
            onClick={onViewExisting}
          >
            View Existing Entry
          </button>
          <button
            type="button"
            className={saBtnSecondary}
            disabled={saving}
            onClick={onConfirm}
          >
            Save Anyway
          </button>
        </div>

        {saving ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </div>
        ) : null}
      </div>
    </div>
  );
}
