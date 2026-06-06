import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isStudentHealthAttendanceStatus,
  resolveStudentAttendanceLock,
  type AttendanceLockKind,
  type StudentHealthAttendanceStatus,
} from "@/lib/student-attendance-status";

export type AttendanceLockByStudent = Record<string, AttendanceLockKind>;

/**
 * Resolve subject Class List locks for a class and date.
 * Uses admin client so subject teachers can read official class_attendance.
 */
export async function fetchAttendanceLocksForStudents(
  admin: SupabaseClient,
  args: {
    classId: string;
    attendanceDate: string;
    studentIds: string[];
  }
): Promise<AttendanceLockByStudent> {
  const { classId, attendanceDate, studentIds } = args;
  const locks: AttendanceLockByStudent = {};
  if (studentIds.length === 0) return locks;

  const classByStudent = new Map<string, string>();
  const { data: classRows, error: classErr } = await admin
    .from("class_attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("attendance_date", attendanceDate)
    .in("student_id", studentIds);

  if (classErr) {
    console.error(
      "[fetchAttendanceLocksForStudents] class_attendance",
      classErr.message
    );
  }

  for (const r of classRows ?? []) {
    const row = r as { student_id: string; status: string };
    classByStudent.set(row.student_id, row.status);
  }

  const healthByStudent = new Map<string, StudentHealthAttendanceStatus>();
  const { data: healthRows, error: healthErr } = await admin
    .from("student_attendance_status")
    .select("student_id, status")
    .in("student_id", studentIds);

  if (healthErr) {
    console.error(
      "[fetchAttendanceLocksForStudents] student_attendance_status",
      healthErr.message
    );
  }

  for (const h of healthRows ?? []) {
    const row = h as { student_id: string; status: string };
    if (isStudentHealthAttendanceStatus(row.status)) {
      healthByStudent.set(row.student_id, row.status);
    }
  }

  for (const studentId of studentIds) {
    const hasClassAttendanceRow = classByStudent.has(studentId);
    const lock = resolveStudentAttendanceLock({
      classAttendanceStatus: classByStudent.get(studentId) ?? null,
      hasClassAttendanceRow,
      healthStatus: healthByStudent.get(studentId) ?? null,
    });
    if (lock) {
      locks[studentId] = lock;
    }
  }

  return locks;
}
