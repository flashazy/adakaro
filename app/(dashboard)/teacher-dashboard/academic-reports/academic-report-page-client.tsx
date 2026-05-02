"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type {
  AcademicReportLiveSupplement,
  HistoricalTermSubjectMetrics,
} from "@/lib/academic-report-types";
import { buildSubjectCompareRows } from "@/lib/academic-report-comparison";
import {
  hasDistributionTableData,
  resolveAcademicReportDistributionRows,
} from "@/lib/academic-report-distribution-display";
import { getRecommendedActionLines } from "@/lib/academic-report-recommendations";
import type { SchoolLevel } from "@/lib/school-level";
import { AcademicReportToolbar } from "./academic-report-toolbar";

const SECTION_IDS = [
  "overall",
  "distribution",
  "subject_ranking",
  "teacher_performance",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

const STORAGE_KEY_PREFIX = "academic-report-sections:";

function defaultExpanded(): Record<SectionId, boolean> {
  return {
    overall: false,
    distribution: false,
    subject_ranking: false,
    teacher_performance: false,
  };
}

function mergeStored(
  raw: unknown
): Partial<Record<SectionId, boolean>> | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<SectionId, boolean>> = {};
  for (const id of SECTION_IDS) {
    if (typeof o[id] === "boolean") out[id] = o[id] as boolean;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${n}%`;
}

function distributionSectionEmptyMessage(
  displaySchoolLevel: SchoolLevel,
  divisionMode: AcademicPerformanceReportData["division_mode"]
): string {
  if (displaySchoolLevel === "primary" && divisionMode !== "primary_grades") {
    return "This report was generated before the current school level setting. Regenerate the academic report to show Primary grade distribution.";
  }
  if (displaySchoolLevel === "secondary" && divisionMode !== "necta") {
    return "This report was generated before the current school level setting. Regenerate the academic report to show NECTA division distribution.";
  }
  return "No distribution data available for this report yet.";
}

type ReportSectionKind = Parameters<
  typeof getRecommendedActionLines
>[0]["section"];

function estimateCountFromPct(
  pct: number | null | undefined,
  total: number
): number | null {
  if (pct == null || !Number.isFinite(Number(pct)) || total <= 0) return null;
  return Math.min(total, Math.max(0, Math.round((Number(pct) / 100) * total)));
}

function formatActionLineForDashboard(line: string): string {
  return line
    .replace(/^💡\s*Recommend:\s*/i, "")
    .replace(/^✅\s*/u, "")
    .trim();
}

function mergeTopRecommendedActionLines(args: {
  data: AcademicPerformanceReportData;
  distributionRubricSecondary: boolean;
  compareTermId: string;
  previousTermMetricsBySubject: HistoricalTermSubjectMetrics | null;
  atRiskCount: number;
}): string[] {
  const sections: ReportSectionKind[] = [
    "overall",
    "distribution",
    "subject_ranking",
    "teacher_performance",
  ];
  const isPositiveOnly = (line: string) =>
    line.includes("No action needed") || line.includes("Keep up the good work");
  const seen = new Set<string>();
  const actionable: string[] = [];
  for (const section of sections) {
    const lines = getRecommendedActionLines({
      section,
      data: args.data,
      showNectaDivision: args.distributionRubricSecondary,
      compareTermId: args.compareTermId,
      previousTermMetricsBySubject: args.previousTermMetricsBySubject,
    });
    for (const line of lines) {
      if (isPositiveOnly(line)) continue;
      if (seen.has(line)) continue;
      seen.add(line);
      actionable.push(line);
    }
  }
  const followAtRisk = "Follow up with at-risk students (see list below).";
  const mentionsAtRisk = (s: string) =>
    /at[-\s]?risk|struggling students|parent meeting/i.test(s);

  if (actionable.length > 0) {
    const out = actionable.map(formatActionLineForDashboard);
    if (args.atRiskCount > 0 && !out.some(mentionsAtRisk)) {
      out.unshift(followAtRisk);
    }
    return out;
  }
  if (args.atRiskCount > 0) {
    return [
      followAtRisk,
      "Review detailed sections below for subjects and division spread.",
    ];
  }
  return ["No urgent actions right now — keep monitoring class progress."];
}

type ClassHealthStatus = "healthy" | "attention" | "at_risk";

function classHealthStatus(args: {
  passPct: number | null | undefined;
  atRiskCount: number;
  totalStudents: number;
}): ClassHealthStatus {
  const { passPct, atRiskCount, totalStudents } = args;
  if (totalStudents <= 0) return "attention";
  if (passPct == null || !Number.isFinite(passPct)) return "attention";
  if (passPct < 50 || atRiskCount >= 3) return "at_risk";
  if (passPct >= 75 && atRiskCount === 0) return "healthy";
  return "attention";
}

function strongestWeakestFromCompareRows(
  rows: ReturnType<typeof buildSubjectCompareRows>
): {
  strongest: { subject: string; pct: number } | null;
  weakest: { subject: string; pct: number } | null;
} {
  const scored = rows.filter(
    (r): r is (typeof rows)[number] & { current: number } =>
      r.current != null && Number.isFinite(r.current)
  );
  if (scored.length === 0) return { strongest: null, weakest: null };
  let max = scored[0]!;
  let min = scored[0]!;
  for (const r of scored) {
    if (r.current > max.current) max = r;
    if (r.current < min.current) min = r;
  }
  return {
    strongest: { subject: max.subject, pct: max.current },
    weakest: { subject: min.subject, pct: min.current },
  };
}

function buildOverallInterpretation(args: {
  passN: number | null;
  totalStudents: number;
  atRiskCount: number;
}): string | null {
  const { passN, totalStudents, atRiskCount } = args;
  if (totalStudents <= 0) return null;
  if (passN != null) {
    if (atRiskCount > 0) {
      return `${passN} of ${totalStudents} students passed. ${atRiskCount} ${atRiskCount === 1 ? "student needs" : "students need"} follow-up.`;
    }
    return `${passN} of ${totalStudents} students passed. No students on the at-risk list.`;
  }
  if (atRiskCount > 0) {
    return `${atRiskCount} ${atRiskCount === 1 ? "student is" : "students are"} on the at-risk list — review details below.`;
  }
  return null;
}

function insightStrongestWeakestSubjects(
  teacherPerf: AcademicPerformanceReportData["teacher_performance"]
): {
  strongest: { subject: string; pct: number } | null;
  weakest: { subject: string; pct: number } | null;
} {
  const scored = teacherPerf.filter(
    (r): r is (typeof teacherPerf)[number] & { class_average_pct: number } =>
      r.class_average_pct != null && Number.isFinite(r.class_average_pct)
  );
  if (scored.length === 0) return { strongest: null, weakest: null };
  let max = scored[0]!;
  let min = scored[0]!;
  for (const r of scored) {
    if (r.class_average_pct > max.class_average_pct) max = r;
    if (r.class_average_pct < min.class_average_pct) min = r;
  }
  return {
    strongest: { subject: max.subject, pct: max.class_average_pct },
    weakest: { subject: min.subject, pct: min.class_average_pct },
  };
}

function statusBadgeClasses(status: ClassHealthStatus): string {
  switch (status) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "at_risk":
      return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100";
    default:
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100";
  }
}

function statusLabel(status: ClassHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy class";
    case "at_risk":
      return "At risk";
    default:
      return "Needs attention";
  }
}

function ClassHealthSummary({
  status,
  passPct,
  failPct,
  atRiskCount,
  strongest,
  weakest,
}: {
  status: ClassHealthStatus;
  passPct: number | null;
  failPct: number | null;
  atRiskCount: number;
  strongest: { subject: string; pct: number } | null;
  weakest: { subject: string; pct: number } | null;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Class health
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            Insight summary
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
            Snapshot from this saved report — open sections below for full
            tables.
          </p>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-slate-50/90 px-4 py-3 dark:bg-zinc-800/60">
          <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Pass rate
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {pct(passPct)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50/90 px-4 py-3 dark:bg-zinc-800/60">
          <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Fail rate
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {pct(failPct)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50/90 px-4 py-3 dark:bg-zinc-800/60">
          <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            At-risk students
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {atRiskCount}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50/90 px-4 py-3 dark:bg-zinc-800/60">
          <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Strongest subject (avg)
          </dt>
          <dd className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
            {strongest ? (
              <>
                {strongest.subject}{" "}
                <span className="font-normal text-slate-500 dark:text-zinc-400">
                  ({strongest.pct}%)
                </span>
              </>
            ) : (
              <span className="text-slate-500 dark:text-zinc-500">—</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50/90 px-4 py-3 dark:bg-zinc-800/60">
          <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Weakest subject (avg)
          </dt>
          <dd className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
            {weakest ? (
              <>
                {weakest.subject}{" "}
                <span className="font-normal text-slate-500 dark:text-zinc-400">
                  ({weakest.pct}%)
                </span>
              </>
            ) : (
              <span className="text-slate-500 dark:text-zinc-500">—</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DashboardRecommendedActions({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-indigo-50/80 p-5 shadow-sm dark:border-sky-900/50 dark:from-sky-950/40 dark:to-indigo-950/30 md:p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Recommended actions
      </h2>
      <ul className="mt-3 space-y-2.5 text-sm text-slate-800 dark:text-zinc-200">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollapsibleReportSection({
  sectionId,
  title,
  subtitle,
  expanded,
  onToggle,
  children,
  contentId,
}: {
  sectionId: SectionId;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  contentId: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      data-section={sectionId}
    >
      <button
        type="button"
        id={`${contentId}-trigger`}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/80 sm:px-6 sm:py-4"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="flex min-w-0 flex-1 gap-3">
          <span
            className="mt-0.5 inline-flex w-5 shrink-0 justify-center font-mono text-sm text-slate-600 dark:text-zinc-400"
            aria-hidden
          >
            {expanded ? "▼" : "▶"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-zinc-400">
                {subtitle}
              </span>
            ) : null}
          </span>
        </span>
        <span className="hidden shrink-0 pt-0.5 text-xs text-slate-500 dark:text-zinc-500 sm:block">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={contentId}
            role="region"
            aria-labelledby={`${contentId}-trigger`}
            className="border-t border-slate-100 px-4 pb-5 pt-2 dark:border-zinc-800 sm:px-6 sm:pb-6 sm:pt-3"
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubjectCompareTable({
  rows,
  compareLabel,
  hasBaselineData,
  strongestSubject,
  weakestSubject,
}: {
  rows: ReturnType<typeof buildSubjectCompareRows>;
  compareLabel: string;
  /** False when no other `academic_reports` row exists for this class to compare against. */
  hasBaselineData: boolean;
  strongestSubject: string | null;
  weakestSubject: string | null;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Subject averages vs {compareLabel}
        </h3>
        {(strongestSubject || weakestSubject) && (
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            {strongestSubject ? (
              <span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Strongest
                </span>
                : {strongestSubject}
              </span>
            ) : null}
            {strongestSubject && weakestSubject ? (
              <span className="text-slate-400 dark:text-zinc-600"> · </span>
            ) : null}
            {weakestSubject ? (
              <span>
                <span className="font-medium text-amber-800 dark:text-amber-400/90">
                  Weakest
                </span>
                : {weakestSubject}
              </span>
            ) : null}
          </p>
        )}
      </div>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left dark:border-zinc-700">
            <th className="py-2 pr-3 font-semibold text-slate-700 dark:text-zinc-300">
              Subject
            </th>
            <th className="py-2 pr-3 font-semibold text-slate-700 dark:text-zinc-300">
              Current term avg
            </th>
            <th className="py-2 pr-3 font-semibold text-slate-700 dark:text-zinc-300">
              Previous term avg
            </th>
            <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-zinc-300">
              Trend
            </th>
            <th className="py-2 font-semibold text-slate-700 dark:text-zinc-300">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const arrow =
              r.arrow === "up" ? "↑" : r.arrow === "down" ? "↓" : "→";
            const diff =
              r.diffPct == null
                ? "—"
                : `${r.diffPct > 0 ? "+" : ""}${r.diffPct.toFixed(1)}%`;
            const color =
              r.arrow === "up"
                ? "text-green-600 dark:text-green-400"
                : r.arrow === "down"
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-500 dark:text-zinc-500";
            const isStrong =
              strongestSubject != null && r.subject === strongestSubject;
            const isWeak =
              weakestSubject != null &&
              r.subject === weakestSubject &&
              !(strongestSubject === weakestSubject);
            const rowBg = isStrong
              ? "bg-emerald-50/80 dark:bg-emerald-950/25"
              : isWeak
                ? "bg-amber-50/70 dark:bg-amber-950/20"
                : "";
            return (
              <tr
                key={r.subject}
                className={`border-b border-slate-100 dark:border-zinc-800 ${rowBg}`}
              >
                <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
                  <span className="inline-flex items-center gap-2">
                    {r.subject}
                    {isStrong ? (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        Top
                      </span>
                    ) : null}
                    {isWeak ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        Focus
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums text-slate-800 dark:text-zinc-200">
                  {r.current != null ? `${r.current}%` : "Not recorded"}
                </td>
                <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-zinc-400">
                  {r.previous != null ? `${r.previous}%` : "No previous report yet"}
                </td>
                <td className={`py-2 pr-2 tabular-nums text-base ${color}`} title="Trend">
                  {r.current != null && r.previous != null ? arrow : "—"}
                </td>
                <td className={`py-2 tabular-nums ${color}`}>{diff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
        {hasBaselineData
          ? "Previous-term averages come from saved academic reports for this class. Use “Compare with” to change the baseline term."
          : "There is no other saved academic report for this class yet — previous-term cells show “No previous report yet.”"}
      </p>
    </div>
  );
}

function AtRiskAlert({ atRiskStudents }: { atRiskStudents: AcademicReportLiveSupplement["atRiskStudents"] }) {
  const rows = atRiskStudents;

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
        <p className="font-medium">No at-risk students flagged for this class.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-200/90 bg-rose-50/60 p-5 dark:border-rose-900/40 dark:bg-rose-950/20 md:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Students to follow up
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
          Based on this term&apos;s report cards and attendance signals — not a
          final NECTA outcome.
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.studentId}
            className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                {r.studentName}
              </p>
              <p className="mt-1 text-sm font-medium text-rose-700 dark:text-rose-300">
                {r.reason}
              </p>
            </div>
            <Link
              href={`/dashboard/students/${r.studentId}/profile`}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              View details
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AcademicReportPageClient({
  reportId,
  data,
  displaySchoolLevel,
  schoolName,
  classTitle,
  generatedAtLabel,
  teacherName,
  liveSupplement,
  children,
}: {
  reportId: string;
  data: AcademicPerformanceReportData;
  displaySchoolLevel: SchoolLevel;
  schoolName: string;
  classTitle: string;
  generatedAtLabel: string;
  teacherName: string;
  liveSupplement: AcademicReportLiveSupplement;
  children: React.ReactNode;
}) {
  const compareOptions = liveSupplement.compareTermOptions;
  const comparisonByTermId = liveSupplement.comparisonByTermId;
  const [compareTermId, setCompareTermId] = useState(
    () => liveSupplement.defaultCompareTermId
  );

  useEffect(() => {
    if (compareOptions.length && !compareOptions.some((o) => o.id === compareTermId)) {
      setCompareTermId(compareOptions[0].id);
    }
  }, [compareOptions, compareTermId]);

  const compareTermLabel =
    compareOptions.find((o) => o.id === compareTermId)?.label ??
    compareOptions[0]?.label ??
    "Previous term";

  const subjectCompareRows = useMemo(
    () => buildSubjectCompareRows(data, compareTermId, comparisonByTermId),
    [data, compareTermId, comparisonByTermId]
  );

  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>(
    defaultExpanded
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + reportId);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const partial = mergeStored(parsed);
        if (partial) {
          setExpanded((prev) => ({ ...prev, ...partial }));
        }
      }
    } catch {
      // ignore
    }
  }, [reportId]);

  const distributionRubricSecondary = displaySchoolLevel === "secondary";
  const distributionTableRows = useMemo(
    () => resolveAcademicReportDistributionRows(data, displaySchoolLevel),
    [data, displaySchoolLevel]
  );
  const distributionHasData = hasDistributionTableData(distributionTableRows);
  const op = data.overall_performance;

  const toggle = useCallback(
    (id: SectionId) => {
      setExpanded((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        try {
          localStorage.setItem(
            STORAGE_KEY_PREFIX + reportId,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [reportId]
  );

  const previousTermMetricsBySubject =
    compareTermId && comparisonByTermId[compareTermId]
      ? comparisonByTermId[compareTermId]
      : null;

  const topRecommendedLines = useMemo(
    () =>
      mergeTopRecommendedActionLines({
        data,
        distributionRubricSecondary,
        compareTermId,
        previousTermMetricsBySubject,
        atRiskCount: liveSupplement.atRiskStudents.length,
      }),
    [
      data,
      distributionRubricSecondary,
      compareTermId,
      previousTermMetricsBySubject,
      liveSupplement.atRiskStudents.length,
    ]
  );

  const compareStrongestWeakest = useMemo(
    () => strongestWeakestFromCompareRows(subjectCompareRows),
    [subjectCompareRows]
  );

  const subjectAvgStrongestWeakest = useMemo(
    () => insightStrongestWeakestSubjects(data.teacher_performance),
    [data.teacher_performance]
  );

  const passCountEstimate = estimateCountFromPct(
    op.overall_pass_rate_pct,
    op.total_students
  );
  const atRiskCount = liveSupplement.atRiskStudents.length;
  const healthStatus = classHealthStatus({
    passPct: op.overall_pass_rate_pct,
    atRiskCount,
    totalStudents: op.total_students,
  });
  const interpretation = buildOverallInterpretation({
    passN: passCountEstimate,
    totalStudents: op.total_students,
    atRiskCount,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">{children}</div>
        <AcademicReportToolbar
          reportId={reportId}
          data={data}
          schoolName={schoolName}
          classTitle={classTitle}
          generatedAtLabel={generatedAtLabel}
          teacherName={teacherName}
          displaySchoolLevel={displaySchoolLevel}
          compareOptions={compareOptions}
          compareTermId={compareTermId}
          onCompareTermIdChange={setCompareTermId}
          compareTermLabel={compareTermLabel}
          atRiskStudents={liveSupplement.atRiskStudents}
          subjectCompareRows={subjectCompareRows}
          previousTermMetricsBySubject={previousTermMetricsBySubject}
        />
      </div>

      <ClassHealthSummary
        status={healthStatus}
        passPct={op.overall_pass_rate_pct}
        failPct={op.overall_fail_rate_pct}
        atRiskCount={atRiskCount}
        strongest={subjectAvgStrongestWeakest.strongest}
        weakest={subjectAvgStrongestWeakest.weakest}
      />

      <DashboardRecommendedActions lines={topRecommendedLines} />

      <AtRiskAlert atRiskStudents={liveSupplement.atRiskStudents} />

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          Detailed analysis
        </p>
        <div className="space-y-4 sm:space-y-6">
        <CollapsibleReportSection
          sectionId="overall"
          title="Overall performance"
          subtitle="Pass/fail rates, gender split, and subject averages vs comparison term"
          expanded={expanded.overall}
          onToggle={() => toggle("overall")}
          contentId="academic-report-section-overall"
        >
          {interpretation ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
              {interpretation}
            </p>
          ) : passCountEstimate != null ? (
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-zinc-200">
              {passCountEstimate} of {op.total_students} students passed (by this
              report&apos;s rules).
            </p>
          ) : null}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Total students
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {op.total_students}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Overall pass rate
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {pct(op.overall_pass_rate_pct)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Overall fail rate
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {pct(op.overall_fail_rate_pct)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Boys pass rate
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {pct(op.boys_pass_rate_pct)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Girls pass rate
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {pct(op.girls_pass_rate_pct)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                Boys / girls fail rate
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {pct(op.boys_fail_rate_pct)} / {pct(op.girls_fail_rate_pct)}
              </dd>
            </div>
          </dl>
          {data.division_mode === "primary_grades" ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
              Pass: average grade A–C on fixed primary subjects. Fail: D, E, or
              insufficient data (X).
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
              Pass: Divisions I–IV. Fail: 0, incomplete (INC), or absent (ABS),
              per NECTA-style rules on the class result sheet.
            </p>
          )}
          <SubjectCompareTable
            rows={subjectCompareRows}
            compareLabel={compareTermLabel}
            hasBaselineData={compareOptions.length > 0}
            strongestSubject={compareStrongestWeakest.strongest?.subject ?? null}
            weakestSubject={compareStrongestWeakest.weakest?.subject ?? null}
          />
        </CollapsibleReportSection>

        <CollapsibleReportSection
          sectionId="distribution"
          title={
            distributionRubricSecondary
              ? "Division distribution (NECTA)"
              : "Grade distribution (Primary)"
          }
          subtitle={
            distributionRubricSecondary
              ? "See how students are distributed across divisions"
              : "See how students are distributed across primary grade levels"
          }
          expanded={expanded.distribution}
          onToggle={() => toggle("distribution")}
          contentId="academic-report-section-distribution"
        >
          {!distributionHasData ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              {distributionSectionEmptyMessage(
                displaySchoolLevel,
                data.division_mode
              )}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-zinc-700">
                    <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                      {distributionRubricSecondary ? "Division" : "Grade"}
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                      Boys
                    </th>
                    <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                      Girls
                    </th>
                    <th className="py-2 font-semibold text-slate-700 dark:text-zinc-300">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {distributionTableRows.map((row) => (
                    <tr
                      key={row.division}
                      className="border-b border-slate-100 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">
                        {row.division}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700 dark:text-zinc-300">
                        {row.boys}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700 dark:text-zinc-300">
                        {row.girls}
                      </td>
                      <td className="py-2 tabular-nums text-slate-700 dark:text-zinc-300">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleReportSection>

        <CollapsibleReportSection
          sectionId="subject_ranking"
          title="Subject ranking"
          subtitle="Identify strongest and weakest subjects by pass rate and top grade"
          expanded={expanded.subject_ranking}
          onToggle={() => toggle("subject_ranking")}
          contentId="academic-report-section-subjects"
        >
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-zinc-700">
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Rank
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Subject
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Pass rate
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Fail rate
                  </th>
                  <th className="py-2 font-semibold text-slate-700 dark:text-zinc-300">
                    Top grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.subject_ranking.map((row) => (
                  <tr
                    key={row.subject}
                    className="border-b border-slate-100 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-4 tabular-nums text-slate-700 dark:text-zinc-300">
                      {row.rank}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">
                      {row.subject}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {pct(row.pass_rate_pct)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {pct(row.fail_rate_pct)}
                    </td>
                    <td className="py-2 tabular-nums text-slate-700 dark:text-zinc-300">
                      {row.top_grade ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
            Subject pass/fail uses letter grades: secondary counts F as fail;
            primary counts E as fail. Ungraded subjects are excluded from that
            subject’s rates.
          </p>
        </CollapsibleReportSection>

        <CollapsibleReportSection
          sectionId="teacher_performance"
          title="Teacher performance"
          subtitle="Compare subject performance by assigned teacher"
          expanded={expanded.teacher_performance}
          onToggle={() => toggle("teacher_performance")}
          contentId="academic-report-section-teachers"
        >
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-zinc-700">
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Rank
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Subject
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Teacher
                  </th>
                  <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                    Pass rate
                  </th>
                  <th className="py-2 font-semibold text-slate-700 dark:text-zinc-300">
                    Class average %
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.teacher_performance.map((row) => (
                  <tr
                    key={`${row.subject}-${row.teacher}`}
                    className="border-b border-slate-100 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-4 tabular-nums text-slate-700 dark:text-zinc-300">
                      {row.rank}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">
                      {row.subject}
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-zinc-300">
                      {row.teacher}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {pct(row.pass_rate_pct)}
                    </td>
                    <td className="py-2 tabular-nums text-slate-700 dark:text-zinc-300">
                      {row.class_average_pct != null
                        ? `${row.class_average_pct}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
            Teachers come from class subject assignments for this academic year.
            If no assignment exists, the table shows an em dash.
          </p>
        </CollapsibleReportSection>
        </div>
      </div>
    </div>
  );
}
