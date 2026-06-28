"use client";

import {
  AlertTriangle,
  Eye,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import type { GeneratedLessonDraft } from "@/lib/ai-training/lesson-generator";
import type { DuplicateRiskLevel, QualityGrade } from "@/lib/ai-training/lesson-generation-validator";
import { cn } from "@/lib/utils";

const GRADE_STYLES: Record<QualityGrade, string> = {
  "A+": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  A: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  B: "bg-sky-100 text-sky-800 ring-sky-200",
  C: "bg-amber-100 text-amber-800 ring-amber-200",
  "Needs Review": "bg-red-100 text-red-800 ring-red-200",
};

const DUP_STYLES: Record<DuplicateRiskLevel, string> = {
  none: "bg-emerald-100 text-emerald-700",
  low: "bg-sky-100 text-sky-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

interface GeneratedLessonCardProps {
  lesson: GeneratedLessonDraft;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onPreview: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onDiscard: () => void;
  onDuplicateReport: () => void;
}

export function GeneratedLessonCard({
  lesson,
  selected,
  onSelect,
  onPreview,
  onEdit,
  onRegenerate,
  onApprove,
  onDiscard,
  onDuplicateReport,
}: GeneratedLessonCardProps) {
  const discarded = lesson.reviewStatus === "discarded";
  const approved = lesson.reviewStatus === "approved";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-all",
        discarded && "opacity-50",
        approved && "border-emerald-200 bg-emerald-50/30",
        selected ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-3">
        {onSelect ? (
          <input
            type="checkbox"
            checked={selected ?? false}
            disabled={discarded}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
                GRADE_STYLES[lesson.overallGrade]
              )}
            >
              {lesson.overallGrade}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
              {lesson.intentLabel}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                DUP_STYLES[lesson.duplicateRisk]
              )}
            >
              Dup: {lesson.duplicateRisk}
            </span>
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {lesson.priority}
            </span>
          </div>
          <p className="mt-2 font-medium text-slate-900">{lesson.question}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
            {lesson.answer.replace(/\*\*/g, "").slice(0, 160)}…
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Coverage: {lesson.scores.coverageScore}</span>
            <span>Quality: {lesson.scores.overallScore}</span>
            <span>Confidence: {lesson.estimatedConfidence}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button type="button" className={saBtnSecondarySm} onClick={onPreview}>
          <Eye className="mr-1 h-3 w-3" />
          Preview
        </button>
        <button type="button" className={saBtnSecondarySm} onClick={onEdit} disabled={discarded}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </button>
        <button type="button" className={saBtnSecondarySm} onClick={onRegenerate} disabled={discarded}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Regenerate
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          onClick={onDuplicateReport}
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          Duplicate Report
        </button>
        {!approved && !discarded ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            onClick={onApprove}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Save to Queue
          </button>
        ) : null}
        {!discarded ? (
          <button
            type="button"
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            onClick={onDiscard}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Discard
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { GRADE_STYLES, DUP_STYLES };
