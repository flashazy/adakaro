"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AcademicStatCard } from "@/components/academic/academic-stat-card";
import {
  academicCardBaseClass,
  academicSectionHeadingClass,
} from "@/components/academic/academic-ui-styles";
import { CurriculumCoverageDetailDrawer } from "@/components/curriculum-coverage/curriculum-coverage-detail-drawer";
import {
  CoverageDistributionChart,
  CurriculumEmptyState,
  CurriculumCoverageWithTrend,
  CurriculumExecutiveSummary,
  CurriculumExpectedActualInline,
  CurriculumHealthCard,
  CurriculumOverviewActionsMenu,
  CurriculumActivityStatusChip,
  CurriculumOverviewMobileList,
  CurriculumPaginationBar,
  CurriculumStaleBadge,
  CurriculumStatusBadge,
  CurriculumStatusSummaryBar,
  CurriculumClassesMobileList,
  CurriculumTeachersMobileList,
  CurriculumTrendIndicator,
  formatCurriculumActivityByTeacher,
  MostActiveTeachersCard,
  SubjectsRequiringAttentionCard,
} from "@/components/curriculum-coverage/curriculum-coverage-ui";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { SyllabusProgressBar } from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { coverageTextClass } from "@/lib/syllabus-coverage/coverage-stats";
import {
  formatCurriculumLastUpdate,
  formatCurriculumLastUpdateTable,
  formatCurriculumRefreshTime,
} from "@/lib/curriculum-coverage/insights";
import {
  buildCurriculumCoverageCsv,
  buildCurriculumCoverageExcel,
  downloadTextFile,
} from "@/lib/curriculum-coverage/export";
import { buildCurriculumCoveragePdf } from "@/lib/curriculum-coverage/export-pdf";
import {
  formatActivityDate,
  formatActivityTime,
} from "@/lib/syllabus-coverage/syllabus-activity";
import type {
  CurriculumAttentionSubject,
  CurriculumCoveragePageResult,
  CurriculumCoverageRow,
  CurriculumCoverageStatusFilter,
} from "@/lib/curriculum-coverage/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { cn } from "@/lib/utils";
import {
  exportCurriculumCoverageAction,
  loadCurriculumCoverageAction,
} from "./actions";

type ViewTab = "overview" | "teachers" | "classes";
type ExportFormat = "csv" | "excel" | "pdf";
type KpiFilter =
  | "on_track"
  | "needs_attention"
  | "completed"
  | "behind_teachers"
  | null;

const PAGE_SIZE = 10;

const CURRICULUM_KPI_CARD_MOBILE =
  "max-md:min-h-[72px] max-md:p-3 max-md:[&>div:last-child]:mt-1.5 max-md:[&>div:last-child>p:first-child]:text-2xl";

