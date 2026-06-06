export type StudentHealthAttendanceStatus = "ill" | "permitted";

/** User-facing label; stored value in the database remains `"ill"`. */
export const ILL_STATUS_DISPLAY = "Sick";
export const ILL_STATUS_DISPLAY_LOWER = "sick";
export const ILL_STATUS_DISPLAY_BADGE = "Sick 🏥";

export type RollCallAttendanceStatus = "present" | "absent" | "late";

/** Subject Class List lock kind (class_attendance primary, health fallback). */
export type AttendanceLockKind = "sick" | "permitted" | "absent";

export function isAttendanceLockKind(
  value: string | null | undefined
): value is AttendanceLockKind {
  return value === "sick" || value === "permitted" || value === "absent";
}

/** True when class teacher (or health fallback) blocks subject roll-call edits. */
export function isAttendanceLocked(
  lock: AttendanceLockKind | null | undefined
): lock is AttendanceLockKind {
  return isAttendanceLockKind(lock);
}

/** Map official class_attendance status to a subject-list lock, if any. */
export function classAttendanceStatusToLock(
  status: string | null | undefined
): AttendanceLockKind | null {
  if (status === "sick") return "sick";
  if (status === "permitted") return "permitted";
  if (status === "absent") return "absent";
  return null;
}

/**
 * Merged lock: when class_attendance exists for the date, only sick/permitted/absent
 * lock; present/late do not. With no row, fall back to health (ill/permitted).
 */
export function resolveStudentAttendanceLock(args: {
  classAttendanceStatus: string | null | undefined;
  hasClassAttendanceRow: boolean;
  healthStatus: StudentHealthAttendanceStatus | null | undefined;
}): AttendanceLockKind | null {
  if (args.hasClassAttendanceRow) {
    return classAttendanceStatusToLock(args.classAttendanceStatus);
  }
  if (args.healthStatus === "ill") return "sick";
  if (args.healthStatus === "permitted") return "permitted";
  return null;
}

/** Class-teacher health flag blocks subject-teacher roll call changes. */
export function isAttendanceLockedByHealth(
  healthStatus: StudentHealthAttendanceStatus | null | undefined
): healthStatus is StudentHealthAttendanceStatus {
  return healthStatus === "ill" || healthStatus === "permitted";
}

export function getHealthAttendanceTooltip(
  healthStatus: StudentHealthAttendanceStatus
): string {
  if (healthStatus === "ill") {
    return "Student is sick (marked by class teacher)";
  }
  return "Student has permission to be absent";
}

export function getAttendanceLockDisplayLabel(lock: AttendanceLockKind): string {
  if (lock === "sick") return ILL_STATUS_DISPLAY_BADGE;
  if (lock === "permitted") return "Permitted 📝";
  return "Absent ❌";
}

export function getAttendanceLockTooltip(lock: AttendanceLockKind): string {
  if (lock === "sick") {
    return "Student is sick (marked by class teacher for this date)";
  }
  if (lock === "permitted") {
    return "Student has permission to be absent (marked by class teacher for this date)";
  }
  return "Student is absent (marked by class teacher for this date)";
}

/** Label shown to subject teachers on the attendance screen. */
export function getAttendanceDisplayLabel(
  rollCall: RollCallAttendanceStatus,
  healthStatus: StudentHealthAttendanceStatus | null | undefined
): string {
  if (healthStatus === "ill") return ILL_STATUS_DISPLAY_BADGE;
  if (healthStatus === "permitted") return "Permitted 📝";
  if (rollCall === "present") return "Present ✅";
  if (rollCall === "late") return "Late";
  if (rollCall === "absent") return "Absent ❌";
  return "Present ✅";
}

export function isStudentHealthAttendanceStatus(
  value: string | null | undefined
): value is StudentHealthAttendanceStatus {
  return value === "ill" || value === "permitted";
}
