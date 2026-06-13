import { computeAdminExpectedCoveragePercent } from "@/lib/syllabus-coverage/admin-expected-coverage";
import type {
  AdminClassHealthSummary,
  AdminSyllabusActivityLevel,
  AdminSyllabusAttentionItem,
  AdminSyllabusCoverageDistribution,
  AdminSyllabusDashboardFilters,
  AdminSyllabusDashboardPayload,
  AdminSyllabusDashboardRow,
  AdminSyllabusKpis,
  AdminSyllabusPaceChipFilter,
  AdminSyllabusPaceStatus,
  AdminSyllabusPerformanceRow,
  AdminSyllabusSchoolHealth,
  AdminSyllabusSchoolTermDates,
  AdminSyllabusTeacherLeaderboardEntry,
  AdminSyllabusTablePaginationMeta,
} from "@/lib/syllabus-coverage/admin-dashboard-types";

export function subjectFilterKey(subjectId: string | null, subjectName: string): string {
  return subjectId ?? `name:${subjectName.trim().toLowerCase()}`;
}

export function deriveAdminPaceStatus(
  actualPercent: number,
  expectedPercent: number
): AdminSyllabusPaceStatus {
  const variance = actualPercent - expectedPercent;
  if (variance >= 5) return "ahead";
  if (variance >= -5) return "on_track";
  if (variance >= -15) return "slightly_behind";
  return "critical";
}

export function adminHealthStatusLabel(status: AdminSyllabusPaceStatus): string {
  if (status === "ahead") return "Healthy";
  return adminPaceStatusLabel(status);
}

const PACE_STATUS_SEVERITY: Record<AdminSyllabusPaceStatus, number> = {
  critical: 4,
  slightly_behind: 3,
  on_track: 2,
  ahead: 1,
};

export function worstPaceStatus(
  statuses: AdminSyllabusPaceStatus[]
): AdminSyllabusPaceStatus {
  if (statuses.length === 0) return "critical";
  return statuses.reduce((worst, status) =>
    PACE_STATUS_SEVERITY[status] > PACE_STATUS_SEVERITY[worst] ? status : worst
  );
}

export function adminPaceStatusLabel(status: AdminSyllabusPaceStatus): string {
  switch (status) {
    case "ahead":
      return "Ahead";
    case "on_track":
      return "On Track";
    case "slightly_behind":
      return "Slightly Behind";
    case "critical":
      return "Critical";
  }
}

export function adminPaceStatusBadgeClass(status: AdminSyllabusPaceStatus): string {
  switch (status) {
    case "ahead":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50";
    case "on_track":
      return "bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/50";
    case "slightly_behind":
      return "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40";
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50";
  }
}

/** Admin dashboard progress bar fill (0–39 red, 40–69 orange, 70–89 blue, 90–100 green). */
export function adminCoverageBarClass(percent: number): string {
  if (percent >= 90) return "bg-emerald-500";
  if (percent >= 70) return "bg-blue-500";
  if (percent >= 40) return "bg-amber-500";
  if (percent > 0) return "bg-red-500";
  return "bg-slate-300 dark:bg-zinc-600";
}

export function adminCoverageTextClass(percent: number): string {
  if (percent >= 90) return "text-emerald-700 dark:text-emerald-400";
  if (percent >= 70) return "text-blue-700 dark:text-blue-400";
  if (percent >= 40) return "text-amber-700 dark:text-amber-400";
  if (percent > 0) return "text-red-700 dark:text-red-400";
  return "text-slate-500 dark:text-zinc-400";
}

export function daysSinceActivity(iso: string | null): number | null {
  if (!iso) return null;
  const updated = new Date(iso);
  if (Number.isNaN(updated.getTime())) return null;
  return Math.floor((Date.now() - updated.getTime()) / 86_400_000);
}

export function deriveActivityLevel(
  days: number | null
): AdminSyllabusActivityLevel {
  if (days === null) return "needs_attention";
  if (days <= 7) return "normal";
  if (days <= 14) return "warning";
  return "needs_attention";
}

