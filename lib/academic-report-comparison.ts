import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { HistoricalTermSubjectMetrics } from "@/lib/academic-report-types";

export type SubjectCompareRow = {
  subject: string;
  current: number | null;
  previous: number | null;
  diffPct: number | null;
  arrow: "up" | "down" | "flat";
};

function lookupHistoricalAverage(
  snapshot: HistoricalTermSubjectMetrics | undefined,
  subject: string
): number | null {
  if (!snapshot) return null;
  const direct = snapshot[subject];
  if (direct?.class_average_pct != null) return direct.class_average_pct;
  const key = subject.trim().toLowerCase();
  for (const [k, v] of Object.entries(snapshot)) {
    if (k.trim().toLowerCase() === key && v.class_average_pct != null) {
      return v.class_average_pct;
    }
  }
  return null;
}

export function buildSubjectCompareRows(
  data: AcademicPerformanceReportData,
  compareTermId: string,
  comparisonByTermId: Record<string, HistoricalTermSubjectMetrics>
): SubjectCompareRow[] {
  const snapshot = compareTermId ? comparisonByTermId[compareTermId] : undefined;
  return data.teacher_performance.map((tp) => {
    const current = tp.class_average_pct;
    const previous = lookupHistoricalAverage(snapshot, tp.subject);
    let diffPct: number | null = null;
    let arrow: "up" | "down" | "flat" = "flat";
    if (current != null && previous != null) {
      diffPct = Math.round((current - previous) * 10) / 10;
      if (diffPct > 0.05) arrow = "up";
      else if (diffPct < -0.05) arrow = "down";
    }
    return { subject: tp.subject, current, previous, diffPct, arrow };
  });
}
