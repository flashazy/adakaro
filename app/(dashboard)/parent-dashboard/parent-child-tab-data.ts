import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type { ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";
import {
  listParentClassResultSubjects,
  loadParentMajorExamClassResults,
} from "./load-parent-major-exam-class-results";
import { buildParentReportCardPreviewData } from "./build-parent-report-card-preview";
import { sortParentReportCardsByRecency } from "@/lib/parent-report-card-order";
import {
  loadParentPublishedClassResultPeriods,
  type ParentPublishedClassResultPeriod,
} from "@/app/(dashboard)/teacher-dashboard/coordinator/data";

export type ReportCardListRow = {
  id: string;
  term: string;
  academic_year: string;
  status: string;
  /** Same preview payload as the coordinator {@link ReportCardPreview} uses. */
  previewData: ReportCardPreviewData;
};

export type AttendanceRow = {
  id: string;
  attendance_date: string;
  status: "present" | "absent" | "late";
  /** Per-subject label, or a general class row when `subject_id` is null. */
  subjectName: string;
  subject_id: string | null;
  /** When the mark was saved (`created_at`); used for the Time column. */
  recordedAt: string | null;
};

export type ChildTabData = {
  reportCards: ReportCardListRow[];
  /** Published class result sheets (noticeboard), same data as coordinator “Print result”. */
  classResultSheets: ParentPublishedClassResultPeriod[];
  attendance: AttendanceRow[];
  /** Major-exam class reports (same stats as teacher “Full marks report”). */
  majorExamClassResults: ParentMajorExamClassResultsPayload;
  /**
   * Subjects (gradebook) for the child’s class that have at least one
   * assignment with recorded scores. Class results are loaded one subject
   * at a time, like the teacher Full marks report.
   */
  classResultSubjects: string[];
};

/**
 * Loads read-only data for parent child-card tabs. Uses the service role only
 * where RLS does not allow parents (gradebook majors, etc.).
 * Caller must only pass student_ids already linked in parent_students.
 */
export async function loadParentChildTabData(
  students: { id: string; class_id: string }[]
): Promise<Map<string, ChildTabData>> {
  const empty = (): ChildTabData => ({
    reportCards: [],
    classResultSheets: [],
    attendance: [],
    majorExamClassResults: { options: [], defaultOptionId: "" },
    classResultSubjects: [],
  });

  const byStudent = new Map<string, ChildTabData>();
  for (const s of students) {
    byStudent.set(s.id, empty());
  }

  if (students.length === 0) return byStudent;

  const studentIds = students.map((s) => s.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return byStudent;
  }

  const { data: linkCheck } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .in("student_id", studentIds);
  const allowed = new Set(
    ((linkCheck ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );
  if (allowed.size === 0) return byStudent;

  const [rcRes, attRes] = await Promise.all([
    supabase
      .from("report_cards")
      .select("id, student_id, term, academic_year, status")
      .in("student_id", studentIds)
      .in("status", ["pending_review", "approved"])
      .order("academic_year", { ascending: false })
      .limit(200),
    supabase
      .from("teacher_attendance")
      .select(
        "id, student_id, attendance_date, status, subject_id, created_at, subjects ( name )"
      )
      .in("student_id", studentIds)
      .order("attendance_date", { ascending: false })
      .limit(2000),
  ]);

  const rawByStudent = new Map<
    string,
    {
      id: string;
      student_id: string;
      term: string;
      academic_year: string;
      status: string;
    }[]
  >();
  for (const r of (rcRes.data ?? []) as {
    id: string;
    student_id: string;
    term: string;
    academic_year: string;
    status: string;
  }[]) {
    if (!allowed.has(r.student_id)) continue;
    const list = rawByStudent.get(r.student_id) ?? [];
    list.push(r);
    rawByStudent.set(r.student_id, list);
  }

  for (const sid of studentIds) {
    if (!allowed.has(sid)) continue;
    const entry = byStudent.get(sid);
    if (!entry) continue;
    const rawSorted = sortParentReportCardsByRecency(
      rawByStudent.get(sid) ?? []
    );
    if (rawSorted.length === 0) continue;
    const built = await Promise.all(
      rawSorted.map((r) =>
        buildParentReportCardPreviewData(supabase, {
          parentUserId: user.id,
          studentId: sid,
          term: r.term,
          academicYear: r.academic_year,
        })
      )
    );
    for (let i = 0; i < rawSorted.length; i++) {
      const row = rawSorted[i]!;
      const b = built[i]!;
      if (b.ok) {
        entry.reportCards.push({
          id: row.id,
          term: row.term,
          academic_year: row.academic_year,
          status: row.status,
          previewData: b.data,
        });
      }
    }
  }

  for (const a of (attRes.data ?? []) as {
    id: string;
    student_id: string;
    attendance_date: string;
    status: "present" | "absent" | "late";
    subject_id: string | null;
    created_at: string;
    subjects: { name: string } | null;
  }[]) {
    if (!allowed.has(a.student_id)) continue;
    const entry = byStudent.get(a.student_id);
    if (!entry) continue;
    const subjectName = a.subjects?.name?.trim()
      ? a.subjects.name.trim()
      : a.subject_id
        ? "Subject"
        : "Class (general)";
    entry.attendance.push({
      id: a.id,
      attendance_date: a.attendance_date,
      status: a.status,
      subjectName,
      subject_id: a.subject_id,
      recordedAt: a.created_at ?? null,
    });
  }

  for (const sid of studentIds) {
    if (!allowed.has(sid)) continue;
    const entry = byStudent.get(sid);
    if (!entry) continue;
    entry.attendance.sort((x, y) => {
      if (x.attendance_date !== y.attendance_date) {
        return x.attendance_date < y.attendance_date ? 1 : -1;
      }
      return x.subjectName.localeCompare(y.subjectName, undefined, {
        sensitivity: "base",
      });
    });
  }

  /* Gradebook + class reports: service role (not readable by parent via RLS). */
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  if (admin) {
    for (const s of students) {
      if (!allowed.has(s.id)) continue;
      const entry = byStudent.get(s.id);
      if (!entry) continue;
      const periods = await loadParentPublishedClassResultPeriods(admin, {
        studentClassId: s.class_id,
      });
      entry.classResultSheets = periods;
      const classResultSubjects = await listParentClassResultSubjects(
        s.class_id
      );
      entry.classResultSubjects = classResultSubjects;
      entry.majorExamClassResults =
        classResultSubjects.length > 0
          ? await loadParentMajorExamClassResults(
              s.class_id,
              classResultSubjects[0]!
            )
          : { options: [], defaultOptionId: "" };
    }
  }

  return byStudent;
}
