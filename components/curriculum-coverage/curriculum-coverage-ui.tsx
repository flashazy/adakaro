"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  curriculumStatusBadgeClass,
  curriculumStatusCompactEmoji,
  curriculumStatusCompactLabel,
  curriculumStatusLabel,
} from "@/lib/curriculum-coverage/coverage-status";
import {
  curriculumHealthLabel,
} from "@/lib/curriculum-coverage/health-score";
import type {
  CurriculumCoverageRow,
  CurriculumCoverageStatus,
  CurriculumCoverageDistribution,
  CurriculumHealth,
  CurriculumStatusSummary,
  CurriculumAttentionSubject,
  CurriculumActiveTeacher,
  CurriculumTeacherSummaryRow,
  CurriculumClassSummaryRow,
} from "@/lib/curriculum-coverage/types";
import type { CurriculumTrendDirection } from "@/lib/curriculum-coverage/trends";
import { coverageTextClass } from "@/lib/syllabus-coverage/coverage-stats";
import { formatCurriculumLastUpdate, formatCurriculumLastUpdateTable } from "@/lib/curriculum-coverage/insights";
import { formatStaleWarning } from "@/lib/curriculum-coverage/stale";
import {
  academicCardBaseClass,
  academicCardInteractiveClass,
  academicSectionHeadingClass,
} from "@/components/academic/academic-ui-styles";
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Minus,
  MoreVertical,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export function CurriculumStatusBadge({
  status,
  className,
  compact,
}: {
  status: CurriculumCoverageStatus;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ring-1",
          curriculumStatusBadgeClass(status),
          className
        )}
      >
        <span aria-hidden>{curriculumStatusCompactEmoji(status)}</span>
        <span className="truncate">{curriculumStatusCompactLabel(status)}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        curriculumStatusBadgeClass(status),
        className
      )}
    >
      {curriculumStatusLabel(status)}
    </span>
  );
}

export function CurriculumTrendIndicator({
  trendPercent,
  trendDirection,
  className,
}: {
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
  className?: string;
}) {
  if (trendPercent === null || trendDirection === null) {
    return (
      <span className={cn("text-xs text-slate-400", className)}>—</span>
    );
  }

  const Icon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
        ? TrendingDown
        : Minus;
  const color =
    trendDirection === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trendDirection === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-500";

  const label =
    trendDirection === "flat"
      ? "No change"
      : `${trendPercent > 0 ? "+" : ""}${trendPercent}% this month`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        color,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function CurriculumExpectedActualInline({
  actual,
  expected,
  variance,
  className,
}: {
  actual: number;
  expected: number;
  variance: number;
  className?: string;
}) {
  return (
    <div className={cn("tabular-nums leading-tight", className)}>
      <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
        <span className={coverageTextClass(actual)}>{actual}%</span>
        <span className="text-slate-400"> / </span>
        <span className="text-slate-600 dark:text-zinc-400">{expected}%</span>
      </p>
      <p
        className={cn(
          "text-[10px] font-semibold",
          variance >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        )}
      >
        {variance >= 0 ? "+" : ""}
        {variance}%
      </p>
    </div>
  );
}

export function CurriculumCoverageWithTrend({
  coveragePercent,
  trendPercent,
  trendDirection,
  className,
}: {
  coveragePercent: number;
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
  className?: string;
}) {
  return (
    <div className={cn("leading-tight", className)}>
      <p
        className={cn(
          "text-xs font-semibold tabular-nums",
          coverageTextClass(coveragePercent)
        )}
      >
        {coveragePercent}%
      </p>
      <CurriculumTrendIndicator
        trendPercent={trendPercent}
        trendDirection={trendDirection}
        className="text-[10px]"
      />
    </div>
  );
}

export function CurriculumProgressComparison({
  actual,
  expected,
  variance,
  compact,
}: {
  actual: number;
  expected: number;
  variance: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <CurriculumExpectedActualInline
        actual={actual}
        expected={expected}
        variance={variance}
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Expected
          </p>
          <p className="mt-0.5 font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
            {expected}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Actual
          </p>
          <p
            className={cn(
              "mt-0.5 font-semibold tabular-nums",
              coverageTextClass(actual)
            )}
          >
            {actual}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Variance
          </p>
          <p
            className={cn(
              "mt-0.5 font-semibold tabular-nums",
              variance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {variance >= 0 ? "+" : ""}
            {variance}%
          </p>
        </div>
      </div>
    </div>
  );
}

export function CurriculumHealthCard({
  health,
  onClick,
  isActive,
}: {
  health: CurriculumHealth;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const label = curriculumHealthLabel(health.label);
  const accent =
    health.label === "excellent" || health.label === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : health.label === "needs_attention"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">Curriculum health</p>
        <Activity className="h-4 w-4 text-violet-600" aria-hidden />
      </div>
      <p className={cn("mt-2 text-lg font-bold uppercase tracking-wide max-md:mt-1.5 max-md:text-base", accent)}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 max-md:text-xl dark:text-white">
        {health.score}
        <span className="text-sm font-medium text-slate-400">/100</span>
      </p>
    </>
  );

  const cardClass = cn(
    "flex min-h-[88px] flex-col justify-between p-4 max-md:min-h-[72px] max-md:p-3",
    academicCardBaseClass,
    "border-l-[3px] border-l-violet-400/60",
    onClick && academicCardInteractiveClass,
    isActive && "ring-2 ring-violet-400/50 dark:ring-violet-500/40"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cardClass, "text-left")}>
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

export function CurriculumExecutiveSummary({
  summaries,
}: {
  summaries: string[];
}) {
  if (summaries.length === 0) return null;
  return (
    <div
      className={cn(
        "space-y-2 border-l-[3px] border-l-violet-400/60 p-4 max-md:space-y-1.5 max-md:p-3",
        academicCardBaseClass
      )}
    >
      <p className={academicSectionHeadingClass}>Executive summary</p>
      {summaries.map((line) => (
        <p
          key={line}
          className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function CurriculumOverviewActionsMenu({
  onView,
  onOpenTeacher,
  onOpenClass,
  onOpenSubject,
}: {
  onView: () => void;
  onOpenTeacher: () => void;
  onOpenClass: () => void;
  onOpenSubject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const itemClass =
    "block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:inline">Actions</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onView();
              setOpen(false);
            }}
          >
            View Subject
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onOpenTeacher();
              setOpen(false);
            }}
          >
            Open Teacher
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onOpenClass();
              setOpen(false);
            }}
          >
            Open Class
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onOpenSubject();
              setOpen(false);
            }}
          >
            Open Subject
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function formatCurriculumActivityByTeacher(
  teacherName: string,
  subtopicTitle: string,
  status: string
): { headline: string; detail: string } {
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "in_progress"
        ? "In Progress"
        : "Not Started";
  return {
    headline: `${teacherName} marked`,
    detail: `${subtopicTitle} as ${statusLabel}`,
  };
}

export function CurriculumActivityStatusChip({ status }: { status: string }) {
  const chip =
    status === "completed"
      ? {
          label: "Completed",
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
        }
      : status === "in_progress"
        ? {
            label: "Updated",
            className:
              "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
          }
        : {
            label: "Attention",
            className:
              "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
          };

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        chip.className
      )}
    >
      {chip.label}
    </span>
  );
}

