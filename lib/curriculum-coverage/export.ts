import { curriculumStatusLabel } from "@/lib/curriculum-coverage/coverage-status";
import { formatStaleWarning, daysSinceUpdate } from "@/lib/curriculum-coverage/stale";
import type { CurriculumCoverageRow } from "@/lib/curriculum-coverage/types";

const CSV_HEADERS = [
  "Subject",
  "Class",
  "Teacher",
  "Coverage %",
  "Expected %",
  "Variance",
  "Trend %",
  "Completed Topics",
  "Total Topics",
  "Last Update",
  "Status",
  "Stale Warning",
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsvCells(row: CurriculumCoverageRow): string[] {
  const staleDays = daysSinceUpdate(row.lastUpdateAt);
  const staleWarning = formatStaleWarning(staleDays);

  return [
    row.subjectName,
    row.className,
    row.teacherName,
    String(row.coveragePercent),
    String(row.expectedProgressPercent),
    String(row.progressVariance),
    row.trendPercent === null ? "" : String(row.trendPercent),
    String(row.completedTopics),
    String(row.totalTopics),
    row.lastUpdateAt ?? "",
    curriculumStatusLabel(row.status),
    staleWarning,
  ];
}

export function buildCurriculumCoverageCsv(rows: CurriculumCoverageRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(rowToCsvCells(row).map((c) => csvEscape(c)).join(","));
  }
  return lines.join("\n") + "\n";
}

/** UTF-8 BOM helps Excel open CSV with special characters correctly. */
export function buildCurriculumCoverageExcel(rows: CurriculumCoverageRow[]): string {
  return `\uFEFF${buildCurriculumCoverageCsv(rows)}`;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
