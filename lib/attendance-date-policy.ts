import {
  parseAttendanceDate,
  todayIsoDate,
} from "@/lib/class-attendance/class-attendance-utils";

/** Server-side save rejection when date is not today. */
export const ATTENDANCE_SAVE_TODAY_ONLY_ERROR =
  "Attendance can only be recorded for the current date";

/** Banner when viewing a non-editable date. */
export const ATTENDANCE_EDIT_BANNER_MESSAGE =
  "You can only edit attendance for today";

/** Banner when the selected date is in the future. */
export const ATTENDANCE_FUTURE_BLOCKED_MESSAGE =
  "Cannot edit future attendance";

export type AttendanceDateEditMode = "editable" | "readonly" | "future_blocked";

export function getAttendanceDateEditMode(
  dateIso: string,
  todayIso: string = todayIsoDate()
): AttendanceDateEditMode {
  if (dateIso > todayIso) return "future_blocked";
  if (dateIso < todayIso) return "readonly";
  return "editable";
}

export function isAttendanceDateEditable(
  dateIso: string,
  todayIso: string = todayIsoDate()
): boolean {
  return getAttendanceDateEditMode(dateIso, todayIso) === "editable";
}

/** Validates that attendance may be saved (server date must be today). */
export function assertAttendanceDateEditableForSave(
  rawDate: string | null | undefined,
  todayIso: string = todayIsoDate()
): { ok: true; date: string } | { ok: false; error: string } {
  const parsed = rawDate ? parseAttendanceDate(rawDate) : null;
  if (!parsed) {
    return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
  }
  const mode = getAttendanceDateEditMode(parsed, todayIso);
  if (mode === "future_blocked") {
    return { ok: false, error: ATTENDANCE_FUTURE_BLOCKED_MESSAGE };
  }
  if (mode === "readonly") {
    return { ok: false, error: ATTENDANCE_SAVE_TODAY_ONLY_ERROR };
  }
  return { ok: true, date: parsed };
}
