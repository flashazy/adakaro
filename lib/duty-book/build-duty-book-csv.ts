import { csvEscape } from "@/lib/analytics";
import { ILL_STATUS_DISPLAY_LOWER } from "@/lib/student-attendance-status";
import type { DutyBookClassRow, DutyBookSchoolSummary } from "./types";

function cell(n: number | null): string {
  if (n === null) return "—";
  return String(n);
}

export type BuildDutyBookCsvOptions = {
  /** Subset of classes to include in the breakdown section (school summary unchanged). */
  classes?: DutyBookClassRow[];
  /** Optional note row, e.g. filtered export label. */
  filteredLabel?: string;
};

export function buildDutyBookCsv(
  schoolName: string,
  summary: DutyBookSchoolSummary,
  classes: DutyBookClassRow[],
  options?: BuildDutyBookCsvOptions
): string {
  const lines: string[] = [];
  const classRows = options?.classes ?? classes;

  lines.push("Duty Book Attendance Summary");
  lines.push(`School,${csvEscape(schoolName)}`);
  lines.push(`Date,${summary.date}`);
  if (options?.filteredLabel) {
    lines.push(`Export scope,${csvEscape(options.filteredLabel)}`);
  }
  lines.push("");
  lines.push("metric,value");
  lines.push(`Registered students,${summary.registered}`);
  lines.push(`Boys,${summary.boys}`);
  lines.push(`Girls,${summary.girls}`);
  lines.push(`Present,${summary.present}`);
  lines.push(`Absent (unexcused),${summary.absent}`);
  lines.push(`${ILL_STATUS_DISPLAY_LOWER},${summary.ill}`);
  lines.push(`Permitted,${summary.permitted}`);
  lines.push(`Late,${summary.late}`);
  lines.push("");
  lines.push(
    `class,boys,girls,total,present,absent (unexcused),${ILL_STATUS_DISPLAY_LOWER},permitted`
  );
  for (const row of classRows) {
    lines.push(
      [
        csvEscape(row.className),
        row.boys,
        row.girls,
        row.total,
        cell(row.present),
        cell(row.absent),
        cell(row.ill),
        cell(row.permitted),
      ].join(",")
    );
  }
  return lines.join("\n");
}
