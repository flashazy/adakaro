import {
  CLASS_ATTENDANCE_STATUSES,
  type ClassAttendanceDaySummary,
  type ClassAttendanceStatus,
} from "./class-attendance-types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseAttendanceDate(raw: string): string | null {
  const d = raw.trim();
  if (!DATE_RE.test(d)) return null;
  return d;
}

export function isClassAttendanceStatus(v: string): v is ClassAttendanceStatus {
  return (CLASS_ATTENDANCE_STATUSES as readonly string[]).includes(v);
}

export function emptyDaySummary(): ClassAttendanceDaySummary {
  return {
    present: 0,
    absent: 0,
    late: 0,
    sick: 0,
    permitted: 0,
  };
}

/** Raw counts per status bucket. */
export function tallyStatuses(
  statuses: ClassAttendanceStatus[]
): ClassAttendanceDaySummary {
  const out = emptyDaySummary();
  for (const s of statuses) {
    out[s]++;
  }
  return out;
}

/** In class = Present + Late. Not in class = Absent + Sick + Permitted. */
export interface ClassAttendanceRollup {
  byStatus: ClassAttendanceDaySummary;
  /** On-time present only (excludes late). */
  presentOnly: number;
  late: number;
  /** Present + Late — counts toward attendance percentage. */
  inClass: number;
  /** Absent + Sick + Permitted — excused or unexcused absences. */
  notInClass: number;
}

export function rollupDaySummary(
  summary: ClassAttendanceDaySummary
): ClassAttendanceRollup {
  return {
    byStatus: summary,
    presentOnly: summary.present,
    late: summary.late,
    inClass: summary.present + summary.late,
    notInClass: summary.absent + summary.sick + summary.permitted,
  };
}

export function rollupFromStatuses(
  statuses: ClassAttendanceStatus[]
): ClassAttendanceRollup {
  return rollupDaySummary(tallyStatuses(statuses));
}

export function presentPercent(inClass: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((inClass / total) * 100);
}

export function formatHistorySummary(summary: ClassAttendanceDaySummary): string {
  const r = rollupDaySummary(summary);
  return `In class: ${r.inClass} (Present + Late) · Not in class: ${r.notInClass} (Absent + Sick + Permitted)`;
}

/**
 * Status breakdown for history cards — matches overview summary:
 * "Present" is in-class count (on-time present + late), not present-only.
 * Sick and permitted are listed separately, not folded into absent.
 */
export function formatHistoryStatusBreakdown(
  summary: ClassAttendanceDaySummary
): string {
  const r = rollupDaySummary(summary);
  const parts: string[] = [`Present ${r.inClass}`];
  if (r.late > 0) parts.push(`Late ${r.late}`);
  parts.push(`Absent ${summary.absent}`);
  if (summary.sick > 0) parts.push(`Sick ${summary.sick}`);
  if (summary.permitted > 0) parts.push(`Permitted ${summary.permitted}`);
  return parts.join(" · ");
}

export function formatSaveConfirmation(summary: ClassAttendanceDaySummary): string {
  const r = rollupDaySummary(summary);
  const latePart =
    r.late > 0
      ? ` (including ${r.late} late arrival${r.late !== 1 ? "s" : ""})`
      : "";
  return `${r.inClass} student${r.inClass !== 1 ? "s" : ""} present${latePart}, ${r.notInClass} student${r.notInClass !== 1 ? "s" : ""} absent`;
}
