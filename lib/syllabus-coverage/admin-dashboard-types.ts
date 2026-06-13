export type AdminSyllabusPaceStatus =
  | "ahead"
  | "on_track"
  | "slightly_behind"
  | "critical";

export type AdminSyllabusPaceChipFilter =
  | "all"
  | "critical"
  | "behind"
  | "on_track"
  | "healthy";

export type AdminSyllabusActivityLevel = "normal" | "warning" | "needs_attention";

export interface AdminSyllabusFilterOptions {
  academicYears: string[];
  terms: string[];
  classes: { id: string; name: string }[];
  subjects: { id: string | null; name: string }[];
  teachers: { id: string; name: string }[];
}

export interface AdminSyllabusDashboardRow {
  rowKey: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  totalSubtopics: number;
  completedSubtopics: number;
  coveragePercent: number;
  expectedCoveragePercent: number;
  paceStatus: AdminSyllabusPaceStatus;
  lastActivityAt: string | null;
  lastActivityDays: number | null;
  activityLevel: AdminSyllabusActivityLevel;
  averageExamScore: number | null;
}

export interface AdminSyllabusSchoolTermDates {
  termStructure: "2_terms" | "3_terms" | null;
  term1Start: string | null;
  term1End: string | null;
  term2Start: string | null;
  term2End: string | null;
  term3Start: string | null;
  term3End: string | null;
}

export interface AdminSyllabusDashboardPayload {
  academicYear: string;
  termDates: AdminSyllabusSchoolTermDates;
  filterOptions: AdminSyllabusFilterOptions;
  rows: AdminSyllabusDashboardRow[];
}

export interface AdminSyllabusDashboardFilters {
  academicYear: string;
  term: string;
  classId: string;
  subjectKey: string;
  teacherId: string;
  paceChip: AdminSyllabusPaceChipFilter;
}

export interface AdminSyllabusKpis {
  overallCoverage: number;
  onTrackSubjects: number;
  behindScheduleSubjects: number;
  completedSubjects: number;
  activeTeachers: number;
}

export interface AdminSyllabusAttentionItem {
  rowKey: string;
  label: string;
  reason: string;
  severity: number;
}

export interface AdminSyllabusTeacherRank {
  teacherId: string;
  teacherName: string;
  coveragePercent: number;
  paceStatus: AdminSyllabusPaceStatus;
}

export interface AdminSyllabusTeacherLeaderboardEntry {
  teacherId: string;
  teacherName: string;
  subjectCount: number;
  averageCoverage: number;
  paceStatus: AdminSyllabusPaceStatus;
}

export interface AdminClassHealthSummary {
  classId: string;
  className: string;
  coveragePercent: number;
  paceStatus: AdminSyllabusPaceStatus;
}

export interface AdminSyllabusCoverageDistribution {
  healthy: number;
  onTrack: number;
  behind: number;
  critical: number;
}

export interface AdminSyllabusSchoolHealth {
  score: number;
  paceStatus: AdminSyllabusPaceStatus;
}

export interface AdminSyllabusPerformanceRow {
  rowKey: string;
  subjectLabel: string;
  coveragePercent: number;
  averageExamScore: number | null;
}

export const ADMIN_SYLLABUS_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;
export type AdminSyllabusTablePageSize =
  (typeof ADMIN_SYLLABUS_TABLE_PAGE_SIZES)[number];

export interface AdminSyllabusTablePaginationMeta {
  slice: AdminSyllabusDashboardRow[];
  totalRecords: number;
  startRecord: number;
  endRecord: number;
  totalPages: number;
  page: number;
  rowsPerPage: number;
}
