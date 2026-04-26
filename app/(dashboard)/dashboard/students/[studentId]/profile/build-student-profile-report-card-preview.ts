import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  mergeReportCardCommentsWithGradebookForParent,
  resolveCoordinatorSignatureUrlForClassCluster,
} from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  buildSubjectPreviewRows,
  computeReportCardStudentSummary,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type {
  ReportCardStatus,
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import {
  loadClassReportCardCohortForDashboard,
  loadSubjectPositionsForClassReportCard,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/queries";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import {
  loadReportCardSupplementaryBatch,
  mergeSupplementaryForPreview,
} from "@/lib/report-card-supplementary";
import { normalizeSchoolLevel } from "@/lib/school-level";

function statusLabelForReportCardPreview(status: string): string {
  switch (status) {
    case "approved":
      return "Approved — may be printed and shared.";
    case "pending_review":
      return "Pending review — awaiting head teacher approval.";
    case "changes_requested":
      return "Head teacher requested changes — your school is updating this report card.";
    case "draft":
      return "Draft — not yet submitted for review.";
    default:
      return "Report card";
  }
}

async function loadTeacherLineForReport(
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
 * Full {@link ReportCardPreview} payload for a student profile viewer — same
 * data shape as the parent and coordinator preview (including stamp,
 * signatures, supplementary text, and calendar).
 */
export async function buildStudentProfileReportCardPreviewData(params: {
  studentId: string;
  reportCardId: string;
}): Promise<
  | {
      ok: true;
      data: ReportCardPreviewData;
      status: string;
      reportCardId: string;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: rc, error: rcErr } = await admin
    .from("report_cards")
    .select(
      `
      id,
      status,
      term,
      academic_year,
      class_id,
      school_id,
      teacher_id,
      submitted_at,
      updated_at,
      approved_at,
      students ( full_name ),
      classes ( name ),
      schools ( name, logo_url, motto, school_stamp_url, head_teacher_signature_url )
    `
    )
    .eq("id", params.reportCardId)
    .eq("student_id", params.studentId)
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
    school_id: string;
    teacher_id: string;
    submitted_at: string | null;
    updated_at: string;
    approved_at: string | null;
    students: { full_name: string } | null;
    classes: { name: string } | null;
    schools: {
      name: string;
      logo_url: string | null;
      motto: string | null;
      school_stamp_url: string | null;
      head_teacher_signature_url: string | null;
    } | null;
  };

  const term = row.term.trim();
  const academicYear = row.academic_year.trim();

  const commentRows = await mergeReportCardCommentsWithGradebookForParent({
    reportCardId: row.id,
    studentId: params.studentId,
    classId: row.class_id,
    academicYear: row.academic_year,
    term: row.term,
  });

  const subjectOrder = [...new Set(commentRows.map((c) => c.subject))].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const stForRow: ReportCardStatus =
    row.status === "draft" ||
    row.status === "pending_review" ||
    row.status === "approved" ||
    row.status === "changes_requested"
      ? row.status
      : "draft";

  const syntheticStudent: StudentReportRow = {
    studentId: params.studentId,
    fullName: row.students?.full_name ?? "—",
    parentEmail: null,
    reportCardId: row.id,
    status: stForRow,
    comments: commentRows,
  };

  const positionBySubject = await loadSubjectPositionsForClassReportCard({
    focusStudentId: params.studentId,
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });

  const cohortInfo = await loadClassReportCardCohortForDashboard({
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });
  const schoolLevel = normalizeSchoolLevel(cohortInfo.schoolLevel);
  const cohortStudents = (() => {
    const list = cohortInfo.cohort;
    return list.some((s) => s.studentId === params.studentId)
      ? list
      : [...list, syntheticStudent];
  })();
  const cohortSubjects =
    cohortInfo.subjects.length > 0 ? cohortInfo.subjects : subjectOrder;
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
  const { data: attRowsRaw } = await admin
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
    await loadTeacherLineForReport(row.class_id, row.teacher_id);

  const issuedAt =
    row.submitted_at ?? row.approved_at ?? row.updated_at ?? new Date().toISOString();
  const dateIssued = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(issuedAt));

  const mottoTrim = (row.schools?.motto ?? "").trim();

  let coordinatorSignatureUrl: string | null = null;
  try {
    const cluster = await resolveClassCluster(admin, row.class_id);
    const clusterIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [row.class_id];
    coordinatorSignatureUrl = await resolveCoordinatorSignatureUrlForClassCluster(
      admin,
      clusterIds,
      row.teacher_id
    );
  } catch {
    coordinatorSignatureUrl = null;
  }

  let data: ReportCardPreviewData = {
    schoolName: row.schools?.name ?? "School",
    schoolMotto: mottoTrim ? mottoTrim : null,
    logoUrl: row.schools?.logo_url ?? null,
    schoolStampUrl: row.schools?.school_stamp_url?.trim() || null,
    headTeacherSignatureUrl:
      row.schools?.head_teacher_signature_url?.trim() || null,
    coordinatorSignatureUrl,
    studentName: row.students?.full_name ?? "—",
    className: row.classes?.name ?? "—",
    term: row.term,
    academicYear: row.academic_year,
    teacherName,
    teacherIsCoordinator,
    dateIssued,
    statusLabel: statusLabelForReportCardPreview(row.status),
    subjects,
    attendance: {
      present,
      absent,
      late,
      daysInTermLabel: "this term (from school calendar)",
    },
    summary,
  };

  try {
    const cluster = await resolveClassCluster(admin, row.class_id);
    const { shared, feeByStudentId } = await loadReportCardSupplementaryBatch(
      admin,
      {
        settingsClassId: cluster.rootClassId,
        schoolId: row.school_id,
        term: row.term,
        academicYear: row.academic_year,
        studentIds: [params.studentId],
      }
    );
    data = {
      ...data,
      ...mergeSupplementaryForPreview(
        shared,
        feeByStudentId.get(params.studentId) ?? null
      ),
    };
  } catch {
    // keep card without supplementary
  }

  return {
    ok: true,
    data,
    status: row.status,
    reportCardId: row.id,
  };
}
