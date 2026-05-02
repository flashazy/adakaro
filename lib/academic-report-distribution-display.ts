import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { SchoolLevel } from "@/lib/school-level";

export type DistributionRow =
  AcademicPerformanceReportData["division_distribution"][number];

const PRIMARY_GRADE_DISPLAY_ORDER = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "INC",
  "ABS",
] as const;

const PRIMARY_DISPLAY_KEYS = new Set<string>(PRIMARY_GRADE_DISPLAY_ORDER);

/**
 * Primary snapshots may use row key "X" for non–letter-grade cases; merge that
 * into ABS for display. INC/ABS rows are preserved if present.
 */
export function primaryGradeDistributionForDisplay(
  rows: DistributionRow[]
): DistributionRow[] {
  const acc = new Map<
    string,
    { boys: number; girls: number; total: number }
  >();
  const add = (
    key: string,
    boys: number,
    girls: number,
    total: number
  ): void => {
    const cur = acc.get(key) ?? { boys: 0, girls: 0, total: 0 };
    acc.set(key, {
      boys: cur.boys + boys,
      girls: cur.girls + girls,
      total: cur.total + total,
    });
  };

  for (const r of rows) {
    const k = (r.division ?? "").trim().toUpperCase();
    if (!k) continue;
    const target = k === "X" ? "ABS" : k;
    if (!PRIMARY_DISPLAY_KEYS.has(target)) continue;
    add(target, r.boys, r.girls, r.total);
  }

  return PRIMARY_GRADE_DISPLAY_ORDER.map((division) => {
    const c = acc.get(division) ?? { boys: 0, girls: 0, total: 0 };
    return { division, ...c };
  });
}

export function hasDistributionTableData(rows: DistributionRow[]): boolean {
  return rows.length > 0 && rows.some((r) => r.total > 0);
}

/**
 * Rows to render for the distribution table: NECTA divisions for secondary,
 * primary grade bands (including INC/ABS) when the snapshot matches primary mode.
 */
export function resolveAcademicReportDistributionRows(
  data: AcademicPerformanceReportData,
  displaySchoolLevel: SchoolLevel
): DistributionRow[] {
  if (displaySchoolLevel === "secondary") {
    if (data.division_mode !== "necta") return [];
    return data.division_distribution;
  }
  if (data.division_mode !== "primary_grades") return [];
  return primaryGradeDistributionForDisplay(data.division_distribution);
}
