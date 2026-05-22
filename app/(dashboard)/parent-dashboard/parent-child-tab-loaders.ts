import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildParentReportCardPreviewData } from "./build-parent-report-card-preview";
import { sortParentReportCardsByRecency } from "@/lib/parent-report-card-order";
import { loadParentPublishedClassResultPeriods } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import { reportCardIsOnOrAfterEnrollment } from "@/lib/parent-academic-from-enrollment";

/**
 * Report card rows for the parent “Report cards” tab (preview payload per card).
 */
export async function loadParentReportCardsForStudent(
  supabase: SupabaseClient,
  params: { parentUserId: string; studentId: string; enrollmentDate: string | null }
): Promise<unknown[]> {
  try {
    const { data: rawRows, error: qErr } = await supabase
      .from("report_cards")
      .select(
        "id, student_id, term, academic_year, status, approved_at, updated_at, created_at"
      )
      .eq("student_id", params.studentId)
      .eq("status", "approved")
      .order("academic_year", { ascending: false })
      .limit(200);
    if (qErr) return [];
    const raw = (rawRows ?? []) as {
      id: string;
      student_id: string;
      term: string;
      academic_year: string;
      status: string;
      approved_at: string | null;
      updated_at: string;
      created_at: string;
    }[];
    const filtered = raw.filter((r) =>
      reportCardIsOnOrAfterEnrollment(
        {
          approved_at: r.approved_at,
          updated_at: r.updated_at,
          created_at: r.created_at,
        },
        params.enrollmentDate
      )
    );
    if (filtered.length === 0) return [];

    const rawSorted = sortParentReportCardsByRecency(filtered);
    const out: unknown[] = [];
    for (const r of rawSorted) {
      const built = await buildParentReportCardPreviewData(supabase, {
        parentUserId: params.parentUserId,
        studentId: params.studentId,
        term: r.term,
        academicYear: r.academic_year,
      });
      if (built.ok) {
        out.push({
          id: r.id,
          term: r.term,
          academic_year: r.academic_year,
          status: r.status,
          previewData: built.data,
          feeBlocked: false,
        });
      } else if (built.error === "fee_blocked" && "eligibility" in built) {
        out.push({
          id: r.id,
          term: r.term,
          academic_year: r.academic_year,
          status: r.status,
          feeBlocked: true,
          feeEligibility: built.eligibility,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
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
  opts?: { studentId: string; enrollmentDate: string | null }
): Promise<unknown[]> {
  try {
    return (await loadParentPublishedClassResultPeriods(admin, {
      studentClassId,
      studentId: opts?.studentId,
      enrollmentDate: opts?.enrollmentDate ?? null,
    })) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Attendance rows for the “Attendance” tab.
 */
export async function loadParentAttendanceForStudent(
  supabase: SupabaseClient,
  studentId: string,
  enrollmentDate: string | null
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
    if (attErr) return [];
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
  } catch {
    return [];
  }
}
