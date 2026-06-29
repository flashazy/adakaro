"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
} from "@/components/super-admin/super-admin-dashboard-ui";
import type { CurriculumAnalysis } from "@/lib/ai-training/lesson-generator-types";
import type { GeneratedLessonDraft } from "@/lib/ai-training/lesson-generator-types";
import type {
  CriterionBreakdownItem,
  KnowledgeQualityReport,
  ScoreExplanation,
} from "@/lib/ai-training/knowledge-quality-report";
import { CRITERION_TOOLTIPS } from "@/lib/ai-training/knowledge-quality-report";
import { QUALITY_TIER_STYLES } from "@/lib/ai-training/knowledge-quality-rules";
import type { DuplicateRiskLevel } from "@/lib/ai-training/lesson-generation-validator";
import { DUP_STYLES } from "@/components/super-admin/ai-training/generated-lesson-card";
import { cn } from "@/lib/utils";

/* ─── Markdown renderer ─── */

function parseInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export const LessonMarkdownContent = memo(function LessonMarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemo(() => {
    const lines = content.split("\n");
    const result: ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      if (/^```/.test(line)) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          <pre
            key={key++}
            className="my-3 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-xs text-slate-100"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        continue;
      }

      if (/^\*\*[^*]+\*\*$/.test(line)) {
        result.push(
          <h4 key={key++} className="mb-2 mt-5 first:mt-0 text-sm font-bold text-slate-900">
            {line.replace(/\*\*/g, "")}
          </h4>
        );
        i++;
        continue;
      }

      if (/^[-*]\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s/, ""));
          i++;
        }
        result.push(
          <ul key={key++} className="my-2 space-y-1.5 pl-1">
            {items.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span>{parseInline(item)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      if (/^\d+\.\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
          i++;
        }
        result.push(
          <ol key={key++} className="my-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            {items.map((item) => (
              <li key={item} className="leading-relaxed">
                {parseInline(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      const paraLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^[-*#\d]/.test(lines[i].trim()) && !/^\*\*[^*]+\*\*$/.test(lines[i].trim())) {
        paraLines.push(lines[i].trim());
        i++;
      }
      result.push(
        <p key={key++} className="my-2 text-sm leading-relaxed text-slate-700">
          {parseInline(paraLines.join(" "))}
        </p>
      );
    }

    return result;
  }, [content]);

  return <div className={cn("lesson-markdown", className)}>{blocks}</div>;
});

/* ─── Quality breakdown bars ─── */

function barColor(percent: number): string {
  if (percent >= 90) return "bg-emerald-500";
  if (percent >= 75) return "bg-amber-400";
  return "bg-red-400";
}

export function QualityBreakdownBars({
  breakdown,
  compact,
  className,
}: {
  breakdown: CriterionBreakdownItem[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2", className)}>
      {breakdown.map((item) => {
        const pct = item.max > 0 ? (item.earned / item.max) * 100 : 0;
        const tooltip = CRITERION_TOOLTIPS[item.key];
        return (
          <div key={item.key} className="group relative">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className="font-medium text-slate-600"
                title={tooltip}
              >
                {item.label}
              </span>
              <span className="tabular-nums font-semibold text-slate-900">
                {item.earned} / {item.max}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barColor(pct))}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            {!compact && item.deductions.length > 0 ? (
              <p className="mt-0.5 text-[10px] text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">
                {item.deductions[0]?.reason}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Confidence display ─── */

export function ConfidenceDisplay({
  quality,
  confidence,
  reasons = [],
  className,
}: {
  quality: number;
  confidence: number;
  reasons?: string[];
  className?: string;
}) {
  const aligned =
    (quality >= 95 && confidence >= 92) ||
    (quality >= 90 && quality < 95 && confidence >= 85 && confidence <= 95) ||
    (quality >= 80 && quality < 90 && confidence >= 70 && confidence <= 84) ||
    (quality < 80 && confidence < 85);

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality</p>
          <p className="text-2xl font-bold tabular-nums text-indigo-700">{quality}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              confidence >= 85 ? "text-emerald-700" : confidence >= 70 ? "text-amber-700" : "text-red-700"
            )}
          >
            {confidence}%
          </p>
        </div>
      </div>
      {!aligned && reasons.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">
          Confidence reflects retrieval certainty — see reasons below.
        </p>
      ) : null}
      {reasons.length > 0 ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Why this confidence</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
            {reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Explainable AI summary ─── */

export function ExplainableQualitySummary({
  overallQuality,
  explanation,
  className,
}: {
  overallQuality: number;
  explanation: ScoreExplanation;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-indigo-100 bg-indigo-50/40 p-4", className)}>
      <p className="text-xs font-semibold uppercase text-indigo-600">Overall Score · {overallQuality}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">Because:</p>
      <ul className="mt-2 space-y-1">
        {explanation.strengths.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm text-emerald-800">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {s}
          </li>
        ))}
      </ul>
      {explanation.minorDeductions.length > 0 ? (
        <>
          <p className="mt-3 text-xs font-semibold uppercase text-amber-700">Minor deductions</p>
          <ul className="mt-1 space-y-0.5">
            {explanation.minorDeductions.map((d) => (
              <li key={d} className="text-xs text-amber-800">
                {d}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ─── Duplicate explanation ─── */

export function DuplicateExplanation({
  lesson,
  existingCount = 0,
  className,
}: {
  lesson: GeneratedLessonDraft;
  existingCount?: number;
  className?: string;
}) {
  const similarity = Math.round(
    (lesson.qualityReport?.duplicateRiskPercent ?? lesson.scores.duplicateRiskPercent) 
  );
  const risk = lesson.duplicateRisk;
  const isDifferentIntent =
    lesson.qualityReport?.duplicateFalsePositive ||
    lesson.duplicateReason?.toLowerCase().includes("different intent");

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50/80 p-4", className)}>
      <p className="text-xs font-semibold uppercase text-slate-500">Duplicate Analysis</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">Risk</p>
          <span
            className={cn(
              "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              DUP_STYLES[risk]
            )}
          >
            {risk}
          </span>
        </div>
        <div>
          <p className="text-xs text-slate-500">Similarity</p>
          <p className="font-semibold tabular-nums text-slate-900">{similarity}%</p>
        </div>
      </div>
      {existingCount > 0 ? (
        <p className="mt-2 text-xs text-slate-600">
          Compared against <strong>{existingCount}</strong> existing lesson{existingCount === 1 ? "" : "s"}
        </p>
      ) : null}
      {lesson.duplicateReason ? (
        <div className="mt-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Similarity reason</p>
          <p className="mt-1 text-sm text-slate-700">{lesson.duplicateReason}</p>
          {isDifferentIntent ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">Different intent — safe to keep</p>
          ) : null}
        </div>
      ) : risk === "none" || risk === "low" ? (
        <p className="mt-2 text-xs text-emerald-700">No concerning overlap with existing knowledge.</p>
      ) : null}
    </div>
  );
}

/* ─── Coverage recommendations ─── */

const RECOMMENDATION_CATALOG: Record<
  string,
  { label: string; reason: string }
> = {
  "parent-portal": { label: "Parent Portal", reason: "Parents expect self-service access to attendance and fees." },
  "mobile-app": { label: "Mobile App", reason: "Schools ask how staff and parents access Adakaro on phones." },
  integrations: { label: "Integrations", reason: "Enterprise buyers compare Adakaro with existing tools." },
  "teacher-dashboard": { label: "Teacher Dashboard", reason: "Teachers need daily workflow guidance in curriculum." },
  notifications: { label: "SMS Notifications", reason: "Communication gaps are a top admin concern." },
  "fee-collection": { label: "Fee Collection", reason: "Finance workflows drive adoption decisions." },
  timetable: { label: "Timetable", reason: "Scheduling questions appear early in evaluations." },
  security: { label: "Security & Roles", reason: "Data protection is a common blocker for large schools." },
  onboarding: { label: "Getting Started", reason: "New schools need a clear first-week playbook." },
  attendance: { label: "Attendance", reason: "Daily attendance is one of the highest-volume queries." },
  "report-cards": { label: "Report Cards", reason: "Assessment reporting is core to school operations." },
  pricing: { label: "Pricing", reason: "Budget conversations happen before signup." },
};

export function CoverageRecommendations({
  analysis,
  className,
}: {
  analysis: CurriculumAnalysis;
  className?: string;
}) {
  const recommendations = useMemo(() => {
    const seeds = [
      ...analysis.missingConcepts,
      ...analysis.missingIntents.map((i) => i.toLowerCase().replace(/\s+/g, "-")),
      ...analysis.weakCoverage,
    ];
    const seen = new Set<string>();
    const items: Array<{ label: string; reason: string; covered: boolean }> = [];

    for (const key of seeds) {
      const normalized = key.toLowerCase().replace(/\s+/g, "-");
      const match =
        RECOMMENDATION_CATALOG[normalized] ??
        Object.entries(RECOMMENDATION_CATALOG).find(([k]) => normalized.includes(k) || k.includes(normalized))?.[1];
      if (!match || seen.has(match.label)) continue;
      seen.add(match.label);
      items.push({
        ...match,
        covered: analysis.coveredTopics.some((t) => t.includes(normalized)) ||
          analysis.coveredIntents.some((i) => i.toLowerCase().includes(normalized.replace(/-/g, " "))),
      });
    }

    for (const [key, val] of Object.entries(RECOMMENDATION_CATALOG)) {
      if (items.length >= 7) break;
      if (seen.has(val.label)) continue;
      if (analysis.missingConcepts.some((c) => c.includes(key)) || analysis.weakCoverage.some((w) => w.includes(key))) {
        seen.add(val.label);
        items.push({ ...val, covered: false });
      }
    }

    return items.slice(0, 7);
  }, [analysis]);

  if (recommendations.length === 0) return null;

  return (
    <div className={cn("rounded-2xl border border-violet-100 bg-violet-50/40 p-5", className)}>
      <p className="text-sm font-semibold text-violet-900">Recommended next lessons</p>
      <p className="mt-0.5 text-xs text-violet-700/80">
        Topics that would most improve curriculum coverage for {analysis.moduleName}
      </p>
      <ul className="mt-4 space-y-3">
        {recommendations.map((rec) => (
          <li key={rec.label} className="flex gap-3 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-violet-100">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                rec.covered ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
              )}
            >
              {rec.covered ? <Check className="h-3 w-3" /> : "→"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{rec.label}</p>
              <p className="text-xs text-slate-600">{rec.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Knowledge completion progress ─── */

export function KnowledgeCompletionProgress({
  completed,
  target,
  averageQuality,
  readyCount,
  className,
}: {
  completed: number;
  target: number;
  averageQuality?: number;
  readyCount?: number;
  className?: string;
}) {
  const pct = target > 0 ? Math.round((completed / target) * 100) : 0;
  const remaining = Math.max(0, target - completed);
  const tier =
    pct >= 75 ? "Advanced" : pct >= 40 ? "Intermediate" : pct >= 15 ? "Beginner" : "Getting Started";

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Knowledge Completion</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{pct}%</p>
          <p className="text-sm text-slate-500">{tier}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">
            <span className="font-semibold text-slate-900">{completed}</span> / {target} lessons
          </p>
          {averageQuality != null ? (
            <p className="mt-1 text-slate-500">
              Avg quality <span className="font-semibold text-indigo-700">{averageQuality}%</span>
            </p>
          ) : null}
          {readyCount != null ? (
            <p className="text-emerald-700">
              <span className="font-semibold">{readyCount}</span> ready
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{remaining}</span> lesson{remaining === 1 ? "" : "s"} remaining to complete this module
      </p>
    </div>
  );
}

/* ─── Generation success banner ─── */

export function GenerationSuccessBanner({
  savedCount,
  completedLessons,
  targetLessons,
  averageQuality,
  onContinue,
  onGoToQueue,
  onReviewSaved,
  onDismiss,
}: {
  savedCount: number;
  completedLessons: number;
  targetLessons: number;
  averageQuality?: number;
  onContinue: () => void;
  onGoToQueue: () => void;
  onReviewSaved: () => void;
  onDismiss: () => void;
}) {
  const pct = targetLessons > 0 ? Math.round((completedLessons / targetLessons) * 1000) / 10 : 0;
  const remaining = Math.max(0, targetLessons - completedLessons);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-6 shadow-lg shadow-emerald-100/50">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
          <Check className="h-6 w-6" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900">
            {savedCount} lesson{savedCount === 1 ? "" : "s"} successfully added
          </h3>
          <p className="text-sm font-medium text-emerald-700">Approval Queue</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-emerald-100">
              <p className="text-xs text-slate-500">Progress</p>
              <p className="text-lg font-bold text-slate-900">
                {completedLessons} / {targetLessons}
              </p>
              <p className="text-sm font-semibold text-indigo-600">{pct}%</p>
            </div>
            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-emerald-100">
              <p className="text-xs text-slate-500">Estimated completion</p>
              <p className="text-lg font-bold text-slate-900">{remaining}</p>
              <p className="text-xs text-slate-500">lessons remaining</p>
            </div>
            {averageQuality != null ? (
              <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-emerald-100">
                <p className="text-xs text-slate-500">Batch quality</p>
                <p className="text-lg font-bold text-indigo-700">{averageQuality}%</p>
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            <Sparkles className="mr-1 inline h-4 w-4 text-indigo-500" />
            Suggested next action: Generate another {Math.min(10, remaining)} lesson{Math.min(10, remaining) === 1 ? "" : "s"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={saBtnPrimary} onClick={onContinue}>
              Continue Generating
            </button>
            <button type="button" className={saBtnSecondary} onClick={onGoToQueue}>
              Go to Approval Queue
            </button>
            <button type="button" className={saBtnSecondary} onClick={onReviewSaved}>
              Review Saved Lessons
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Collapsible section ─── */

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/80"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          {title}
          {badge}
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 px-4 pb-4 pt-2">{children}</div> : null}
    </div>
  );
}

/* ─── Quality report inline (uses report from engine) ─── */

export function InlineQualityReport({
  report,
  showCalibration,
}: {
  report: KnowledgeQualityReport;
  showCalibration?: boolean;
}) {
  const tier = QUALITY_TIER_STYLES[report.visualTier];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <ConfidenceDisplay
          quality={report.overallQuality}
          confidence={report.reviewerConfidence}
          reasons={report.confidenceReasons}
          className="flex-1 border-0 bg-slate-50 p-3"
        />
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ring-1 ring-inset",
            tier.className
          )}
        >
          {report.grade}
        </span>
      </div>
      <QualityBreakdownBars breakdown={report.breakdown} />
      <ExplainableQualitySummary
        overallQuality={report.overallQuality}
        explanation={report.scoreExplanation}
      />
      {showCalibration && report.calibrationAdjustments?.length ? (
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-2 text-[10px] text-indigo-900">
          {report.calibrationAdjustments.map((adj) => (
            <p key={adj.rule}>
              {adj.rule}: {adj.originalScore} → {adj.adjustedScore} — {adj.reason}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  status,
  quality,
}: {
  status?: string;
  quality?: number;
}) {
  const tierKey =
    quality != null && quality >= 95
      ? "excellent"
      : quality != null && quality >= 90
        ? "ready"
        : quality != null && quality >= 80
          ? "needs_improvement"
          : quality != null && quality >= 65
            ? "human_review"
            : "reject";
  const tier = QUALITY_TIER_STYLES[tierKey];
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
        tier.className
      )}
    >
      {status?.replace(/_/g, " ") ?? tier.label}
    </span>
  );
}

export function DupRiskBadge({ risk }: { risk: DuplicateRiskLevel }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        DUP_STYLES[risk]
      )}
    >
      {risk}
    </span>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help text-slate-400 hover:text-slate-600">
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}
