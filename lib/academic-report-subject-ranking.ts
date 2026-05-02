import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";

/** Letter-grade priority for subject ranking tie-breaks (higher = better). */
const GRADE_PRIORITY: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

function getGradeScore(grade: string | null): number {
  if (!grade) return -1;
  return GRADE_PRIORITY[grade.trim().toUpperCase().charAt(0)] ?? -1;
}

export function subjectKeyForRanking(subject: string): string {
  return subject.trim().toLowerCase();
}

export function sortSubjectRankingInPlace(
  rows: AcademicPerformanceReportData["subject_ranking"],
  classAverageBySubjectKey: Map<string, number>
): void {
  rows.sort((a, b) => {
    const pa = a.pass_rate_pct ?? -1;
    const pb = b.pass_rate_pct ?? -1;
    if (pb !== pa) return pb - pa;

    const gradeDiff =
      getGradeScore(b.top_grade) - getGradeScore(a.top_grade);
    if (gradeDiff !== 0) return gradeDiff;

    const aa =
      classAverageBySubjectKey.get(subjectKeyForRanking(a.subject)) ?? -1;
    const ab =
      classAverageBySubjectKey.get(subjectKeyForRanking(b.subject)) ?? -1;
    if (ab !== aa) return ab - aa;

    return a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" });
  });
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
}

function classAverageMapFromTeacherPerformance(
  teacherPerformance:
    | AcademicPerformanceReportData["teacher_performance"]
    | undefined
): Map<string, number> {
  const m = new Map<string, number>();
  for (const tp of teacherPerformance ?? []) {
    const key = subjectKeyForRanking(tp.subject || "");
    if (!key) continue;
    if (
      tp.class_average_pct != null &&
      Number.isFinite(tp.class_average_pct)
    ) {
      m.set(key, tp.class_average_pct);
    }
  }
  return m;
}

/**
 * Reorders `subject_ranking` and assigns `rank` using the same rules as at
 * generation time. Call on loaded JSON so older snapshots match current rules.
 */
export function applyCanonicalSubjectRanking(
  data: AcademicPerformanceReportData
): void {
  if (!Array.isArray(data.subject_ranking)) return;
  sortSubjectRankingInPlace(
    data.subject_ranking,
    classAverageMapFromTeacherPerformance(data.teacher_performance)
  );
}
