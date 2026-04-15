/**
 * When subject-scoped attendance exists, a student can have multiple rows on the
 * same calendar day (legacy `subject_id` null plus per-subject rows). Term totals
 * should count at most one status per student per day; class-wide rows take precedence.
 */
export function dedupeTeacherAttendanceByStudentAndDate<
  T extends {
    student_id: string;
    attendance_date: string;
    subject_id: string | null;
  },
>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.student_id}|${r.attendance_date}`;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, r);
    } else if (r.subject_id === null) {
      map.set(k, r);
    } else if (prev.subject_id === null) {
      /* keep holistic row */
    } else {
      map.set(k, prev);
    }
  }
  return [...map.values()];
}
