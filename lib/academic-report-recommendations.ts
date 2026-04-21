import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { HistoricalTermSubjectMetrics } from "@/lib/academic-report-types";

export type ReportSectionKind =
  | "overall"
  | "distribution"
  | "subject_ranking"
  | "teacher_performance";

/**
 * Returns 0–4 short recommendation lines for a section (deduped).
 * Optional `previousTermMetricsBySubject` must come from stored `academic_reports` for the selected baseline term.
 */
export function getRecommendedActionLines(args: {
  section: ReportSectionKind;
  data: AcademicPerformanceReportData;
  showNectaDivision: boolean;
  compareTermId: string;
  /** Saved previous-term pass rates by subject from `comparisonByTermId[compareTermId]`; omit when unavailable. */
  previousTermMetricsBySubject?: HistoricalTermSubjectMetrics | null;
}): string[] {
  const { section, data, showNectaDivision, compareTermId, previousTermMetricsBySubject } =
    args;
  const lines: string[] = [];
  const add = (s: string) => {
    if (!lines.includes(s)) lines.push(s);
  };

  const op = data.overall_performance;

  if (section === "overall") {
    const weakSubject = data.teacher_performance.find(
      (r) =>
        r.class_average_pct != null &&
        Number.isFinite(r.class_average_pct) &&
        r.class_average_pct < 50
    );
    if (weakSubject) {
      add("💡 Recommend: Schedule remedial classes for this subject");
    }
    const estFailed =
      op.overall_fail_rate_pct != null && op.total_students > 0
        ? (op.overall_fail_rate_pct / 100) * op.total_students
        : 0;
    if (estFailed > 3) {
      add("💡 Recommend: Parent meeting for struggling students");
    }
  }

  if (section === "distribution" && showNectaDivision) {
    const div0 =
      data.division_distribution.find((d) => d.division === "0")?.total ?? 0;
    const iv =
      data.division_distribution.find((d) => d.division === "IV")?.total ?? 0;
    if (div0 + iv > 3) {
      add("💡 Recommend: Parent meeting for struggling students");
    }
  }

  if (section === "subject_ranking") {
    const rows = data.subject_ranking;
    if (rows.length >= 2) {
      const maxRank = Math.max(...rows.map((r) => r.rank));
      if (maxRank > 1) {
        add("💡 Recommend: Department meeting to review this subject");
      }
    }
  }

  if (section === "teacher_performance") {
    const snap =
      compareTermId && previousTermMetricsBySubject
        ? previousTermMetricsBySubject
        : null;
    if (snap) {
      const findPrevPass = (subject: string): number | null => {
        const row = snap[subject];
        if (row?.pass_rate_pct != null) return row.pass_rate_pct;
        const key = subject.trim().toLowerCase();
        for (const [k, v] of Object.entries(snap)) {
          if (k.trim().toLowerCase() === key && v.pass_rate_pct != null) {
            return v.pass_rate_pct;
          }
        }
        return null;
      };
      for (const row of data.teacher_performance) {
        const prev = findPrevPass(row.subject);
        const cur = row.pass_rate_pct;
        if (prev != null && cur != null && prev - cur > 10) {
          add("💡 Recommend: Teacher observation or peer mentoring");
          break;
        }
      }
    }
  }

  const needsFallbackPositive = [
    "overall",
    "distribution",
    "subject_ranking",
    "teacher_performance",
  ].includes(section);
  if (needsFallbackPositive && lines.length === 0) {
    add("✅ No action needed at this time. Keep up the good work!");
  }

  return lines;
}