export function CurriculumCoverageClient() {
  const [data, setData] = useState<CurriculumCoveragePageResult | null>(null);
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear()));
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CurriculumCoverageStatusFilter>("all");
  const [viewTab, setViewTab] = useState<ViewTab>("overview");
  const [overviewPage, setOverviewPage] = useState(0);
  const [teacherPage, setTeacherPage] = useState(0);
  const [classPage, setClassPage] = useState(0);
  const [teacherSort, setTeacherSort] = useState<
    "coverage" | "teacher" | "activity"
  >("teacher");
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [behindScheduleOnly, setBehindScheduleOnly] = useState(false);
  const [activeKpiFilter, setActiveKpiFilter] = useState<KpiFilter>(null);
  const [drawerRow, setDrawerRow] = useState<CurriculumCoverageRow | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadCurriculumCoverageAction({
      academicYear,
      search,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      statusFilter,
      overviewPage,
      overviewPageSize: PAGE_SIZE,
      teacherPage,
      teacherPageSize: PAGE_SIZE,
      classPage,
      classPageSize: PAGE_SIZE,
      teacherSort,
      teacherSortDir: teacherSort === "teacher" ? "asc" : "desc",
      behindScheduleOnly,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      setData(null);
      return;
    }
    setData(res);
  }, [
    academicYear,
    search,
    classId,
    subjectId,
    teacherId,
    statusFilter,
    overviewPage,
    teacherPage,
    classPage,
    teacherSort,
    behindScheduleOnly,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOverviewPage(0);
    setTeacherPage(0);
    setClassPage(0);
  }, [search, classId, subjectId, teacherId, statusFilter, academicYear]);

  function applyKpiFilter(filter: KpiFilter) {
    const next = activeKpiFilter === filter ? null : filter;
    setActiveKpiFilter(next);
    setOverviewPage(0);
    setTeacherPage(0);
    if (next === "behind_teachers") {
      setBehindScheduleOnly(true);
      setStatusFilter("all");
      setViewTab("teachers");
      return;
    }
    setBehindScheduleOnly(false);
    if (next) {
      setStatusFilter(next);
      setViewTab("overview");
    } else {
      setStatusFilter("all");
    }
  }

  function openTeacherFilter(id: string) {
    setTeacherId(id);
    setViewTab("teachers");
    setTeacherPage(0);
  }

  function openClassFilter(id: string) {
    setClassId(id);
    setViewTab("classes");
    setClassPage(0);
  }

  function openSubjectFilter(row: CurriculumCoverageRow | CurriculumAttentionSubject) {
    setSubjectId(row.subjectId ?? row.subjectName);
    setClassId(row.classId);
    setViewTab("overview");
    setOverviewPage(0);
  }

  async function handleExport(format: ExportFormat) {
    setExportOpen(false);
    setExporting(format);
    const res = await exportCurriculumCoverageAction({
      academicYear,
      search,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      statusFilter,
    });
    setExporting(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `curriculum-coverage-${res.academicYear}-${stamp}`;
    if (format === "csv") {
      downloadTextFile(
        buildCurriculumCoverageCsv(res.rows),
        `${base}.csv`,
        "text/csv;charset=utf-8"
      );
    } else if (format === "excel") {
      downloadTextFile(
        buildCurriculumCoverageExcel(res.rows),
        `${base}.csv`,
        "text/csv;charset=utf-8"
      );
    } else {
      const doc = buildCurriculumCoveragePdf({
        rows: res.rows,
        academicYear: res.academicYear,
      });
      doc.save(`${base}.pdf`);
    }
    const formatLabel =
      format === "pdf" ? "PDF" : format === "excel" ? "Excel" : "CSV";
    toast.success(
      `Exported ${res.rows.length} record${res.rows.length === 1 ? "" : "s"} as ${formatLabel}.`
    );
  }

  const hasNoData = data?.kpis.totalSubjects === 0;

  function scopedFilterActive() {
    return Boolean(classId || subjectId || teacherId);
  }

  function overviewEmptyCopy() {
    if (scopedFilterActive()) {
      return {
        title: "No syllabus coverage updates submitted yet.",
        hint: "This class, subject, or teacher is in the school but has no recorded curriculum progress for the selected year.",
      };
    }
    return {
      title: "No curriculum records match your filters.",
      hint: "Try adjusting filters or search terms.",
    };
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden max-md:space-y-3 max-md:pb-28">
      <header className="flex flex-col gap-2 max-md:gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold leading-tight text-slate-900 dark:text-white sm:text-lg">
            Curriculum Coverage
          </h2>
          <p className="text-xs leading-snug text-slate-600 dark:text-zinc-400 sm:text-sm">
            School-wide syllabus progress monitoring. Read-only — teachers update
            coverage from their dashboard.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 max-[300px]:flex-col max-[300px]:items-stretch sm:w-auto sm:justify-start sm:gap-2">
          {data?.refreshedAt ? (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Last updated:{" "}
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                {formatCurriculumRefreshTime(data.refreshedAt)}
              </span>
            </p>
          ) : null}
          <div className="relative shrink-0">
            <button
              type="button"
              disabled={!!exporting || !data}
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? "Exporting…" : "Export"}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
            </button>
            {exportOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {(["pdf", "excel", "csv"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void handleExport(format)}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {format === "pdf" ? "PDF" : format === "excel" ? "Excel" : "CSV"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading curriculum coverage…
        </div>
      ) : null}

      {data ? (
        <>
          {!hasNoData && data.executiveSummary.length > 0 ? (
            <CurriculumExecutiveSummary summaries={data.executiveSummary} />
          ) : null}

          {hasNoData ? (
            <CurriculumEmptyState />
          ) : (
            <>
          <div className="grid grid-cols-2 gap-2 max-md:auto-rows-fr sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <CurriculumHealthCard health={data.health} />
            <div
              className={cn(
                "flex min-h-[88px] flex-col justify-between p-4 max-md:min-h-[72px] max-md:p-3 lg:col-span-1",
                academicCardBaseClass,
                "border-l-[3px] border-l-violet-400/60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">
                  Overall school coverage
                </p>
                <TrendingUp className="h-4 w-4 text-violet-600" aria-hidden />
              </div>
              <p
                className={`mt-1.5 text-2xl font-bold tabular-nums max-md:mt-1 sm:mt-2 sm:text-3xl ${coverageTextClass(data.kpis.overallCoveragePercent)}`}
              >
                {data.kpis.overallCoveragePercent}%
              </p>
              <SyllabusProgressBar
                percent={data.kpis.overallCoveragePercent}
                className="mt-2 max-md:mt-1.5 sm:mt-3"
              />
              <p className="mt-1 text-[10px] text-slate-500 max-md:leading-snug sm:text-[11px]">
                Average across active subjects
              </p>
            </div>
            <AcademicStatCard
              label="Subjects on track"
              value={data.kpis.subjectsOnTrack}
              icon={CheckCircle2}
              accent="green"
              onClick={() => applyKpiFilter("on_track")}
              isActive={activeKpiFilter === "on_track"}
              className={CURRICULUM_KPI_CARD_MOBILE}
            />
            <AcademicStatCard
              label="Needing attention"
              value={data.kpis.subjectsNeedingAttention}
              icon={AlertTriangle}
              accent="amber"
              onClick={() => applyKpiFilter("needs_attention")}
              isActive={activeKpiFilter === "needs_attention"}
              className={CURRICULUM_KPI_CARD_MOBILE}
            />
            <AcademicStatCard
              label="Completed subjects"
              value={data.kpis.completedSubjects}
              icon={BookOpenCheck}
              accent="green"
              onClick={() => applyKpiFilter("completed")}
              isActive={activeKpiFilter === "completed"}
              className={CURRICULUM_KPI_CARD_MOBILE}
            />
            <AcademicStatCard
              label="Teachers behind schedule"
              value={data.kpis.teachersBehindSchedule}
              icon={Users}
              accent="amber"
              onClick={() => applyKpiFilter("behind_teachers")}
              isActive={activeKpiFilter === "behind_teachers"}
              className={CURRICULUM_KPI_CARD_MOBILE}
            />
          </div>

          <CurriculumStatusSummaryBar summary={data.statusSummary} />

          <div className="grid gap-2 max-md:gap-2 lg:grid-cols-3 lg:gap-3">
            <SubjectsRequiringAttentionCard
              subjects={data.subjectsRequiringAttention}
              onSelect={openSubjectFilter}
            />
            <MostActiveTeachersCard teachers={data.mostActiveTeachers} />
            <CoverageDistributionChart distribution={data.coverageDistribution} />
          </div>
            </>
          )}

          <div
            className={cn(
              "space-y-2 p-3 max-md:overflow-x-hidden sm:space-y-3 sm:p-4",
              academicCardBaseClass
            )}
          >
            <p className={academicSectionHeadingClass}>Filters</p>
            <div className="grid min-w-0 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="flex min-w-0 flex-col gap-0.5 text-[11px] sm:gap-1 sm:text-xs xl:col-span-2">
                <span className="font-medium text-slate-600 dark:text-zinc-400">
                  Search
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search teacher, class, or subject…"
                    className="w-full min-w-0 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm max-md:py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>
              </label>
              <FilterSelect
                label="Academic year"
                value={academicYear}
                onChange={setAcademicYear}
                options={data.filterOptions.academicYears.map((y) => ({
                  value: y,
                  label: y,
                }))}
              />
              <FilterSelect
                label="Class"
                value={classId}
                onChange={setClassId}
                options={[
                  { value: "", label: "All classes" },
                  ...data.filterOptions.classes.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
              />
              <FilterSelect
                label="Subject"
                value={subjectId}
                onChange={setSubjectId}
                options={[
                  { value: "", label: "All subjects" },
                  ...data.filterOptions.subjects.map((s) => ({
                    value: s.id ?? s.name,
                    label: s.name,
                  })),
                ]}
              />
              <FilterSelect
                label="Teacher"
                value={teacherId}
                onChange={setTeacherId}
                options={[
                  { value: "", label: "All teachers" },
                  ...data.filterOptions.teachers.map((t) => ({
                    value: t.id,
                    label: t.name,
                  })),
                ]}
              />
              <FilterSelect
                label="Coverage status"
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v as CurriculumCoverageStatusFilter);
                  setActiveKpiFilter(null);
                  setBehindScheduleOnly(false);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "completed", label: "Completed" },
                  { value: "on_track", label: "On Track" },
                  { value: "needs_attention", label: "Needs Attention" },
                  { value: "at_risk", label: "At Risk" },
                  { value: "not_started", label: "Not Started" },
                ]}
              />
            </div>
          </div>

          {data.insights.length > 0 ? (
            <div className={cn("space-y-2 p-4", academicCardBaseClass)}>
              <p className={academicSectionHeadingClass}>
                Subject performance insights
              </p>
              <ul className="space-y-2">
                {data.insights.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasNoData ? (
          <>
          <div className="-mx-4 flex min-w-0 gap-1 overflow-x-auto scroll-smooth px-4 pb-1 max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
            {(
              [
                ["overview", "Overview"],
                ["teachers", "Teachers"],
                ["classes", "Classes"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewTab(key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-200 max-md:min-h-[40px] sm:px-4",
                  viewTab === key
                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-950/40 dark:text-violet-300"
                    : "border-transparent text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {viewTab === "overview" ? (
            <div className={cn(academicCardBaseClass)}>
              <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Curriculum Coverage Overview
                </h3>
              </div>
              {data.overviewRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center max-md:py-10 sm:p-6">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {overviewEmptyCopy().title}
                  </p>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                    {overviewEmptyCopy().hint}
                  </p>
                </div>
              ) : (
                <>
                  <CurriculumOverviewMobileList
                    rows={data.overviewRows}
                    onView={setDrawerRow}
                    onOpenTeacher={openTeacherFilter}
                    onOpenClass={openClassFilter}
                    onOpenSubject={openSubjectFilter}
                  />
                  <table className="hidden w-full table-fixed text-left text-xs md:table">
                    <colgroup>
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                        <th className="px-2 py-2.5 font-semibold">Subject</th>
                        <th className="px-2 py-2.5 font-semibold">Class</th>
                        <th className="px-2 py-2.5 font-semibold">Teacher</th>
                        <th className="px-2 py-2.5 font-semibold">Coverage</th>
                        <th className="px-2 py-2.5 font-semibold">
                          Expected vs Actual
                        </th>
                        <th className="px-2 py-2.5 font-semibold">Topics</th>
                        <th className="px-2 py-2.5 font-semibold">Last Update</th>
                        <th className="px-2 py-2.5 font-semibold">Status</th>
                        <th className="px-2 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.overviewRows.map((row) => (
                        <tr
                          key={row.rowKey}
                          className="border-b border-slate-100 dark:border-zinc-800"
                        >
                          <td
                            className="truncate px-2 py-2.5 font-medium text-slate-800 dark:text-zinc-200"
                            title={row.subjectName}
                          >
                            {row.subjectName}
                          </td>
                          <td
                            className="truncate px-2 py-2.5 text-slate-600 dark:text-zinc-400"
                            title={row.className}
                          >
                            {row.className}
                          </td>
                          <td
                            className="truncate px-2 py-2.5 text-slate-600 dark:text-zinc-400"
                            title={row.teacherName}
                          >
                            {row.teacherName}
                          </td>
                          <td className="px-2 py-2.5">
                            <CurriculumCoverageWithTrend
                              coveragePercent={row.coveragePercent}
                              trendPercent={row.trendPercent}
                              trendDirection={row.trendDirection}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <CurriculumExpectedActualInline
                              actual={row.coveragePercent}
                              expected={row.expectedProgressPercent}
                              variance={row.progressVariance}
                            />
                          </td>
                          <td className="px-2 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">
                            {row.completedTopics}/{row.totalTopics}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1">
                              <span className="whitespace-nowrap text-slate-600 dark:text-zinc-400">
                                {formatCurriculumLastUpdateTable(row.lastUpdateAt)}
                              </span>
                              <CurriculumStaleBadge
                                staleDays={row.staleDays}
                                compact
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <CurriculumStatusBadge status={row.status} compact />
                          </td>
                          <td className="px-2 py-2.5">
                            <CurriculumOverviewActionsMenu
                              onView={() => setDrawerRow(row)}
                              onOpenTeacher={() => openTeacherFilter(row.teacherId)}
                              onOpenClass={() => openClassFilter(row.classId)}
                              onOpenSubject={() => openSubjectFilter(row)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
                    <CurriculumPaginationBar
                      total={data.totalOverview}
                      page={overviewPage}
                      pageSize={PAGE_SIZE}
                      onPageChange={setOverviewPage}
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}

          {viewTab === "teachers" ? (
            <div className={cn("max-md:overflow-x-hidden md:overflow-x-auto", academicCardBaseClass)}>
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <h3 className="text-sm font-semibold">Teachers</h3>
                <select
                  value={teacherSort}
                  onChange={(e) =>
                    setTeacherSort(
                      e.target.value as "coverage" | "teacher" | "activity"
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 md:w-auto md:py-1 md:text-xs"
                >
                  <option value="teacher">Sort: Teacher</option>
                  <option value="coverage">Sort: Coverage</option>
                  <option value="activity">Sort: Last Activity</option>
                </select>
              </div>
              {data.teacherRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center max-md:py-10 sm:p-6">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {overviewEmptyCopy().title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {overviewEmptyCopy().hint}
                  </p>
                </div>
              ) : (
              <>
              <CurriculumTeachersMobileList rows={data.teacherRows} />
              <table className="hidden min-w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3">Avg coverage</th>
                    <th className="px-4 py-3">Trend</th>
                    <th className="px-4 py-3">Last update</th>
                    <th className="px-4 py-3">Subjects at risk</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teacherRows.map((row) => (
                    <tr
                      key={row.teacherId}
                      className="border-b border-slate-100 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3">{row.teacherName}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.subjectsAssigned} subject
                        {row.subjectsAssigned === 1 ? "" : "s"}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold tabular-nums ${coverageTextClass(row.averageCoverage)}`}
                      >
                        {row.averageCoverage}%
                      </td>
                      <td className="px-4 py-3">
                        <CurriculumTrendIndicator
                          trendPercent={row.trendPercent}
                          trendDirection={row.trendDirection}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {formatCurriculumLastUpdate(row.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.subjectsAtRisk > 0 ? (
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {row.subjectsAtRisk}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CurriculumStatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
                <CurriculumPaginationBar
                  total={data.totalTeachers}
                  page={teacherPage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setTeacherPage}
                />
              </div>
              </>
              )}
            </div>
          ) : null}

          {viewTab === "classes" ? (
            <div className={cn("max-md:overflow-x-hidden md:overflow-x-auto", academicCardBaseClass)}>
              <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Classes</h3>
              </div>
              {data.classRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center max-md:py-10 sm:p-6">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {overviewEmptyCopy().title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {overviewEmptyCopy().hint}
                  </p>
                </div>
              ) : (
              <>
              <CurriculumClassesMobileList rows={data.classRows} />
              <table className="hidden min-w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3">Avg coverage</th>
                    <th className="px-4 py-3">Trend</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">At risk</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classRows.map((row) => (
                    <tr
                      key={row.classId}
                      className="border-b border-slate-100 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3">{row.className}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.subjectsCount} subject
                        {row.subjectsCount === 1 ? "" : "s"}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold tabular-nums ${coverageTextClass(row.averageCoverage)}`}
                      >
                        {row.averageCoverage}%
                      </td>
                      <td className="px-4 py-3">
                        <CurriculumTrendIndicator
                          trendPercent={row.trendPercent}
                          trendDirection={row.trendDirection}
                        />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.completedSubjects} completed
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.atRiskSubjects > 0 ? (
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {row.atRiskSubjects}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CurriculumStatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
                <CurriculumPaginationBar
                  total={data.totalClasses}
                  page={classPage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setClassPage}
                />
              </div>
              </>
              )}
            </div>
          ) : null}

          <div className={cn("space-y-2.5 p-3 max-md:overflow-x-hidden sm:space-y-3 sm:p-4", academicCardBaseClass)}>
            <p className={academicSectionHeadingClass}>
              Recent curriculum activity
            </p>
            {data.activity.length === 0 ? (
              <p className="text-center text-sm text-slate-500 max-md:py-2 sm:text-left">
                No recent syllabus updates recorded.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.activity.map((item) => {
                  const activity = formatCurriculumActivityByTeacher(
                    item.teacherName,
                    item.subtopicTitle,
                    item.status
                  );
                  return (
                    <li
                      key={item.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-zinc-700/60 dark:bg-zinc-800/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 break-words text-sm leading-snug text-slate-800 dark:text-zinc-200">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {activity.headline}
                          </span>{" "}
                          <span className="text-slate-600 dark:text-zinc-400">
                            {activity.detail}
                          </span>
                        </p>
                        <CurriculumActivityStatusChip status={item.status} />
                      </div>
                      <p className="mt-1 break-words text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
                        {item.subjectName} · {item.className} ·{" "}
                        {formatActivityDate(item.updatedAt)} ·{" "}
                        {formatActivityTime(item.updatedAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </>
          ) : null}
        </>
      ) : null}

      <CurriculumCoverageDetailDrawer
        row={drawerRow}
        academicYear={academicYear}
        onClose={() => setDrawerRow(null)}
      />

      <SmartFloatingScrollButton
        sectionIds={[]}
        hideWhileScrolling
        className="max-md:bottom-28 max-md:right-5 max-md:z-40 max-md:h-14 max-md:w-14 max-md:shadow-md max-md:shadow-slate-900/5 md:bottom-6 md:right-6"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[11px] sm:gap-1 sm:text-xs">
      <span className="font-medium text-slate-600 dark:text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm max-md:py-2 dark:border-zinc-600 dark:bg-zinc-950"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