export function formatAdminLastActivity(days: number | null): string {
  if (days === null) return "No activity recorded";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function activityLevelTextClass(level: AdminSyllabusActivityLevel): string {
  switch (level) {
    case "normal":
      return "text-slate-600 dark:text-zinc-400";
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "needs_attention":
      return "text-red-700 dark:text-red-400";
  }
}

export function enrichRowForTerm(
  row: AdminSyllabusDashboardRow,
  academicYear: string,
  term: string,
  termDates: AdminSyllabusSchoolTermDates
): AdminSyllabusDashboardRow {
  const expectedCoveragePercent = computeAdminExpectedCoveragePercent(
    academicYear,
    term,
    termDates
  );
  const paceStatus = deriveAdminPaceStatus(
    row.coveragePercent,
    expectedCoveragePercent
  );
  return { ...row, expectedCoveragePercent, paceStatus };
}

export function applyDashboardFilters(
  rows: AdminSyllabusDashboardRow[],
  filters: AdminSyllabusDashboardFilters
): AdminSyllabusDashboardRow[] {
  return rows.filter((row) => {
    if (filters.classId !== "all" && row.classId !== filters.classId) {
      return false;
    }
    if (
      filters.subjectKey !== "all" &&
      subjectFilterKey(row.subjectId, row.subjectName) !== filters.subjectKey
    ) {
      return false;
    }
    if (filters.teacherId !== "all" && row.teacherId !== filters.teacherId) {
      return false;
    }
    return true;
  });
}

export function buildAdminSyllabusKpis(rows: AdminSyllabusDashboardRow[]): AdminSyllabusKpis {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  const overallCoverage =
    active.length > 0
      ? Math.round(
          active.reduce((sum, r) => sum + r.coveragePercent, 0) / active.length
        )
      : 0;

  return {
    overallCoverage,
    onTrackSubjects: active.filter(
      (r) => r.paceStatus === "on_track" || r.paceStatus === "ahead"
    ).length,
    behindScheduleSubjects: active.filter(
      (r) =>
        r.paceStatus === "slightly_behind" || r.paceStatus === "critical"
    ).length,
    completedSubjects: active.filter((r) => r.coveragePercent >= 100).length,
    activeTeachers: new Set(active.map((r) => r.teacherId)).size,
  };
}

export function applyPaceChipFilter(
  rows: AdminSyllabusDashboardRow[],
  chip: AdminSyllabusPaceChipFilter
): AdminSyllabusDashboardRow[] {
  if (chip === "all") return rows;
  if (chip === "healthy") return rows.filter((r) => r.paceStatus === "ahead");
  if (chip === "on_track") {
    return rows.filter((r) => r.paceStatus === "on_track");
  }
  if (chip === "behind") {
    return rows.filter((r) => r.paceStatus === "slightly_behind");
  }
  return rows.filter((r) => r.paceStatus === "critical");
}

export function applyAdminSyllabusTableSearch(
  rows: AdminSyllabusDashboardRow[],
  query: string
): AdminSyllabusDashboardRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter(
    (row) =>
      row.className.toLowerCase().includes(normalized) ||
      row.subjectName.toLowerCase().includes(normalized) ||
      row.teacherName.toLowerCase().includes(normalized)
  );
}