export function CurriculumStaleBadge({
  staleDays,
  className,
  compact,
}: {
  staleDays: number | null;
  className?: string;
  compact?: boolean;
}) {
  const warning = formatStaleWarning(staleDays);
  if (!warning) return null;

  if (compact) {
    return (
      <span
        title={warning}
        className={cn(
          "inline-flex items-center text-[10px] font-medium text-amber-700 dark:text-amber-400",
          className
        )}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
        <span className="sr-only">{warning}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      {warning}
    </span>
  );
}

export function CurriculumStatusSummaryBar({
  summary,
}: {
  summary: CurriculumStatusSummary;
}) {
  const items = [
    {
      label: "On Track",
      count: summary.onTrack,
      dot: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50",
    },
    {
      label: "Needs Attention",
      count: summary.needsAttention,
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40",
    },
    {
      label: "At Risk",
      count: summary.atRisk,
      dot: "bg-red-500",
      badge: "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50",
    },
    {
      label: "Completed",
      count: summary.completed,
      dot: "bg-emerald-600",
      badge: "bg-emerald-50 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50",
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 p-2.5 max-md:auto-rows-fr md:flex md:flex-wrap md:gap-2 md:p-3",
        academicCardBaseClass
      )}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ring-1 max-md:w-full md:gap-2 md:px-3 md:text-xs",
            item.badge
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", item.dot)} aria-hidden />
          <span className="truncate tabular-nums">
            {item.label}: {item.count}
          </span>
        </span>
      ))}
    </div>
  );
}

