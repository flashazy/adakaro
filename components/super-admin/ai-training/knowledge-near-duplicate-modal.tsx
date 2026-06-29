"use client";

import { Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { DUPLICATE_SAVE_RECOMMENDATION_LABELS } from "@/lib/ai-training/knowledge-duplicates";
import { DuplicateAnalysisSummary } from "./duplicate-analysis-summary";
import type { DuplicateCheckApiResult } from "./knowledge-duplicate-panel";

interface KnowledgeNearDuplicateModalProps {
  open: boolean;
  check: DuplicateCheckApiResult | null;
  currentQuestion?: string;
  currentCategory?: string;
  saving?: boolean;
  onConfirm: () => void;
  onViewExisting: () => void;
  onClose: () => void;
}

export function KnowledgeNearDuplicateModal({
  open,
  check,
  currentQuestion,
  currentCategory,
  saving = false,
  onConfirm,
  onViewExisting,
  onClose,
}: KnowledgeNearDuplicateModalProps) {
  if (!open || !check?.nearDuplicateMatch) return null;

  const match = check.nearDuplicateMatch;
  const isRelatedEntity = match.scores.entitySimilarity < 0.25;
  const recommendation = isRelatedEntity
    ? DUPLICATE_SAVE_RECOMMENDATION_LABELS.related_entry
    : DUPLICATE_SAVE_RECOMMENDATION_LABELS.near_duplicate;

  return (
    <div className="fixed inset-0 z-[225] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-orange-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Duplicate analysis"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{recommendation}</h2>
            <p className={saSectionSubtitle}>
              {isRelatedEntity
                ? "Same wording style but a different entity — safe to save as a new lesson."
                : "Similar intent detected. You may view the existing entry or save anyway."}
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
            currentCategory={currentCategory}
            currentIntent={check.currentIntentSignature}
            currentEntity={check.currentEntity}
            match={match}
            recommendationLabel={recommendation}
            recommendationTone={isRelatedEntity ? "success" : "warning"}
          />
        </div>

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