export function buildClassHealthSummaries(
  rows: AdminSyllabusDashboardRow[]
): AdminClassHealthSummary[] {
  const byClass = new Map<
    string,
    { name: string; total: number; count: number; statuses: AdminSyllabusPaceStatus[] }
  >();

  for (const row of rows) {
    if (row.totalSubtopics <= 0) continue;
    const existing = byClass.get(row.classId) ?? {
      name: row.className,
      total: 0,
      count: 0,
      statuses: [],
    };
    existing.total += row.coveragePercent;
    existing.count += 1;
    existing.statuses.push(row.paceStatus);
    byClass.set(row.classId, existing);
  }

  return [...byClass.entries()]
    .map(([classId, data]) => ({
      classId,
      className: data.name,
      coveragePercent: Math.round(data.total / Math.max(data.count, 1)),
      paceStatus: worstPaceStatus(data.statuses),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

export function buildCoverageDistribution(
  rows: AdminSyllabusDashboardRow[]
): AdminSyllabusCoverageDistribution {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  return {
    healthy: active.filter((r) => r.paceStatus === "ahead").length,
    onTrack: active.filter((r) => r.paceStatus === "on_track").length,
    behind: active.filter((r) => r.paceStatus === "slightly_behind").length,
    critical: active.filter((r) => r.paceStatus === "critical").length,
  };
}

export function buildSchoolHealth(
  rows: AdminSyllabusDashboardRow[],
  expectedCoveragePercent: number
): AdminSyllabusSchoolHealth {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  if (active.length === 0) {
    return { score: 0, paceStatus: "critical" };
  }

  const coverageScore =
    active.reduce((sum, r) => sum + r.coveragePercent, 0) / active.length;

  const activityScore =
    (active.filter((r) => r.lastActivityDays !== null && r.lastActivityDays <= 7)
      .length /
      active.length) *
    100;

  const scheduleScore =
    (active.filter(
      (r) => r.paceStatus === "ahead" || r.paceStatus === "on_track"
    ).length /
      active.length) *
    100;

  const score = Math.round(
    coverageScore * 0.5 + activityScore * 0.25 + scheduleScore * 0.25
  );

  const paceStatus = deriveAdminPaceStatus(score, expectedCoveragePercent);
  return { score, paceStatus };
}

function computeAttentionSeverity(row: AdminSyllabusDashboardRow): number {
  let severity = 0;
  if (row.paceStatus === "critical") severity += 100;
  else if (row.paceStatus === "slightly_behind") severity += 70;
  else if (row.paceStatus === "on_track") severity += 30;
  else severity += 10;

  severity += Math.max(0, 100 - row.coveragePercent);
  if (row.lastActivityDays === null) severity += 25;
  else if (row.lastActivityDays >= 14) severity += 15;
  else if (row.lastActivityDays >= 7) severity += 5;

  return severity;
}

export function buildAttentionItems(
  rows: AdminSyllabusDashboardRow[]
): AdminSyllabusAttentionItem[] {
  const items: AdminSyllabusAttentionItem[] = [];

  for (const row of rows) {
    if (row.totalSubtopics <= 0) continue;

    const severity = computeAttentionSeverity(row);
    const reasonParts: string[] = [];
    if (
      row.paceStatus === "slightly_behind" ||
      row.paceStatus === "critical"
    ) {
      reasonParts.push(adminPaceStatusLabel(row.paceStatus));
    }
    if (row.lastActivityDays === null || row.lastActivityDays >= 14) {
      reasonParts.push(
        `Last activity ${formatAdminLastActivity(row.lastActivityDays)}`
      );
    }

    items.push({
      rowKey: row.rowKey,
      label: `${row.subjectName} – ${row.className} – ${row.coveragePercent}%`,
      reason: reasonParts.join(" · ") || "Requires review",
      severity,
    });
  }

  return items.sort((a, b) => b.severity - a.severity).slice(0, 5);
}

export function buildTeacherLeaderboard(
  rows: AdminSyllabusDashboardRow[],
  limit = 5
): AdminSyllabusTeacherLeaderboardEntry[] {
  const byTeacher = new Map<
    string,
    {
      name: string;
      total: number;
      count: number;
      expectedTotal: number;
    }
  >();

  for (const row of rows) {
    if (row.totalSubtopics <= 0) continue;
    const existing = byTeacher.get(row.teacherId) ?? {
      name: row.teacherName,
      total: 0,
      count: 0,
      expectedTotal: 0,
    };
    existing.total += row.coveragePercent;
    existing.expectedTotal += row.expectedCoveragePercent;
    existing.count += 1;
    byTeacher.set(row.teacherId, existing);
  }

  return [...byTeacher.entries()]
    .map(([teacherId, data]) => {
      const averageCoverage = Math.round(data.total / Math.max(data.count, 1));
      const averageExpected = Math.round(
        data.expectedTotal / Math.max(data.count, 1)
      );
      return {
        teacherId,
        teacherName: data.name,
        subjectCount: data.count,
        averageCoverage,
        paceStatus: deriveAdminPaceStatus(averageCoverage, averageExpected),
      };
    })
    .sort((a, b) => b.averageCoverage - a.averageCoverage)
    .slice(0, limit);
}

export function buildPerformanceRows(
  rows: AdminSyllabusDashboardRow[]
): AdminSyllabusPerformanceRow[] {
  return rows
    .filter((r) => r.totalSubtopics > 0)
    .map((r) => ({
      rowKey: r.rowKey,
      subjectLabel: `${r.subjectName} – ${r.className}`,
      coveragePercent: r.coveragePercent,
      averageExamScore: r.averageExamScore,
    }))
    .sort((a, b) => b.coveragePercent - a.coveragePercent)
    .slice(0, 8);
}

export function resolveFilteredDashboard(
  payload: AdminSyllabusDashboardPayload,
  filters: AdminSyllabusDashboardFilters
): {
  rows: AdminSyllabusDashboardRow[];
  tableRows: AdminSyllabusDashboardRow[];
  kpis: AdminSyllabusKpis;
  attention: AdminSyllabusAttentionItem[];
  teachers: AdminSyllabusTeacherLeaderboardEntry[];
  performance: AdminSyllabusPerformanceRow[];
  classHealth: AdminClassHealthSummary[];
  distribution: AdminSyllabusCoverageDistribution;
  schoolHealth: AdminSyllabusSchoolHealth;
  expectedCoveragePercent: number;
} {
  const termAdjusted = payload.rows.map((row) =>
    enrichRowForTerm(
      row,
      filters.academicYear,
      filters.term,
      payload.termDates
    )
  );
  const rows = applyDashboardFilters(termAdjusted, filters);
  const expectedCoveragePercent = computeAdminExpectedCoveragePercent(
    filters.academicYear,
    filters.term,
    payload.termDates
  );
  const tableRows = applyPaceChipFilter(rows, filters.paceChip);

  return {
    rows,
    tableRows,
    kpis: buildAdminSyllabusKpis(rows),
    attention: buildAttentionItems(rows),
    teachers: buildTeacherLeaderboard(rows),
    performance: buildPerformanceRows(rows),
    classHealth: buildClassHealthSummaries(rows),
    distribution: buildCoverageDistribution(rows),
    schoolHealth: buildSchoolHealth(rows, expectedCoveragePercent),
    expectedCoveragePercent,
  };
}

export function paginateAdminSyllabusTableRows(
  rows: AdminSyllabusDashboardRow[],
  page: number,
  rowsPerPage: number
): AdminSyllabusTablePaginationMeta {
  const totalRecords = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const slice = rows.slice(startIndex, startIndex + rowsPerPage);
  const startRecord = totalRecords === 0 ? 0 : startIndex + 1;
  const endRecord = Math.min(startIndex + rowsPerPage, totalRecords);

  return {
    slice,
    totalRecords,
    startRecord,
    endRecord,
    totalPages,
    page: safePage,
    rowsPerPage,
  };
}
