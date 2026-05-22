import type { StudentHealthAttendanceStatus } from "@/lib/student-attendance-status";

export type AttendanceRollupCounts = {
  present: number;
  ill: number;
  permitted: number;
  late: number;
  /** Unexcused absences only (not ill or permitted). */
  absent: number;
};

export type StudentHealthRecord = {
  status: StudentHealthAttendanceStatus;
  marked_at: string;
};

export type AttendanceRollupRow = {
  student_id: string;
  status: string;
};

export type AttendanceRollupHealthContext = {
  byStudent: Record<string, StudentHealthRecord | undefined>;
  /** When set, only count ill/permitted if marked on or before this date (YYYY-MM-DD). */
  attendanceDate?: string;
};

export function emptyAttendanceRollup(): AttendanceRollupCounts {
  return { present: 0, ill: 0, permitted: 0, late: 0, absent: 0 };
}

/** True when class-teacher health flag applies to this attendance date. */
export function healthExcuseAppliesOnDate(
  markedAt: string | undefined,
  attendanceDate: string | undefined
): boolean {
  if (!attendanceDate) return true;
  if (!markedAt?.trim()) return true;
  const markedMs = Date.parse(markedAt.trim());
  if (Number.isNaN(markedMs)) {
    const markedDay = markedAt.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markedDay)) return true;
    return markedDay <= attendanceDate;
  }
  const endOfAttendanceDayMs = Date.parse(`${attendanceDate}T23:59:59.999Z`);
  if (Number.isNaN(endOfAttendanceDayMs)) return true;
  return markedMs <= endOfAttendanceDayMs;
}

/** Health flag active on this calendar day (marked on or before end of that day). */
export function getApplicableHealthStatus(
  studentId: string,
  healthContext?: AttendanceRollupHealthContext
): StudentHealthAttendanceStatus | null {
  if (!healthContext) return null;
  const record = healthContext.byStudent[studentId];
  if (!record) return null;
  if (
    !healthExcuseAppliesOnDate(record.marked_at, healthContext.attendanceDate)
  ) {
    return null;
  }
  return record.status;
}

function resolveExcusedCategory(
  row: AttendanceRollupRow,
  healthContext?: AttendanceRollupHealthContext
): StudentHealthAttendanceStatus | null {
  return getApplicableHealthStatus(row.student_id, healthContext);
}

/**
 * Merge multiple subject/class attendance rows for one student on one day.
 * Absent wins over late/present so excused absences are not hidden by another subject mark.
 */
export function mergeRollCallStatusesForDay(
  statuses: string[]
): "present" | "absent" | "late" | null {
  const normalized = statuses.map((s) => String(s).toLowerCase());
  if (normalized.includes("absent")) return "absent";
  if (normalized.includes("late")) return "late";
  if (normalized.includes("present")) return "present";
  return null;
}

/**
 * Classify one student for a single calendar day (duty book / school rollup).
 * Health (ill/permitted) takes priority and applies even without a saved roll call.
 * No roll call on this date counts as unexcused absent (registered but not marked).
 */
export function classifyStudentDayAttendance(args: {
  studentId: string;
  /** All teacher_attendance status values for this student on this date. */
  rollCallStatuses: string[];
  healthContext?: AttendanceRollupHealthContext;
}): keyof AttendanceRollupCounts {
  const healthStatus = getApplicableHealthStatus(
    args.studentId,
    args.healthContext
  );
  if (healthStatus === "ill") return "ill";
  if (healthStatus === "permitted") return "permitted";

  const merged = mergeRollCallStatusesForDay(args.rollCallStatuses);
  if (!merged) return "absent";
  if (merged === "present") return "present";
  if (merged === "late") return "late";
  return "absent";
}

/** Classify one saved roll-call row into the five-way summary buckets. */
export function classifyAttendanceRow(
  row: AttendanceRollupRow,
  healthContext?: AttendanceRollupHealthContext
): keyof AttendanceRollupCounts {
  return classifyStudentDayAttendance({
    studentId: row.student_id,
    rollCallStatuses: [row.status],
    healthContext,
  });
}

export function countAttendanceRollupWithHealth(
  rows: AttendanceRollupRow[],
  healthContext?: AttendanceRollupHealthContext
): AttendanceRollupCounts {
  const counts = emptyAttendanceRollup();
  for (const row of rows) {
    counts[classifyAttendanceRow(row, healthContext)]++;
  }
  return counts;
}

export type TermAttendanceRow = AttendanceRollupRow & {
  attendance_date: string;
};

/** Per-student term totals from deduped daily attendance rows. */
export function tallyAttendanceByStudent(
  rows: TermAttendanceRow[],
  healthByStudent: Record<string, StudentHealthRecord | undefined>
): Record<string, AttendanceRollupCounts> {
  const byStudent: Record<string, AttendanceRollupCounts> = {};
  for (const row of rows) {
    if (!byStudent[row.student_id]) {
      byStudent[row.student_id] = emptyAttendanceRollup();
    }
    const bucket = classifyAttendanceRow(row, {
      byStudent: healthByStudent,
      attendanceDate: row.attendance_date,
    });
    byStudent[row.student_id]![bucket]++;
  }
  return byStudent;
}

/**
 * Legacy roll-up: `present` includes late; ill/permitted count toward `absent`.
 * Prefer `countAttendanceRollupWithHealth` for teacher attendance UI.
 */
export function countAttendanceRollup(rows: { status: string }[]): {
  present: number;
  absent: number;
  late: number;
} {
  const indexed = rows.map((r, i) => ({
    student_id: `__row_${i}`,
    status: r.status,
  }));
  const counts = countAttendanceRollupWithHealth(indexed, undefined);
  return {
    present: counts.present + counts.late,
    absent: counts.absent + counts.ill + counts.permitted,
    late: counts.late,
  };
}
