/**
 * Shared types for Academic Reports (client + server). Keeps UI bundles free of
 * server-only coordinator modules.
 */

export type AtRiskStudentRow = {
  studentId: string;
  studentName: string;
  /** Short explanation shown in the alert. */
  reason: string;
};

export type CompareTermOption = {
  id: string;
  /** e.g. "Term 2 2024-2025" */
  label: string;
};

/** Saved metrics from a historical `academic_reports.report_data` snapshot, keyed by subject name. */
export type HistoricalTermSubjectMetrics = Record<
  string,
  { class_average_pct: number | null; pass_rate_pct: number | null }
>;

export type AcademicReportLiveSupplement = {
  atRiskStudents: AtRiskStudentRow[];
  compareTermOptions: CompareTermOption[];
  /** `id` format: `${term}|${academic_year}` — matches `CompareTermOption.id`. */
  comparisonByTermId: Record<string, HistoricalTermSubjectMetrics>;
  defaultCompareTermId: string;
};
