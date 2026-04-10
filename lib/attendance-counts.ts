/**
 * Roll-up counts for attendance summaries: the "present" total includes both
 * strictly present and late (late is also counted separately).
 */
export function countAttendanceRollup(rows: { status: string }[]): {
  /** Count of students marked present or late (late is included here). */
  present: number;
  absent: number;
  /** Count of students marked late only (also included in `present`). */
  late: number;
} {
  let strictPresent = 0;
  let absent = 0;
  let late = 0;
  for (const r of rows) {
    const s = String(r.status).toLowerCase();
    if (s === "absent") absent++;
    else if (s === "late") late++;
    else if (s === "present") strictPresent++;
  }
  return {
    present: strictPresent + late,
    absent,
    late,
  };
}
