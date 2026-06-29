"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Filter,
  Link2,
  Sparkles,
  Star,
} from "lucide-react";
import type { PlannerFilter } from "@/lib/ai-training/knowledge-curriculum-planner";
import { cn } from "@/lib/utils";

export interface PriorityLessonSuggestionApi {
  question: string;
  entryId: string | null;
  inDatabase: boolean;
  reason: string;
  priorityScore: number;
  priorityLevel: "critical" | "high" | "medium" | "low";
  starRating: 1 | 2 | 3 | 4 | 5;
  category: string;
  intent: string;
  moduleId?: string | null;
  moduleName: string | null;
  factors: {
    importance: number;
    searchFrequency: number;
    dependencyWeight: number;
    coverageGap: number;
    businessValue: number;
    customerImpact: number;
    aiConfidence: number;
  };
  searchDemand: "high" | "medium" | "low" | "none";
  customerImpact: "very_high" | "high" | "medium" | "low";
  coverageContribution: number;
  prerequisites: Array<{
    question: string;
    entryId: string | null;
    completed: boolean;
  }>;
  sources: string[];
  becauseYouCreated: string | null;
}

const FILTER_OPTIONS: Array<{ id: PlannerFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "coverage_gap", label: "Coverage gap" },
  { id: "recently_searched", label: "Recently searched" },
  { id: "most_requested", label: "Most requested" },
  { id: "low_confidence", label: "AI confidence" },
];

const PRIORITY_STYLES = {
  critical: {
    badge: "bg-rose-100 text-rose-800 ring-rose-200",
    border: "border-rose-200/80",
    bg: "bg-gradient-to-br from-rose-50/80 to-white",
    label: "Critical",
  },
  high: {
    badge: "bg-amber-100 text-amber-900 ring-amber-200",
    border: "border-amber-200/80",
    bg: "bg-gradient-to-br from-amber-50/60 to-white",
    label: "High",
  },
  medium: {
    badge: "bg-sky-100 text-sky-800 ring-sky-200",
    border: "border-sky-200/80",
    bg: "bg-gradient-to-br from-sky-50/50 to-white",
    label: "Medium",
  },
  low: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    border: "border-slate-200/80",
    bg: "bg-white",
    label: "Low",
  },
} as const;

function StarRating({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${count} of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", i < count ? "fill-current" : "fill-none opacity-25")}
          aria-hidden
        />
      ))}
    </span>
  );
}

function applyClientFilter(
  items: PriorityLessonSuggestionApi[],
  filter: PlannerFilter
): PriorityLessonSuggestionApi[] {
  let result = [...items];
  switch (filter) {
    case "critical":
      result = result.filter((s) => s.priorityLevel === "critical");
      break;
    case "high":
      result = result.filter((s) => s.priorityLevel === "critical" || s.priorityLevel === "high");
      break;
    case "coverage_gap":
      result = result.sort((a, b) => b.factors.coverageGap - a.factors.coverageGap);
      break;
    case "recently_searched":
      result = result
        .filter((s) => s.searchDemand !== "none")
        .sort((a, b) => b.factors.searchFrequency - a.factors.searchFrequency);
      break;
    case "most_requested":
      result = result.sort((a, b) => b.factors.searchFrequency - a.factors.searchFrequency);
      break;
    case "low_confidence":
      result = result.sort((a, b) => b.factors.aiConfidence - a.factors.aiConfidence);
      break;
    default:
      break;
  }
  return result.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function SuggestedRelatedLessons({
  suggestions,
  becauseYouCreated,
  onSelectEntry,
  onCreateLesson,
  compact = false,
}: {
  suggestions: PriorityLessonSuggestionApi[];
  becauseYouCreated?: string | null;
  onSelectEntry?: (entryId: string) => void;
  onCreateLesson?: (question: string, category: string) => void;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<PlannerFilter>("all");

  const filtered = useMemo(
    () => applyClientFilter(suggestions, filter),
    [suggestions, filter]
  );

  if (suggestions.length === 0) return null;

  const missing = filtered.filter((s) => !s.inDatabase);
  const showBecause = becauseYouCreated && missing.some((s) => s.becauseYouCreated);

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" />
          Priority Curriculum Planner
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Filter className="h-3 w-3" aria-hidden />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as PlannerFilter)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700"
            aria-label="Filter suggestions"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showBecause ? (
        <p className="mt-2 text-xs text-indigo-800/80">
          Because you created{" "}
          <span className="font-semibold text-indigo-900">&ldquo;{becauseYouCreated}&rdquo;</span>
          , recommend next:
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-600">
          Ranked by business value, coverage gaps, dependencies, and search demand.
        </p>
      )}

      <ul className={cn("mt-3 space-y-2", compact && "max-h-[420px] overflow-y-auto pr-1")}>
        {filtered.map((lesson) => (
          <SuggestionCard
            key={lesson.question}
            lesson={lesson}
            onSelectEntry={onSelectEntry}
            onCreateLesson={onCreateLesson}
          />
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-2 text-center text-xs text-slate-500">No suggestions match this filter.</p>
      ) : null}
    </div>
  );
}

