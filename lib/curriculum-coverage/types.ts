import type { CurriculumTrendDirection } from "@/lib/curriculum-coverage/trends";

export type CurriculumCoverageStatus =
  | "completed"
  | "on_track"
  | "needs_attention"
  | "at_risk"
  | "not_started";

export type CurriculumCoverageStatusFilter =
  | "all"
  | CurriculumCoverageStatus;

export interface CurriculumCoverageRow {
  rowKey: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  coveragePercent: number;
  expectedProgressPercent: number;
  progressVariance: number;
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
  completedTopics: number;
  totalTopics: number;
  completedSubtopics: number;
  totalSubtopics: number;
  lastUpdateAt: string | null;
  staleDays: number | null;
  status: CurriculumCoverageStatus;
}

export interface CurriculumCoverageKpis {
  overallCoveragePercent: number;
  subjectsOnTrack: number;
  subjectsNeedingAttention: number;
  completedSubjects: number;
  teachersBehindSchedule: number;
  totalSubjects: number;
}

export interface CurriculumHealth {
  score: number;
  label: "excellent" | "good" | "needs_attention" | "critical";
}

export interface CurriculumStatusSummary {
  onTrack: number;
  needsAttention: number;
  atRisk: number;
  completed: number;
  notStarted: number;
}

export interface CurriculumCoverageDistribution {
  completed: number;
  onTrack: number;
  needsAttention: number;
  atRisk: number;
  notStarted: number;
}

export interface CurriculumAttentionSubject {
  rowKey: string;
  classId: string;
  subjectId: string | null;
  subjectName: string;
  className: string;
  coveragePercent: number;
  status: CurriculumCoverageStatus;
  staleDays: number | null;
}

export interface CurriculumActiveTeacher {
  teacherId: string;
  teacherName: string;
  lastActivityAt: string | null;
  updatesThisMonth: number;
  averageCoverage: number;
}

export interface CurriculumTeacherSummaryRow {
  teacherId: string;
  teacherName: string;
  subjectsAssigned: number;
  averageCoverage: number;
  lastActivityAt: string | null;
  subjectsAtRisk: number;
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
  status: CurriculumCoverageStatus;
  behindSchedule: boolean;
}

export interface CurriculumClassSummaryRow {
  classId: string;
  className: string;
  subjectsCount: number;
  averageCoverage: number;
  completedSubjects: number;
  atRiskSubjects: number;
  trendPercent: number | null;
  trendDirection: CurriculumTrendDirection | null;
  status: CurriculumCoverageStatus;
}

export interface CurriculumActivityItem {
  id: string;
  subtopicTitle: string;
  topicTitle: string;
  subjectName: string;
  className: string;
  teacherName: string;
  status: string;
  updatedAt: string;
}

export interface CurriculumCoverageFilterOptions {
  classes: { id: string; name: string }[];
  subjects: { id: string | null; name: string }[];
  teachers: { id: string; name: string }[];
  academicYears: string[];
}

export interface CurriculumCoveragePageResult {
  kpis: CurriculumCoverageKpis;
  health: CurriculumHealth;
  executiveSummary: string[];
  statusSummary: CurriculumStatusSummary;
  coverageDistribution: CurriculumCoverageDistribution;
  subjectsRequiringAttention: CurriculumAttentionSubject[];
  mostActiveTeachers: CurriculumActiveTeacher[];
  overviewRows: CurriculumCoverageRow[];
  teacherRows: CurriculumTeacherSummaryRow[];
  classRows: CurriculumClassSummaryRow[];
  activity: CurriculumActivityItem[];
  insights: string[];
  filterOptions: CurriculumCoverageFilterOptions;
  totalOverview: number;
  totalTeachers: number;
  totalClasses: number;
  refreshedAt: string;
}

export interface CurriculumCoverageExportRow extends CurriculumCoverageRow {}
