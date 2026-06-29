"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  buildRecommendedAnswerTemplate,
  validateKnowledgeWritingStandard,
  autoFixProfessionalLanguage,
  autoFixTimelessWording,
  type KnowledgeWritingDraft,
  type WritingStandardValidation,
} from "@/lib/ai-training/knowledge-writing-standard";
import type { EnterpriseReadinessResult } from "@/lib/ai-training/knowledge-authoring";
import { cn } from "@/lib/utils";

export function KnowledgeWritingChecklist({
  draft,
  onApplyTemplate,
  readiness,
  onAutoFixLanguage,
  onFixAllQuality,
  fixingAll,
}: {
  draft: KnowledgeWritingDraft;
  onApplyTemplate?: () => void;
  readiness?: EnterpriseReadinessResult | null;
  onAutoFixLanguage?: () => void;
  onFixAllQuality?: () => void;
  fixingAll?: boolean;
}) {
  const validation = useMemo(
    () => validateKnowledgeWritingStandard(draft),
    [draft]
  );

  const [expanded, setExpanded] = useState(true);
  const confidence = readiness?.confidenceScore ?? validation.languageScore;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">
            Enterprise Quality Checklist
          </span>
          <StatusBadge validation={validation} readiness={readiness} />
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-700">
            {confidence}% confidence
          </span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <ChecklistGrid validation={validation} />

          <ProfessionalLanguagePanel validation={validation} onAutoFix={onAutoFixLanguage} />

          <TimelessLanguagePanel validation={validation} onAutoFix={onAutoFixLanguage} />

          {validation.failures
            .filter((f) => !["professional-language", "timeless"].includes(f.ruleId))
            .slice(0, 6)
            .map((failure) => (
              <FailureDetailCard key={`${failure.ruleId}-${failure.word}`} failure={failure} tone="rose" />
            ))}

          {readiness && readiness.blockers.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
              {readiness.blockers.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : validation.issues.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
              {validation.issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}

          {validation.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              {validation.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {onFixAllQuality ? (
              <button
                type="button"
                className={saBtnPrimarySm}
                disabled={fixingAll}
                onClick={onFixAllQuality}
              >
                {fixingAll ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                )}
                Fix All Quality Issues
              </button>
            ) : null}
            {onApplyTemplate && !draft.answer.trim() && draft.question.trim() ? (
              <button type="button" className={saBtnSecondarySm} onClick={onApplyTemplate}>
                Insert recommended answer structure
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({
  validation,
  readiness,
}: {
  validation: WritingStandardValidation;
  readiness?: EnterpriseReadinessResult | null;
}) {
  const ready = readiness?.ready ?? validation.passed;
  const review = readiness ? !readiness.ready && readiness.writingValidation.requiredPassed : validation.requiredPassed;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        ready
          ? "bg-emerald-100 text-emerald-800"
          : review
            ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-800"
      )}
    >
      {ready ? "Enterprise Ready" : review ? "Review" : "Incomplete"}
    </span>
  );
}

function FailureDetailCard({
  failure,
  tone,
}: {
  failure: import("@/lib/ai-training/knowledge-writing-standard").RuleFailure;
  tone: "rose" | "amber";
}) {
  const border = tone === "rose" ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/50";
  const title = tone === "rose" ? "text-rose-900" : "text-amber-900";
  const body = tone === "rose" ? "text-rose-800" : "text-amber-800";

  return (
    <div className={cn("rounded-md border p-2.5 text-[11px]", border)}>
      <p className={cn("font-semibold", title)}>Problem</p>
      <p className={cn("mt-0.5 italic", body)}>&quot;{failure.sentence}&quot;</p>
      <p className={cn("mt-1.5 font-semibold", title)}>Flag</p>
      <p className={body}>{failure.word}</p>
      <p className={cn("mt-1.5 font-semibold", title)}>Reason</p>
      <p className={body}>{failure.reason}</p>
      <p className={cn("mt-1.5 font-semibold", title)}>Suggested replacement</p>
      <p className={body}>{failure.suggestion}</p>
    </div>
  );
}

function ProfessionalLanguagePanel({
  validation,
  onAutoFix,
}: {
  validation: WritingStandardValidation;
  onAutoFix?: () => void;
}) {
  const profItem = validation.checklist.find((c) => c.id === "professional-language");
  if (!profItem || profItem.passed) return null;

  const ruleFailures = profItem.failures ?? validation.failures.filter((f) => f.ruleId === "professional-language");

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold text-rose-900">Professional Language</p>
        {onAutoFix ? (
          <button type="button" className={saBtnSecondarySm} onClick={onAutoFix}>
            <Wand2 className="mr-1 h-3 w-3" />
            Auto Fix
          </button>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">
        {ruleFailures.slice(0, 6).map((failure, idx) => (
          <FailureDetailCard key={`${failure.word}-${idx}`} failure={failure} tone="rose" />
        ))}
      </div>
    </div>
  );
}

function TimelessLanguagePanel({
  validation,
  onAutoFix,
}: {
  validation: WritingStandardValidation;
  onAutoFix?: () => void;
}) {
  const item = validation.checklist.find((c) => c.id === "timeless");
  if (!item || item.passed) return null;

  const ruleFailures = item.failures ?? validation.failures.filter((f) => f.ruleId === "timeless");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold text-amber-900">Timeless Wording</p>
        {onAutoFix ? (
          <button type="button" className={saBtnSecondarySm} onClick={onAutoFix}>
            <Wand2 className="mr-1 h-3 w-3" />
            Auto Fix
          </button>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">
        {ruleFailures.slice(0, 6).map((failure, idx) => (
          <FailureDetailCard key={`${failure.word}-${idx}`} failure={failure} tone="amber" />
        ))}
      </div>
    </div>
  );
}

function ChecklistGrid({ validation }: { validation: WritingStandardValidation }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {validation.checklist.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
            item.passed ? "text-slate-700" : item.required ? "text-red-800" : "text-amber-800"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
              item.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
            )}
            aria-hidden
          >
            {item.passed ? <Check className="h-3 w-3" /> : null}
          </span>
          <span>
            {item.label}
            {item.hint && !item.passed ? (
              <span className="mt-0.5 block text-[10px] opacity-80">{item.hint}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function KnowledgePostSaveRecommendations({
  recommendations,
  onCreateLesson,
  onDismiss,
}: {
  recommendations: Array<{
    question: string;
    reason: string;
    supportingReasons?: string[];
    dependentLessonCount?: number;
    priorityScore: number;
    priorityLevel: string;
    starRating: number;
    inDatabase: boolean;
  }>;
  onCreateLesson: (question: string) => void;
  onDismiss: () => void;
}) {
  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <Sparkles className="h-4 w-4" />
            Recommended Next Lessons
          </p>
          <p className={cn(saSectionSubtitle, "mt-0.5")}>
            Missing knowledge detected from the dependency graph.
          </p>
        </div>
        <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {recommendations.map((rec) => (
          <li
            key={rec.question.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white/80 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900">{rec.question}</p>
              <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-slate-500">{rec.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-600">
                {"★".repeat(rec.starRating)}
                <span className="text-slate-300">{"★".repeat(5 - rec.starRating)}</span>
              </span>
              <span className="text-[10px] font-bold tabular-nums text-slate-600">
                {rec.priorityScore}
              </span>
              {!rec.inDatabase ? (
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  onClick={() => onCreateLesson(rec.question)}
                >
                  Create
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export {
  buildRecommendedAnswerTemplate,
  autoFixProfessionalLanguage,
  autoFixTimelessWording,
};
