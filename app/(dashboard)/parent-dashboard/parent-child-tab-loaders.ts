import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { reportParentDataLoadAlert } from "@/lib/watchdog/auth-health-alerts";
import {
  loadParentReportCardsForStudentWithDebug,
  type ParentReportCardsLoadDebug,
} from "@/lib/parent-report-cards-load";
import { loadParentPublishedClassResultPeriods } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";

export type { ParentReportCardsLoadDebug };

/**
 * Report card rows for the parent “Report cards” tab (preview payload per card).
 */
export async function loadParentReportCardsForStudent(
  supabase: SupabaseClient,
  params: {
    parentUserId: string;
    studentId: string;
    schoolId?: string | null;
    enrollmentDate: string | null;
  }
): Promise<unknown[]> {
  const { rows } = await loadParentReportCardsForStudentWithDebug(supabase, params);
  return rows;
}

export async function loadParentReportCardsForStudentDebug(
  supabase: SupabaseClient,
  params: {
    parentUserId: string;
    studentId: string;
    schoolId?: string | null;
    enrollmentDate: string | null;
  }
) {
  return loadParentReportCardsForStudentWithDebug(supabase, params);
}

type ServiceRoleClient = ReturnType<
  typeof import("@/lib/supabase/admin").createAdminClient
>;

/**
 * Published class result sheet periods (“Exam results” tab) for the student’s class.
 */
export async function loadParentClassResultSheets(
  admin: ServiceRoleClient,
  studentClassId: string,
  opts?: {
    studentId: string;
    schoolId?: string | null;
    enrollmentDate: string | null;
  }
): Promise<unknown[]> {
  try {
    return (await loadParentPublishedClassResultPeriods(admin, {
      studentClassId,
      studentId: opts?.studentId,
      enrollmentDate: opts?.enrollmentDate ?? null,
    })) as unknown[];
  } catch (err) {
    reportParentDataLoadAlert({
      phase: "class_results",
      schoolId: opts?.schoolId,
      studentId: opts?.studentId,
      metadata: { class_id: studentClassId },
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Attendance rows for the “Attendance” tab.
 */
export async function loadParentAttendanceForStudent(
  supabase: SupabaseClient,
  studentId: string,
  enrollmentDate: string | null,
  schoolId?: string | null
): Promise<unknown[]> {
  try {
    const { data: attRows, error: attErr } = await supabase
      .from("teacher_attendance")
      .select(
        "id, student_id, attendance_date, status, subject_id, created_at, updated_at, subjects ( name )"
      )
      .eq("student_id", studentId)
      .order("attendance_date", { ascending: false })
      .limit(2000);
    if (attErr) {
      reportParentDataLoadAlert({
        phase: "attendance",
        schoolId,
        studentId,
        error: attErr.message,
      });
      return [];
    }
    const rows = (attRows ?? []) as unknown as {
      id: string;
      student_id: string;
      attendance_date: string;
      status: "present" | "absent" | "late";
      subject_id: string | null;
      created_at: string;
      updated_at: string | null;
      subjects: { name: string } | null;
    }[];
    const boundary =
      enrollmentDate && enrollmentDate.trim().length >= 10
        ? enrollmentDate.trim().slice(0, 10)
        : null;
    const filtered = boundary
      ? rows.filter((a) => {
          const d = (a.attendance_date ?? "").trim().slice(0, 10);
          return d.length >= 10 && d >= boundary;
        })
      : rows;
    return filtered.map((a) => {
      const subjectName = a.subjects?.name?.trim()
        ? a.subjects.name.trim()
        : a.subject_id
          ? "Subject"
          : "Class (general)";
      const recordedAt =
        a.updated_at && a.updated_at.trim().length > 0
          ? a.updated_at
          : a.created_at ?? null;
      return {
        id: a.id,
        attendance_date: a.attendance_date,
        status: a.status,
        subjectName,
        subject_id: a.subject_id,
        recordedAt,
      };
    });
  } catch (err) {
    reportParentDataLoadAlert({
      phase: "attendance_exception",
      schoolId,
      studentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
