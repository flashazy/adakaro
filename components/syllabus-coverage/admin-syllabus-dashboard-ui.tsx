"use client";

import { BookOpen, ChevronRight, Loader2, Search } from "lucide-react";
import { academicCardBaseClass, academicSectionHeadingClass } from "@/components/academic/academic-ui-styles";
import {
  activityLevelTextClass,
  adminCoverageBarClass,
  adminCoveragePaceLabelClass,
  adminCoverageTextClass,
  adminHealthStatusLabel,
  adminKpiActiveTeachersHelper,
  adminKpiBehindScheduleHelper,
  adminKpiCompletedSubjectsHelper,
  adminKpiContextToneClass,
  adminKpiOnTrackSubjectsHelper,
  adminKpiOverallCoverageHelper,
  adminKpiSchoolHealthHelper,
  adminPaceStatusBadgeClass,
  adminPaceStatusLabel,
  formatAdminLastActivity,
  formatAdminCoveragePaceLabel,
  subjectFilterKey,
} from "@/lib/syllabus-coverage/admin-dashboard-utils";
import type {
  AdminClassHealthSummary,
  AdminSyllabusAttentionItem,
  AdminSyllabusCoverageDistribution,
  AdminSyllabusDashboardFilters,
  AdminSyllabusDashboardRow,
  AdminSyllabusFilterOptions,
  AdminSyllabusKpis,
  AdminSyllabusPaceChipFilter,
  AdminSyllabusPaceStatus,
  AdminSyllabusPerformanceRow,
  AdminSyllabusSchoolHealth,
  AdminSyllabusTeacherLeaderboardEntry,
  AdminSyllabusTablePageSize,
} from "@/lib/syllabus-coverage/admin-dashboard-types";
import { ADMIN_SYLLABUS_TABLE_PAGE_SIZES } from "@/lib/syllabus-coverage/admin-dashboard-types";
import { cn } from "@/lib/utils";

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";

