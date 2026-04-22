import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildSubjectPreviewRows,
  computeReportCardStudentSummary,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import {
  loadParentReportCardCohort,
  loadSubjectPositionsForParentReportCard,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/queries";
import { normalizeSchoolLevel } from "@/lib/school-level";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type {
  ReportCardCommentRow,
  ReportCardStatus,
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import { mergeReportCardCommentsWithGradebookForParent } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";

const PARENT_VISIBLE: ReportCardStatus[] = ["pending_review", "approved"];

function isParentVisibleStatus(s: string): s is ReportCardStatus {
  return (PARENT_VISIBLE as string[]).includes(s);
}

function bannerLabelForParent(status: string): string {
  switch (status) {
    case "approved":
      return "Approved — may be printed and shared.";
    case "pending_review":
      return "Pending review — awaiting head teacher approval.";
    case "changes_requested":
      return "Head teacher requested changes — your school is updating this report card.";
    default:
      return "Report card";
  }
}

async function loadTeacherLineForParentReport(
  classId: string,
  teacherId: string
): Promise<{ name: string; isCoordinator: boolean }> {
  try {
    const admin = createAdminClient();
    const [profRes, coordRes] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", teacherId).maybeSingle(),
      admin
        .from("teacher_coordinators")
        .select("id")
        .eq("class_id", classId)
        .eq("teacher_id", teacherId)
        .maybeSingle(),
    ]);
    const fullName = (profRes.data as { full_name?: string | null } | null)
      ?.full_name;
    const name =
      typeof fullName === "string" && fullName.trim().length > 0
        ? fullName.trim()
        : "—";
    return { name, isCoordinator: !!coordRes.data };
  } catch {
    return { name: "—", isCoordinator: false };
  }
}

/**
 * Builds the same {@link ReportCardPreview} payload the coordinator page uses,
 * for a parent linked to the student. Allows pending_review and approved.
 */
export async function buildParentReportCardPreviewData(
  supabase: SupabaseClient,
  params: {
    parentUserId: string;
    studentId: string;
    term: string;
    academicYear: string;
  }
): Promise<
  | {
      ok: true;
      data: ReportCardPreviewData;
      status: string;
      reportCardId: string;
    }
  | { ok: false; error: string }
> {
  const term = params.term.trim();
  const academicYear = params.academicYear.trim();

  const { data: link } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", params.parentUserId)
    .eq("student_id", params.studentId)
    .maybeSingle();

  if (!link) {
    return { ok: false, error: "not_linked" };
  }

  const { data: rc, error: rcErr } = await supabase
    .from("report_cards")
    .select(
      `
      id,
      status,
      term,
      academic_year,
      class_id,
      teacher_id,
      submitted_at,
      updated_at,
      approved_at,
      students ( full_name ),
      classes ( name ),
      schools ( name, logo_url, motto )
    `
    )
    .eq("student_id", params.studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (rcErr || !rc) {
    return { ok: false, error: "not_found" };
  }

  const row = rc as unknown as {
    id: string;
    status: string;
    term: string;
    academic_year: string;
    class_id: string;
    teacher_id: string;
    submitted_at: string | null;
    updated_at: string;
    approved_at: string | null;
    students: { full_name: string } | null;
    classes: { name: string } | null;
    schools: { name: string; logo_url: string | null; motto: string | null } | null;
  };

  if (!isParentVisibleStatus(row.status)) {
    return { ok: false, error: "not_shared" };
  }

  const commentRows = await mergeReportCardCommentsWithGradebookForParent({
    reportCardId: row.id,
    studentId: params.studentId,
    classId: row.class_id,
    academicYear: row.academic_year,
    term: row.term,
  });

  const subjectOrder = [...new Set(commentRows.map((c) => c.subject))].sort(
    (a, b) => a.localeCompare(b)
  );

  const stForRow: ReportCardStatus = isParentVisibleStatus(row.status)
    ? row.status
    : "approved";

  const syntheticStudent: StudentReportRow = {
    studentId: params.studentId,
    fullName: row.students?.full_name ?? "—",
    parentEmail: null,
    reportCardId: row.id,
    status: stForRow,
    comments: commentRows,
  };

  const positionBySubject = await loadSubjectPositionsForParentReportCard({
    parentUserId: params.parentUserId,
    focusStudentId: params.studentId,
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });

  const cohortInfo = await loadParentReportCardCohort({
    parentUserId: params.parentUserId,
    focusStudentId: params.studentId,
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });
  const schoolLevel = normalizeSchoolLevel(cohortInfo?.schoolLevel);
  const cohortStudents = (() => {
    const list = cohortInfo?.cohort ?? [];
    return list.some((s) => s.studentId === params.studentId)
      ? list
      : [...list, syntheticStudent];
  })();
  const cohortSubjects =
    cohortInfo?.subjects && cohortInfo.subjects.length > 0
      ? cohortInfo.subjects
      : subjectOrder;
  const summary = computeReportCardStudentSummary({
    allStudents: cohortStudents,
    subjects: cohortSubjects,
    focusStudentId: params.studentId,
    schoolLevel,
    studentName: row.students?.full_name ?? "",
    term: row.term,
    academicYear: row.academic_year,
  });

  const subjects: ReportCardPreviewData["subjects"] = buildSubjectPreviewRows(
    row.term,
    subjectOrder,
    syntheticStudent,
    positionBySubject,
    summary.selectedSubjects,
    schoolLevel
  );

  const { start, end } = termDateRange(term, academicYear);
  const { data: attRowsRaw } = await supabase
    .from("teacher_attendance")
    .select("status, attendance_date, subject_id")
    .eq("student_id", params.studentId)
    .eq("class_id", row.class_id)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  const attRows = dedupeTeacherAttendanceByStudentAndDate(
    (attRowsRaw ?? []).map((a) => ({
      student_id: params.studentId,
      attendance_date: (a as { attendance_date: string }).attendance_date,
      subject_id: (a as { subject_id: string | null }).subject_id ?? null,
      status: (a as { status: string }).status,
    }))
  );

  let present = 0;
  let absent = 0;
  let late = 0;
  for (const a of attRows) {
    const st = a.status;
    if (st === "present") present += 1;
    else if (st === "absent") absent += 1;
    else if (st === "late") late += 1;
  }

  const { name: teacherName, isCoordinator: teacherIsCoordinator } =
    await loadTeacherLineForParentReport(row.class_id, row.teacher_id);

  const issuedAt =
    row.submitted_at ?? row.approved_at ?? row.updated_at ?? new Date().toISOString();
  const dateIssued = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(issuedAt));

  const mottoTrim = (row.schools?.motto ?? "").trim();
  const data: ReportCardPreviewData = {
    schoolName: row.schools?.name ?? "School",
    schoolMotto: mottoTrim ? mottoTrim : null,
    logoUrl: row.schools?.logo_url ?? null,
    studentName: row.students?.full_name ?? "—",
    className: row.classes?.name ?? "—",
    term: row.term,
    academicYear: row.academic_year,
    teacherName,
    teacherIsCoordinator,
    dateIssued,
    statusLabel: bannerLabelForParent(row.status),
    subjects,
    attendance: {
      present,
      absent,
      late,
      daysInTermLabel: "this term (from school calendar)",
    },
    summary,
  };

  return {
    ok: true,
    data,
    status: row.status,
    reportCardId: row.id,
  };
}
