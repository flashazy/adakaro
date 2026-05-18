export type StudentHealthAttendanceStatus = "ill" | "permitted";

/** User-facing label; stored value in the database remains `"ill"`. */
export const ILL_STATUS_DISPLAY = "Sick";
export const ILL_STATUS_DISPLAY_LOWER = "sick";
export const ILL_STATUS_DISPLAY_BADGE = "Sick 🏥";

export type RollCallAttendanceStatus = "present" | "absent" | "late";

/** Class-teacher health flag blocks subject-teacher roll call changes. */
export function isAttendanceLockedByHealth(
  health: StudentHealthAttendanceStatus | null | undefined
): health is StudentHealthAttendanceStatus {
  return health === "ill" || health === "permitted";
}

export function getHealthAttendanceTooltip(
  health: StudentHealthAttendanceStatus
): string {
  if (health === "ill") {
    return "Student is sick (marked by class teacher)";
  }
  return "Student has permission to be absent";
}

/** Label shown to subject teachers on the attendance screen. */
export function getAttendanceDisplayLabel(
  rollCall: RollCallAttendanceStatus,
  health: StudentHealthAttendanceStatus | null | undefined
): string {
  if (health === "ill") return ILL_STATUS_DISPLAY_BADGE;
  if (health === "permitted") return "Permitted 📝";
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
