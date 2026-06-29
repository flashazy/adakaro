"use client";

import { Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { DUPLICATE_SAVE_RECOMMENDATION_LABELS } from "@/lib/ai-training/knowledge-duplicates";
import type { DuplicateSaveAction } from "@/lib/ai-training/types";
import { DuplicateAnalysisSummary } from "./duplicate-analysis-summary";
import type { DuplicateCheckApiResult } from "./knowledge-duplicate-panel";

interface KnowledgeDuplicateSaveModalProps {
  open: boolean;
  check: DuplicateCheckApiResult | null;
  currentQuestion?: string;
  currentCategory?: string;
  saving?: boolean;
  onAction: (action: DuplicateSaveAction) => void;
  onClose: () => void;
}

export function KnowledgeDuplicateSaveModal({
  open,
  check,
  currentQuestion,
  currentCategory,
  saving = false,
  onAction,
  onClose,
}: KnowledgeDuplicateSaveModalProps) {
  if (!open || !check?.exactMatch) return null;

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge entry already exists"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {DUPLICATE_SAVE_RECOMMENDATION_LABELS.exact_duplicate}
            </h2>
            <p className={saSectionSubtitle}>
              Strongly recommend editing the existing entry instead of creating a duplicate.
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

        <div className="mt-4">
          <DuplicateAnalysisSummary
            currentQuestion={currentQuestion ?? check.intentComparison?.currentQuestion ?? ""}
            currentCategory={currentCategory ?? check.exactMatch.entry.category}
            currentIntent={check.currentIntentSignature}
            currentEntity={check.currentEntity}
            match={check.exactMatch}
            recommendationLabel={DUPLICATE_SAVE_RECOMMENDATION_LABELS.exact_duplicate}
            recommendationTone="danger"
          />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-700">Choose one:</p>
        <ul className="mt-3 space-y-2">
          <ActionButton
            label="Update Existing Entry"
            hint="Recommended — merge your changes into the existing entry."
            recommended
            disabled={saving}
            onClick={() => onAction("update_existing")}
          />
          <ActionButton
            label="Replace Existing Answer"
            hint="Keep the existing question and metadata; only replace the answer."
            disabled={saving}
            onClick={() => onAction("replace_answer")}
          />
          <ActionButton
            label="Create New Version"
            hint="Save as a new version of the existing entry with full content."
            disabled={saving}
            onClick={() => onAction("new_version")}
          />
          <ActionButton
            label="Cancel"
            hint="Go back and edit your question or content."
            disabled={saving}
            onClick={onClose}
          />
        </ul>

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

function ActionButton({
  label,
  hint,
  recommended,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        className={
          recommended
            ? saBtnPrimary + " w-full justify-start text-left"
            : saBtnSecondary + " w-full justify-start text-left"
        }
        onClick={onClick}
      >
        <span className="block font-semibold">
          {label}
          {recommended ? (
            <span className="ml-2 text-xs font-normal opacity-80">(recommended)</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs font-normal opacity-80">{hint}</span>
      </button>
    </li>
  );
}
