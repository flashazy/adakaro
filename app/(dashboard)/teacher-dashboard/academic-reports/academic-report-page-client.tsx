"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { AcademicReportLiveSupplement } from "@/lib/academic-report-types";
import { buildSubjectCompareRows } from "@/lib/academic-report-comparison";
import { getRecommendedActionLines } from "@/lib/academic-report-recommendations";
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

function RecommendedActionsBox({ lines }: { lines: string[] }) {
  return (
    <div
      className="mt-4 border border-sky-200 text-sm leading-snug text-slate-800 dark:border-sky-800 dark:text-zinc-200"
      style={{ backgroundColor: "#e6f3ff", borderRadius: 8, padding: 12 }}
    >
      <p className="mb-2 font-medium text-slate-900 dark:text-white">
        💡 Recommended actions
      </p>
      <ul className="list-inside list-disc space-y-1.5 text-slate-800 dark:text-zinc-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function CollapsibleReportSection({
  sectionId,
  title,
  expanded,
  onToggle,
  children,
  contentId,
  recommendedLines,
}: {
  sectionId: SectionId;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  contentId: string;
  recommendedLines: string[];
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      data-section={sectionId}
    >
      <button
        type="button"
        id={`${contentId}-trigger`}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/80 sm:px-6 sm:py-3.5"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="inline-flex w-5 shrink-0 justify-center font-mono text-sm text-slate-600 dark:text-zinc-400"
            aria-hidden
          >
            {expanded ? "▼" : "▶"}
          </span>
          <span className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            {title}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-slate-500 dark:text-zinc-500 sm:block">
          {expanded ? "(click to collapse)" : "(click to expand)"}
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
            className="border-t border-slate-100 px-4 pb-4 pt-1 dark:border-zinc-800 sm:px-6 sm:pb-6 sm:pt-2"
          >
            {children}
            {expanded ? <RecommendedActionsBox lines={recommendedLines} /> : null}
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
}: {
  rows: ReturnType<typeof buildSubjectCompareRows>;
  compareLabel: string;
  /** False when no other `academic_reports` row exists for this class to compare against. */
  hasBaselineData: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">
        Subject averages vs {compareLabel}
      </h3>
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
              r.arrow === "up" ? "🔼" : r.arrow === "down" ? "🔽" : "➡️";
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
            return (
              <tr
                key={r.subject}
                className="border-b border-slate-100 dark:border-zinc-800"
              >
                <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
                  {r.subject}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {r.current != null ? `${r.current}%` : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {r.previous != null ? `${r.previous}%` : "No data available"}
                </td>
                <td className={`py-2 pr-2 text-lg ${color}`} title="Trend">
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
          : "There is no other saved academic report for this class yet, so no previous-term averages are available."}
      </p>
    </div>
  );
}

function AtRiskAlert({ atRiskStudents }: { atRiskStudents: AcademicReportLiveSupplement["atRiskStudents"] }) {
  const rows = atRiskStudents;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">No at-risk students – great job!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-900/60 dark:bg-red-950/30">
      <h2 className="text-base font-semibold text-red-900 dark:text-red-100">
        At-risk students alert
      </h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.studentId}
            className="flex flex-col gap-2 rounded-lg border border-red-100 bg-white/80 p-3 dark:border-red-900/40 dark:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {r.studentName}
              </p>
              <p className="text-sm text-red-800 dark:text-red-200/90">
                {r.reason}
              </p>
            </div>
            <Link
              href={`/dashboard/students/${r.studentId}/profile`}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-900 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-zinc-800 dark:text-red-100 dark:hover:bg-zinc-700"
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
  schoolName,
  classTitle,
  generatedAtLabel,
  teacherName,
  liveSupplement,
  children,
}: {
  reportId: string;
  data: AcademicPerformanceReportData;
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

  const showNectaDivision = data.school_level === "secondary";
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

  const rec = useCallback(
    (section: Parameters<typeof getRecommendedActionLines>[0]["section"]) =>
      getRecommendedActionLines({
        section,
        data,
        showNectaDivision,
        compareTermId,
        previousTermMetricsBySubject,
      }),
    [data, showNectaDivision, compareTermId, previousTermMetricsBySubject]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">{children}</div>
        <AcademicReportToolbar
          reportId={reportId}
          data={data}
          schoolName={schoolName}
          classTitle={classTitle}
          generatedAtLabel={generatedAtLabel}
          teacherName={teacherName}
          showNectaDivision={showNectaDivision}
          compareOptions={compareOptions}
          compareTermId={compareTermId}
          onCompareTermIdChange={setCompareTermId}
          compareTermLabel={compareTermLabel}
          atRiskStudents={liveSupplement.atRiskStudents}
          subjectCompareRows={subjectCompareRows}
          previousTermMetricsBySubject={previousTermMetricsBySubject}
        />
      </div>

      <AtRiskAlert atRiskStudents={liveSupplement.atRiskStudents} />

      <div className="space-y-4 sm:space-y-6">
        <CollapsibleReportSection
          sectionId="overall"
          title="Overall performance"
          expanded={expanded.overall}
          onToggle={() => toggle("overall")}
          contentId="academic-report-section-overall"
          recommendedLines={rec("overall")}
        >
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
              Pass: average grade A–C on fixed primary subjects. Fail: D, E, or
              insufficient data (X).
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
              Pass: Divisions I–III. Fail: IV, 0, incomplete (INC), or absent
              (ABS), per NECTA-style rules on the class result sheet.
            </p>
          )}
          <SubjectCompareTable
            rows={subjectCompareRows}
            compareLabel={compareTermLabel}
            hasBaselineData={compareOptions.length > 0}
          />
        </CollapsibleReportSection>

        {showNectaDivision ? (
          <CollapsibleReportSection
            sectionId="distribution"
            title="Division distribution (NECTA)"
            expanded={expanded.distribution}
            onToggle={() => toggle("distribution")}
            contentId="academic-report-section-distribution"
            recommendedLines={rec("distribution")}
          >
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-zinc-700">
                    <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-zinc-300">
                      Division
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
                  {data.division_distribution.map((row) => (
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
          </CollapsibleReportSection>
        ) : null}

        <CollapsibleReportSection
          sectionId="subject_ranking"
          title="Subject ranking"
          expanded={expanded.subject_ranking}
          onToggle={() => toggle("subject_ranking")}
          contentId="academic-report-section-subjects"
          recommendedLines={rec("subject_ranking")}
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
          expanded={expanded.teacher_performance}
          onToggle={() => toggle("teacher_performance")}
          contentId="academic-report-section-teachers"
          recommendedLines={rec("teacher_performance")}
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
  );
}