function SuggestionCard({
  lesson,
  onSelectEntry,
  onCreateLesson,
}: {
  lesson: PriorityLessonSuggestionApi;
  onSelectEntry?: (entryId: string) => void;
  onCreateLesson?: (question: string, category: string) => void;
}) {
  const styles = PRIORITY_STYLES[lesson.priorityLevel];

  return (
    <li
      className={cn(
        "rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md",
        styles.border,
        styles.bg
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StarRating count={lesson.starRating} />
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
              styles.badge
            )}
          >
            {styles.label}
          </span>
          {!lesson.inDatabase ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              Missing
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              In KB
            </span>
          )}
        </div>
        <span className="text-xs font-bold tabular-nums text-slate-700">
          Priority {lesson.priorityScore}
        </span>
      </div>

      {lesson.entryId && onSelectEntry ? (
        <button
          type="button"
          className="mt-2 w-full text-left text-sm font-semibold text-slate-900 hover:text-indigo-800"
          onClick={() => onSelectEntry(lesson.entryId!)}
        >
          {lesson.question}
        </button>
      ) : onCreateLesson && !lesson.inDatabase ? (
        <button
          type="button"
          className="mt-2 flex w-full items-center gap-1.5 text-left text-sm font-semibold text-indigo-900 hover:text-indigo-700"
          onClick={() => onCreateLesson(lesson.question, lesson.category)}
        >
          {lesson.question}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      ) : (
        <p className="mt-2 text-sm font-semibold text-slate-900">{lesson.question}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <MetaPill label={lesson.category} />
        <MetaPill label={lesson.intent} />
        {lesson.moduleName ? <MetaPill label={lesson.moduleName} muted /> : null}
      </div>

      {!compactMetricsHidden(lesson) ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <FactorPill label="Importance" value={lesson.factors.importance} />
          <FactorPill label="Search" value={lesson.factors.searchFrequency} hint={lesson.searchDemand} />
          <FactorPill label="Impact" value={lesson.factors.customerImpact} hint={lesson.customerImpact.replace("_", " ")} />
          <FactorPill label="Coverage" value={lesson.coverageContribution} suffix="%" />
        </div>
      ) : null}

      {lesson.prerequisites.length > 0 ? (
        <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-inset ring-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Depends on</p>
          <ul className="mt-1 space-y-0.5">
            {lesson.prerequisites.map((dep) => (
              <li key={dep.question} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                {dep.completed ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-3 w-3 text-amber-500" aria-hidden />
                )}
                <span className={dep.completed ? "text-slate-600" : "font-medium text-amber-900"}>
                  {dep.question}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{lesson.reason}</p>
    </li>
  );
}

function compactMetricsHidden(_lesson: PriorityLessonSuggestionApi): boolean {
  return false;
}

function MetaPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        muted ? "bg-slate-100 text-slate-600" : "bg-indigo-100/80 text-indigo-800"
      )}
    >
      {label}
    </span>
  );
}

function FactorPill({
  label,
  value,
  suffix = "",
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-white/80 px-2 py-1.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[9px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="text-xs font-bold tabular-nums text-slate-800">
        {value}
        {suffix}
      </p>
      {hint ? <p className="truncate text-[9px] capitalize text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function LegacyRelatedLessonsList({
  lessons,
  onSelectEntry,
}: {
  lessons: Array<{
    question: string;
    entryId: string | null;
    inDatabase: boolean;
  }>;
  onSelectEntry: (entryId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
        <Link2 className="h-3.5 w-3.5" />
        Suggested Related Lessons
      </div>
      <ul className="mt-2 space-y-1.5">
        {lessons.map((lesson) => (
          <li key={lesson.question} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                lesson.inDatabase ? "bg-emerald-500" : "bg-amber-400"
              )}
            />
            {lesson.entryId ? (
              <button
                type="button"
                className="text-left text-xs text-indigo-800 hover:underline"
                onClick={() => onSelectEntry(lesson.entryId!)}
              >
                {lesson.question}
              </button>
            ) : (
              <span className="text-xs text-slate-700">{lesson.question}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
