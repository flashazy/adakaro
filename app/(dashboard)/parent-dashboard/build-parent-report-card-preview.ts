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
  ReportCardStatus,
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import {
  emptyAttendanceRollup,
  tallyAttendanceByStudent,
} from "@/lib/attendance-counts";
import { isStudentHealthAttendanceStatus } from "@/lib/student-attendance-status";
import {
  mergeReportCardCommentsWithGradebookForParent,
  resolveCoordinatorSignatureUrlForClassCluster,
} from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import {
  calendarDateKey,
  isCalendarDateOnOrAfter,
  reportCardIsOnOrAfterEnrollment,
} from "@/lib/parent-academic-from-enrollment";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  loadReportCardSupplementaryBatch,
  mergeSupplementaryForPreview,
} from "@/lib/report-card-supplementary";
import { checkParentReportEligibility } from "@/lib/report-card-fee/eligibility";
import type { ParentReportEligibilityResult } from "@/lib/report-card-fee/types";

const PARENT_VISIBLE: ReportCardStatus[] = ["approved"];

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
 * for a parent linked to the student. Only `approved` (released by coordinator / school).
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
  | { ok: false; error: "fee_blocked"; eligibility: ParentReportEligibilityResult }
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
      created_at,
      students ( full_name ),
      classes ( name ),
      schools ( name, logo_url, motto, school_stamp_url, head_teacher_signature_url )
    `
    )
    .eq("student_id", params.studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .eq("status", "approved")
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
    created_at: string;
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

  if (!isParentVisibleStatus(row.status)) {
    return { ok: false, error: "not_shared" };
  }

  const feeEligibility = await checkParentReportEligibility(
    params.studentId,
    row.class_id,
    undefined,
    {
      academicYear: row.academic_year,
      term: row.term,
      sendMonth: new Date().getMonth() + 1,
    }
  );
  if (!feeEligibility.eligible) {
    return {
      ok: false,
      error: "fee_blocked",
      eligibility: feeEligibility,
    };
  }

  const { data: stRow } = await supabase
    .from("students")
    .select("enrollment_date")
    .eq("id", params.studentId)
    .maybeSingle();
  const enrollmentDate =
    (stRow as { enrollment_date?: string | null } | null)?.enrollment_date ??
    null;
  if (
    !reportCardIsOnOrAfterEnrollment(
      {
        approved_at: row.approved_at,
        updated_at: row.updated_at,
        created_at: row.created_at,
      },
      enrollmentDate
    )
  ) {
    return { ok: false, error: "before_enrollment" };
  }

  const commentRows = await mergeReportCardCommentsWithGradebookForParent({
    reportCardId: row.id,
    studentId: params.studentId,
    classId: row.class_id,
    academicYear: row.academic_year,
    term: row.term,
    enrollmentDate,
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

  const attDeduped = dedupeTeacherAttendanceByStudentAndDate(
    (attRowsRaw ?? []).map((a) => ({
      student_id: params.studentId,
      attendance_date: (a as { attendance_date: string }).attendance_date,
      subject_id: (a as { subject_id: string | null }).subject_id ?? null,
      status: (a as { status: string }).status,
    }))
  );
  const enrollBoundary = calendarDateKey(enrollmentDate ?? undefined);
  const attRows =
    enrollBoundary != null
      ? attDeduped.filter((a) =>
          isCalendarDateOnOrAfter(
            calendarDateKey(a.attendance_date),
            enrollBoundary
          )
        )
      : attDeduped;

  const healthByStudent: Record<
    string,
    { status: "ill" | "permitted"; marked_at: string }
  > = {};
  const adminForHealth = createAdminClient();
  const { data: healthRow } = await adminForHealth
    .from("student_attendance_status")
    .select("status, marked_at")
    .eq("student_id", params.studentId)
    .maybeSingle();
  if (
    healthRow &&
    isStudentHealthAttendanceStatus(
      (healthRow as { status: string }).status
    )
  ) {
    healthByStudent[params.studentId] = {
      status: (healthRow as { status: "ill" | "permitted" }).status,
      marked_at: (healthRow as { marked_at: string }).marked_at,
    };
  }

  const attendanceRollup =
    tallyAttendanceByStudent(
      attRows.map((a) => ({
        student_id: a.student_id,
        status: a.status,
        attendance_date: a.attendance_date,
      })),
      healthByStudent
    )[params.studentId] ?? emptyAttendanceRollup();

  const { name: teacherName, isCoordinator: teacherIsCoordinator } =
    await loadTeacherLineForParentReport(row.class_id, row.teacher_id);

  const issuedAt =
    row.submitted_at ?? row.approved_at ?? row.updated_at ?? new Date().toISOString();
  const dateIssued = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(issuedAt));

  const mottoTrim = (row.schools?.motto ?? "").trim();

  let coordinatorSignatureUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const cluster = await resolveClassCluster(admin, row.class_id);
    const clusterIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [row.class_id];
    coordinatorSignatureUrl =
      await resolveCoordinatorSignatureUrlForClassCluster(
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
    statusLabel: bannerLabelForParent(row.status),
    subjects,
    attendance: {
      present: attendanceRollup.present,
      absent: attendanceRollup.absent,
      late: attendanceRollup.late,
      ill: attendanceRollup.ill,
      permitted: attendanceRollup.permitted,
      daysInTermLabel: "this term (from school calendar)",
    },
    summary,
  };

  try {
    const admin = createAdminClient();
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
    // Keep card without supplementary blocks if settings table is unavailable.
  }

  return {
    ok: true,
    data,
    status: row.status,
    reportCardId: row.id,
  };
}