export function AdminSyllabusFiltersBar({
  filterOptions,
  filters,
  onChange,
}: {
  filterOptions: AdminSyllabusFilterOptions;
  filters: AdminSyllabusDashboardFilters;
  onChange: (next: Partial<AdminSyllabusDashboardFilters>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">
          Academic year
        </span>
        <select
          value={filters.academicYear}
          onChange={(e) => onChange({ academicYear: e.target.value })}
          className={selectClass}
        >
          {filterOptions.academicYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">Term</span>
        <select
          value={filters.term}
          onChange={(e) => onChange({ term: e.target.value })}
          className={selectClass}
        >
          {filterOptions.terms.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">Class</span>
        <select
          value={filters.classId}
          onChange={(e) => onChange({ classId: e.target.value })}
          className={selectClass}
        >
          <option value="all">All classes</option>
          {filterOptions.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">Subject</span>
        <select
          value={filters.subjectKey}
          onChange={(e) => onChange({ subjectKey: e.target.value })}
          className={selectClass}
        >
          <option value="all">All subjects</option>
          {filterOptions.subjects.map((s) => {
            const key = subjectFilterKey(s.id, s.name);
            return (
              <option key={key} value={key}>
                {s.name}
              </option>
            );
          })}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">Teacher</span>
        <select
          value={filters.teacherId}
          onChange={(e) => onChange({ teacherId: e.target.value })}
          className={selectClass}
        >
          <option value="all">All teachers</option>
          {filterOptions.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function AdminSyllabusKpiCard({
  label,
  value,
  contextLabel,
  contextTone = "default",
  highlight = false,
  primary = false,
  highlightPercent,
}: {
  label: string;
  value: string;
  contextLabel?: string;
  contextTone?: "default" | "positive" | "warning" | "critical";
  highlight?: boolean;
  primary?: boolean;
  highlightPercent?: number;
}) {
  return (
    <div className={cn(academicCardBaseClass, "flex flex-col p-4")}>
      <p
        className={cn(
          "text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400",
          primary ? "font-semibold text-slate-600 dark:text-zinc-300" : "font-medium"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          primary ? "text-3xl" : "text-2xl",
          highlight && highlightPercent != null
            ? adminCoverageTextClass(highlightPercent)
            : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </p>
      {contextLabel ? (
        <p
          className={cn(
            "mt-1 text-[11px] font-medium leading-snug",
            adminKpiContextToneClass(contextTone)
          )}
        >
          {contextLabel}
        </p>
      ) : null}
    </div>
  );
}

export function AdminSyllabusKpiCards({
  kpis,
  className,
}: {
  kpis: AdminSyllabusKpis;
  className?: string;
}) {
  const cards = [
    { label: "Overall Coverage", value: `${kpis.overallCoverage}%`, highlight: true },
    { label: "On Track Subjects", value: String(kpis.onTrackSubjects) },
    { label: "Behind Schedule Subjects", value: String(kpis.behindScheduleSubjects) },
    { label: "Completed Subjects", value: String(kpis.completedSubjects) },
    { label: "Active Teachers", value: String(kpis.activeTeachers) },
  ];

  return (
    <div className={cn("grid gap-3", className)}>
      {cards.map((card) => (
        <AdminSyllabusKpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          highlight={card.highlight}
          highlightPercent={kpis.overallCoverage}
        />
      ))}
    </div>
  );
}

export function AdminSyllabusKpiSection({
  kpis,
  schoolHealth,
  expectedCoveragePercent,
}: {
  kpis: AdminSyllabusKpis;
  schoolHealth: AdminSyllabusSchoolHealth;
  expectedCoveragePercent: number;
}) {
  const overallContext = adminKpiOverallCoverageHelper(
    kpis.overallCoverage,
    expectedCoveragePercent
  );
  const onTrackContext = adminKpiOnTrackSubjectsHelper(kpis.onTrackSubjects);
  const behindContext = adminKpiBehindScheduleHelper(kpis.behindScheduleSubjects);
  const completedContext = adminKpiCompletedSubjectsHelper(kpis.completedSubjects);
  const teachersContext = adminKpiActiveTeachersHelper(kpis.activeTeachers);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <AdminSyllabusKpiCard
          label="Overall Coverage"
          value={`${kpis.overallCoverage}%`}
          contextLabel={overallContext.label}
          contextTone={overallContext.tone}
          highlight
          primary
          highlightPercent={kpis.overallCoverage}
        />
        <AdminSyllabusSchoolHealthCard schoolHealth={schoolHealth} compact />
        <AdminSyllabusKpiCard
          label="On Track Subjects"
          value={String(kpis.onTrackSubjects)}
          contextLabel={onTrackContext.label}
          contextTone={onTrackContext.tone}
        />
        <AdminSyllabusKpiCard
          label="Behind Schedule Subjects"
          value={String(kpis.behindScheduleSubjects)}
          contextLabel={behindContext.label}
          contextTone={behindContext.tone}
        />
        <AdminSyllabusKpiCard
          label="Completed Subjects"
          value={String(kpis.completedSubjects)}
          contextLabel={completedContext.label}
          contextTone={completedContext.tone}
        />
        <AdminSyllabusKpiCard
          label="Active Teachers"
          value={String(kpis.activeTeachers)}
          contextLabel={teachersContext.label}
          contextTone={teachersContext.tone}
        />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-stretch">
        <AdminSyllabusKpiCards kpis={kpis} className="grid-cols-5" />
        <AdminSyllabusSchoolHealthCard schoolHealth={schoolHealth} />
      </div>
    </>
  );
}

export function AdminSyllabusSchoolHealthCard({
  schoolHealth,
  compact = false,
}: {
  schoolHealth: AdminSyllabusSchoolHealth;
  compact?: boolean;
}) {
  if (compact) {
    const healthContext = adminKpiSchoolHealthHelper(schoolHealth.paceStatus);

    return (
      <div className={cn(academicCardBaseClass, "flex flex-col p-4")}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          School Coverage Health
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            adminCoverageTextClass(schoolHealth.score)
          )}
        >
          {schoolHealth.score}
          <span className="text-base font-medium text-slate-400 dark:text-zinc-500">
            {" "}
            / 100
          </span>
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-out",
              schoolHealth.score > 0
                ? adminCoverageBarClass(schoolHealth.score)
                : "bg-transparent"
            )}
            style={{
              width: `${Math.min(100, Math.max(0, schoolHealth.score))}%`,
            }}
          />
        </div>
        <p
          className={cn(
            "mt-1 text-[11px] font-medium leading-snug",
            adminKpiContextToneClass(healthContext.tone)
          )}
        >
          {healthContext.label}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(academicCardBaseClass, "flex flex-col justify-between p-4 sm:min-w-[12rem]")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        School Coverage Health
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <p
          className={cn(
            "text-3xl font-bold tabular-nums",
            adminCoverageTextClass(schoolHealth.score)
          )}
        >
          {schoolHealth.score}
          <span className="text-lg font-medium text-slate-400 dark:text-zinc-500">
            {" "}
            / 100
          </span>
        </p>
        <span
          className={cn(
            "mb-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
            adminPaceStatusBadgeClass(schoolHealth.paceStatus)
          )}
        >
          {adminHealthStatusLabel(schoolHealth.paceStatus)}
        </span>
      </div>
    </div>
  );
}

const DISTRIBUTION_SEGMENTS: {
  key: keyof AdminSyllabusCoverageDistribution;
  label: string;
  color: string;
}[] = [
  { key: "healthy", label: "Healthy", color: "bg-emerald-500" },
  { key: "onTrack", label: "On Track", color: "bg-blue-500" },
  { key: "behind", label: "Behind", color: "bg-amber-500" },
  { key: "critical", label: "Critical", color: "bg-red-500" },
];

export function AdminSyllabusDistributionChart({
  distribution,
}: {
  distribution: AdminSyllabusCoverageDistribution;
}) {
  const total =
    distribution.healthy +
    distribution.onTrack +
    distribution.behind +
    distribution.critical;

  return (
    <div className={cn(academicCardBaseClass, "p-4")}>
      <h2 className={academicSectionHeadingClass}>Coverage Distribution</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          No subject data for the selected filters.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            {total} {total === 1 ? "subject" : "subjects"} tracked
          </p>
          <div
            className="mt-3 flex h-5 w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80"
            role="img"
            aria-label="Coverage distribution by pace status"
          >
            {DISTRIBUTION_SEGMENTS.map((segment, index) => {
              const count = distribution[segment.key];
              if (count <= 0) return null;
              const percent = Math.round((count / total) * 100);
              const width = (count / total) * 100;

              return (
                <div
                  key={segment.key}
                  className={cn(
                    "relative flex h-full min-w-0 items-center justify-center",
                    segment.color,
                    index > 0 && "border-l border-white/30"
                  )}
                  style={{ width: `${width}%` }}
                  title={`${segment.label}: ${count} (${percent}%)`}
                >
                  {percent >= 14 ? (
                    <span className="truncate px-1 text-[10px] font-bold text-white drop-shadow-sm">
                      {segment.label} {percent}%
                    </span>
                  ) : percent >= 8 ? (
                    <span className="truncate px-0.5 text-[9px] font-bold text-white drop-shadow-sm">
                      {percent}%
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DISTRIBUTION_SEGMENTS.map((segment) => {
              const count = distribution[segment.key];
              const percent =
                total === 0 ? 0 : Math.round((count / total) * 100);

              return (
                <div key={segment.key} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full", segment.color)}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-slate-600 dark:text-zinc-400">
                    {segment.label}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums text-slate-900 dark:text-white">
                    {count} ({percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminSyllabusClassHealthSummary({
  classes,
}: {
  classes: AdminClassHealthSummary[];
}) {
  if (classes.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className={academicSectionHeadingClass}>Class Health Summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {classes.map((item) => (
          <div
            key={item.classId}
            className={cn(
              academicCardBaseClass,
              "border-l-4 p-4",
              item.paceStatus === "ahead" && "border-l-emerald-500",
              item.paceStatus === "on_track" && "border-l-blue-500",
              item.paceStatus === "slightly_behind" && "border-l-amber-500",
              item.paceStatus === "critical" && "border-l-red-500"
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              {item.className}
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold tabular-nums",
                adminCoverageTextClass(item.coveragePercent)
              )}
            >
              {item.coveragePercent}%
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
              Coverage
            </p>
            <div className="mt-2">
              <AdminSyllabusHealthPaceBadge status={item.paceStatus} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const PACE_CHIP_OPTIONS: { value: AdminSyllabusPaceChipFilter; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "behind", label: "Behind" },
    { value: "on_track", label: "On Track" },
    { value: "healthy", label: "Healthy" },
  ];

export function AdminSyllabusPaceFilterChips({
  value,
  onChange,
}: {
  value: AdminSyllabusPaceChipFilter;
  onChange: (chip: AdminSyllabusPaceChipFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PACE_CHIP_OPTIONS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => onChange(chip.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            value === chip.value
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function AdminSyllabusEmptyState() {
  return (
    <div className={cn(academicCardBaseClass, "flex flex-col items-center px-6 py-12 text-center")}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
        <BookOpen className="h-8 w-8 text-slate-400 dark:text-zinc-500" aria-hidden />
      </div>
      <p className="mt-4 max-w-md text-base font-medium text-slate-800 dark:text-zinc-200">
        No syllabus progress has been recorded yet.
      </p>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-zinc-400">
        Teachers will appear here once lesson plans are taught and marked as
        completed.
      </p>
    </div>
  );
}

export function AdminSyllabusPaceBadge({
  status,
}: {
  status: AdminSyllabusPaceStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        adminPaceStatusBadgeClass(status)
      )}
    >
      {adminPaceStatusLabel(status)}
    </span>
  );
}

export function AdminSyllabusHealthPaceBadge({
  status,
}: {
  status: AdminSyllabusPaceStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        adminPaceStatusBadgeClass(status)
      )}
    >
      {adminHealthStatusLabel(status)}
    </span>
  );
}

export function AdminSyllabusProgressBar({
  percent,
  className,
  showLabel = false,
  label = "Syllabus coverage",
}: {
  percent: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
}) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <div className={cn(showLabel && "space-y-1.5", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-500 dark:text-zinc-400">
            {label}
          </span>
          <span
            className={cn(
              "shrink-0 font-semibold tabular-nums",
              adminCoverageTextClass(percent)
            )}
          >
            {percent}%
          </span>
        </div>
      ) : null}
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80"
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}%`}
      >
        <div
          className={cn(
            "h-full min-w-0 rounded-full transition-[width] duration-200 ease-out",
            width > 0 ? adminCoverageBarClass(percent) : "bg-transparent"
          )}
          style={{ width: width > 0 ? `${width}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function AdminSyllabusSubjectProgressMetrics({
  coveragePercent,
  expectedCoveragePercent,
  paceStatus,
}: {
  coveragePercent: number;
  expectedCoveragePercent: number;
  paceStatus: AdminSyllabusPaceStatus;
}) {
  const paceLabel = formatAdminCoveragePaceLabel(
    coveragePercent,
    expectedCoveragePercent
  );

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Completed
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-semibold tabular-nums",
                adminCoverageTextClass(coveragePercent)
              )}
            >
              {coveragePercent}%
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Target
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
              {expectedCoveragePercent}%
            </p>
          </div>
        </div>
        <AdminSyllabusPaceBadge status={paceStatus} />
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          adminCoveragePaceLabelClass(paceLabel.tone)
        )}
      >
        {paceLabel.label}
      </p>
    </div>
  );
}

export function AdminSyllabusAttentionPanel({
  items,
}: {
  items: AdminSyllabusAttentionItem[];
}) {
  if (items.length === 0) {
    return (
      <div className={cn(academicCardBaseClass, "p-4")}>
        <h2 className={academicSectionHeadingClass}>Top Issues Requiring Attention</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          No subjects currently require attention for the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(academicCardBaseClass, "p-4")}>
      <h2 className={academicSectionHeadingClass}>Top Issues Requiring Attention</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.rowKey}
            className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
          >
            <span aria-hidden className="shrink-0 text-amber-600">
              ⚠
            </span>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-zinc-100">
                {item.label}
              </p>
              {item.reason ? (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
                  {item.reason}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminSyllabusTeacherLeaderboard({
  teachers,
}: {
  teachers: AdminSyllabusTeacherLeaderboardEntry[];
}) {
  return (
    <div className={cn(academicCardBaseClass, "p-4")}>
      <h2 className={academicSectionHeadingClass}>Teacher Performance Leaderboard</h2>
      {teachers.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          No syllabus coverage recorded.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {teachers.map((t, index) => (
            <li
              key={t.teacherId}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {index + 1}. {t.teacherName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    {t.subjectCount} {t.subjectCount === 1 ? "subject" : "subjects"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      adminCoverageTextClass(t.averageCoverage)
                    )}
                  >
                    {t.averageCoverage}%
                  </span>
                  <AdminSyllabusHealthPaceBadge status={t.paceStatus} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AdminSyllabusPerformanceCard({
  rows,
}: {
  rows: AdminSyllabusPerformanceRow[];
}) {
  return (
    <div className={cn(academicCardBaseClass, "p-4")}>
      <h2 className={academicSectionHeadingClass}>Coverage vs Performance</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          No syllabus coverage recorded.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.rowKey}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
            >
              <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                {row.subjectLabel}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Coverage
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-semibold tabular-nums",
                      adminCoverageTextClass(row.coveragePercent)
                    )}
                  >
                    {row.coveragePercent}%
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-700">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        adminCoverageBarClass(row.coveragePercent)
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, row.coveragePercent))}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Performance
                  </p>
                  {row.averageExamScore != null ? (
                    <>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-400">
                        {row.averageExamScore}%
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.averageExamScore))}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs italic text-slate-400 dark:text-zinc-500">
                      No assessment data
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminSyllabusTableSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search class, subject, or teacher..."
        aria-label="Search class, subject, or teacher"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
      />
    </div>
  );
}

export function AdminSyllabusTablePagination({
  page,
  rowsPerPage,
  totalRecords,
  startRecord,
  endRecord,
  totalPages,
  onPageChange,
  onRowsPerPageChange,
}: {
  page: number;
  rowsPerPage: number;
  totalRecords: number;
  startRecord: number;
  endRecord: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: AdminSyllabusTablePageSize) => void;
}) {
  if (totalRecords <= 0) return null;

  const paginationButtonClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="border-t border-slate-200 px-3 py-2 dark:border-zinc-700 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
          Showing{" "}
          <span className="font-medium tabular-nums text-slate-900 dark:text-white">
            {startRecord}–{endRecord}
          </span>{" "}
          of{" "}
          <span className="font-medium tabular-nums text-slate-900 dark:text-white">
            {totalRecords}
          </span>{" "}
          records
        </p>
        <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className={paginationButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className={paginationButtonClass}
            >
              Next
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 sm:gap-2 sm:text-sm">
            <span className="shrink-0 sm:hidden">Rows</span>
            <span className="hidden shrink-0 sm:inline">Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) =>
                onRowsPerPageChange(Number(e.target.value) as AdminSyllabusTablePageSize)
              }
              aria-label="Rows per page"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              {ADMIN_SYLLABUS_TABLE_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

export function AdminSyllabusCoverageTable({
  rows,
  allRows,
  loading,
  pagination,
  onFocusSubject,
}: {
  rows: AdminSyllabusDashboardRow[];
  allRows?: AdminSyllabusDashboardRow[];
  loading?: boolean;
  pagination?: {
    page: number;
    rowsPerPage: number;
    totalRecords: number;
    startRecord: number;
    endRecord: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: AdminSyllabusTablePageSize) => void;
  };
  onFocusSubject?: (row: AdminSyllabusDashboardRow) => void;
}) {
  const sourceRows = allRows ?? rows;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading coverage…
      </div>
    );
  }

  const hasLessonPlans = sourceRows.some((r) => r.totalSubtopics > 0);
  if (!hasLessonPlans) {
    return <AdminSyllabusEmptyState />;
  }

  if (rows.length === 0) {
    return (
      <div className={cn(academicCardBaseClass, "p-8 text-center")}>
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
          No subjects match the selected pace filter.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Try another filter chip or broaden your search.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900">
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/95">
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3">Actual</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="min-w-[8rem] px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rowKey}
                className="border-b border-slate-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3">{row.className}</td>
                <td className="px-4 py-3">{row.subjectName}</td>
                <td className="px-4 py-3">{row.teacherName}</td>
                <td
                  className={cn(
                    "px-4 py-3 font-semibold tabular-nums",
                    adminCoverageTextClass(row.coveragePercent)
                  )}
                >
                  {row.coveragePercent}%
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-zinc-400">
                  {row.expectedCoveragePercent}%
                </td>
                <td className="px-4 py-3">
                  <AdminSyllabusPaceBadge status={row.paceStatus} />
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-xs",
                    activityLevelTextClass(row.activityLevel)
                  )}
                >
                  {formatAdminLastActivity(row.lastActivityDays)}
                </td>
                <td className="px-4 py-3">
                  <AdminSyllabusProgressBar
                    percent={row.coveragePercent}
                    showLabel
                    className="min-w-[7rem]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <article
            key={`${row.rowKey}-mobile`}
            className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/30"
          >
            <p className="font-semibold text-slate-900 dark:text-white">
              {row.subjectName} · {row.className}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {row.teacherName}
            </p>
            <AdminSyllabusSubjectProgressMetrics
              coveragePercent={row.coveragePercent}
              expectedCoveragePercent={row.expectedCoveragePercent}
              paceStatus={row.paceStatus}
            />
            <p
              className={cn(
                "mt-2 text-xs",
                activityLevelTextClass(row.activityLevel)
              )}
            >
              Last teaching activity: {formatAdminLastActivity(row.lastActivityDays)}
            </p>
            <AdminSyllabusProgressBar
              percent={row.coveragePercent}
              showLabel
              className="mt-3"
            />
            {onFocusSubject ? (
              <button
                type="button"
                onClick={() => onFocusSubject(row)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-school-primary transition-colors hover:text-school-primary/80 dark:text-school-primary"
              >
                Review Progress
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {pagination ? (
        <AdminSyllabusTablePagination
          page={pagination.page}
          rowsPerPage={pagination.rowsPerPage}
          totalRecords={pagination.totalRecords}
          startRecord={pagination.startRecord}
          endRecord={pagination.endRecord}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          onRowsPerPageChange={pagination.onRowsPerPageChange}
        />
      ) : null}
    </div>
  );
}