export function SubjectsRequiringAttentionCard({
  subjects,
  onSelect,
}: {
  subjects: CurriculumAttentionSubject[];
  onSelect?: (subject: CurriculumAttentionSubject) => void;
}) {
  return (
    <div className={cn("flex h-full flex-col p-4 max-md:p-3", academicCardBaseClass)}>
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-red-600" aria-hidden />
        <p className={academicSectionHeadingClass}>Subjects requiring attention</p>
      </div>
      {subjects.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No subjects currently flagged for attention.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {subjects.map((s) => (
            <li key={s.rowKey}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                >
                  <span className="min-w-0 truncate text-slate-800 dark:text-zinc-200">
                    {s.subjectName} · {s.className}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      coverageTextClass(s.coveragePercent)
                    )}
                  >
                    {s.coveragePercent}%
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
                  <span className="min-w-0 truncate">
                    {s.subjectName} · {s.className}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      coverageTextClass(s.coveragePercent)
                    )}
                  >
                    {s.coveragePercent}%
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MostActiveTeachersCard({
  teachers,
}: {
  teachers: CurriculumActiveTeacher[];
}) {
  return (
    <div className={cn("flex h-full flex-col p-4 max-md:p-3", academicCardBaseClass)}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        <p className={academicSectionHeadingClass}>Most active teachers</p>
      </div>
      {teachers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No recent teacher activity recorded.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {teachers.map((t) => (
            <li
              key={t.teacherId}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800/50"
            >
              <p className="font-medium text-slate-800 dark:text-zinc-200">
                {t.teacherName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t.updatesThisMonth} update{t.updatesThisMonth === 1 ? "" : "s"} ·{" "}
                {formatCurriculumLastUpdate(t.lastActivityAt)} ·{" "}
                <span className={coverageTextClass(t.averageCoverage)}>
                  {t.averageCoverage}% avg
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CoverageDistributionChart({
  distribution,
}: {
  distribution: CurriculumCoverageDistribution;
}) {
  const segments = [
    { key: "completed", label: "Completed", count: distribution.completed, color: "bg-emerald-500" },
    { key: "onTrack", label: "On Track", count: distribution.onTrack, color: "bg-blue-500" },
    { key: "needsAttention", label: "Needs Attention", count: distribution.needsAttention, color: "bg-amber-400" },
    { key: "atRisk", label: "At Risk", count: distribution.atRisk, color: "bg-red-500" },
    { key: "notStarted", label: "Not Started", count: distribution.notStarted, color: "bg-slate-300 dark:bg-zinc-600" },
  ];
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div className={cn("flex h-full flex-col p-4 max-md:p-3", academicCardBaseClass)}>
      <p className={academicSectionHeadingClass}>Coverage distribution</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No coverage data yet.</p>
      ) : (
        <>
          <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            {segments.map(
              (seg) =>
                seg.count > 0 && (
                  <div
                    key={seg.key}
                    className={cn("h-full transition-all", seg.color)}
                    style={{ width: `${(seg.count / total) * 100}%` }}
                    title={`${seg.label}: ${seg.count}`}
                  />
                )
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {segments.map((seg) => {
              const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
              return (
                <li
                  key={seg.key}
                  className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", seg.color)} />
                    {seg.label}
                  </span>
                  <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                    {pct}% · {seg.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function CurriculumOverviewMobileTrend({
  trendPercent,
  trendDirection,
}: {
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
}) {
  if (trendPercent === null || trendDirection === null) return null;

  const Icon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
        ? TrendingDown
        : Minus;
  const color =
    trendDirection === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trendDirection === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-400";

  return (
    <Icon
      className={cn("ml-0.5 inline h-3 w-3 shrink-0", color)}
      aria-hidden
    />
  );
}

export function CurriculumOverviewMobileList({
  rows,
  onView,
  onOpenTeacher,
  onOpenClass,
  onOpenSubject,
}: {
  rows: CurriculumCoverageRow[];
  onView: (row: CurriculumCoverageRow) => void;
  onOpenTeacher: (teacherId: string) => void;
  onOpenClass: (classId: string) => void;
  onOpenSubject: (row: CurriculumCoverageRow) => void;
}) {
  return (
    <div className="divide-y divide-slate-100 md:hidden dark:divide-zinc-800">
      {rows.map((row) => (
        <article key={row.rowKey} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              {row.subjectName}
            </p>
            <CurriculumStatusBadge status={row.status} compact />
          </div>
          <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
            {row.className} · {row.teacherName}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-slate-50/80 px-2 py-1.5 dark:bg-zinc-800/40">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Coverage
              </p>
              <p
                className={cn(
                  "inline-flex items-center text-xs font-semibold tabular-nums leading-tight",
                  coverageTextClass(row.coveragePercent)
                )}
              >
                {row.coveragePercent}%
                <CurriculumOverviewMobileTrend
                  trendPercent={row.trendPercent}
                  trendDirection={row.trendDirection}
                />
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Expected
              </p>
              <p className="text-xs font-semibold tabular-nums leading-tight text-slate-700 dark:text-zinc-300">
                {row.expectedProgressPercent}%
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Topics
              </p>
              <p className="text-xs font-semibold tabular-nums leading-tight text-slate-700 dark:text-zinc-300">
                {row.completedTopics}/{row.totalTopics}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Variance
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums leading-tight",
                  row.progressVariance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {row.progressVariance >= 0 ? "+" : ""}
                {row.progressVariance}%
              </p>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400">
              <span className="truncate">
                {formatCurriculumLastUpdateTable(row.lastUpdateAt)}
              </span>
              <CurriculumStaleBadge staleDays={row.staleDays} compact />
            </div>
            <CurriculumOverviewActionsMenu
              onView={() => onView(row)}
              onOpenTeacher={() => onOpenTeacher(row.teacherId)}
              onOpenClass={() => onOpenClass(row.classId)}
              onOpenSubject={() => onOpenSubject(row)}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurriculumTeachersMobileList({
  rows,
}: {
  rows: CurriculumTeacherSummaryRow[];
}) {
  return (
    <div className="divide-y divide-slate-100 md:hidden dark:divide-zinc-800">
      {rows.map((row) => (
        <article key={row.teacherId} className="p-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              {row.teacherName}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
              Subjects:{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-zinc-300">
                {row.subjectsAssigned}
              </span>
            </p>
            <div className="mt-1">
              <CurriculumStatusBadge status={row.status} compact />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-slate-50/80 px-2 py-1.5 dark:bg-zinc-800/40">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Coverage
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums leading-tight",
                  coverageTextClass(row.averageCoverage)
                )}
              >
                {row.averageCoverage}%
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Subjects at risk
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums leading-tight",
                  row.subjectsAtRisk > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-400 dark:text-zinc-500"
                )}
              >
                {row.subjectsAtRisk}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Last updated
              </p>
              {row.lastActivityAt ? (
                <p className="text-xs font-semibold leading-tight text-slate-700 dark:text-zinc-300">
                  {formatCurriculumLastUpdate(row.lastActivityAt)}
                </p>
              ) : (
                <p className="text-xs font-medium leading-tight text-slate-400 dark:text-zinc-500">
                  No updates yet
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Trend
              </p>
              {row.trendPercent === null || row.trendDirection === null ? (
                <p className="text-xs font-medium leading-tight text-slate-400 dark:text-zinc-500">
                  No activity
                </p>
              ) : (
                <CurriculumTrendIndicator
                  trendPercent={row.trendPercent}
                  trendDirection={row.trendDirection}
                  className="text-[10px] leading-tight"
                />
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurriculumClassesMobileList({
  rows,
}: {
  rows: CurriculumClassSummaryRow[];
}) {
  return (
    <div className="divide-y divide-slate-100 md:hidden dark:divide-zinc-800">
      {rows.map((row) => (
        <article key={row.classId} className="p-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              {row.className}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
              Subjects:{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-zinc-300">
                {row.subjectsCount}
              </span>
            </p>
            <div className="mt-1">
              <CurriculumStatusBadge status={row.status} compact />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-slate-50/80 px-2 py-1.5 dark:bg-zinc-800/40">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Coverage
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums leading-tight",
                  coverageTextClass(row.averageCoverage)
                )}
              >
                {row.averageCoverage}%
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Completed
              </p>
              <p className="text-xs font-semibold tabular-nums leading-tight text-slate-700 dark:text-zinc-300">
                {row.completedSubjects}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                At risk
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums leading-tight",
                  row.atRiskSubjects > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-400 dark:text-zinc-500"
                )}
              >
                {row.atRiskSubjects}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Trend
              </p>
              {row.trendPercent === null || row.trendDirection === null ? (
                <p className="text-xs font-medium leading-tight text-slate-400 dark:text-zinc-500">
                  No activity
                </p>
              ) : (
                <CurriculumTrendIndicator
                  trendPercent={row.trendPercent}
                  trendDirection={row.trendDirection}
                  className="text-[10px] leading-tight"
                />
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurriculumPaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 dark:text-zinc-400">
        Showing{" "}
        <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
          {from}–{to}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
          {total}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function CurriculumEmptyState() {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-3 p-6 text-center max-md:px-4 max-md:py-8 sm:space-y-4 sm:p-12",
        academicCardBaseClass
      )}
    >
      <BookOpenCheckIcon />
      <div className="space-y-2">
        <p className="text-base font-semibold text-slate-800 dark:text-zinc-200">
          No curriculum coverage records available yet.
        </p>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-zinc-400">
          Teachers can update curriculum progress from their teacher dashboard.
          Coverage will appear here once syllabus updates are submitted.
        </p>
      </div>
      <Link
        href="/teacher-dashboard/syllabus-coverage"
        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60"
      >
        <BookOpenCheck className="h-4 w-4" aria-hidden />
        Open Teacher Syllabus Coverage
      </Link>
    </div>
  );
}

function BookOpenCheckIcon() {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/40">
      <BookOpenCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
    </div>
  );
}
