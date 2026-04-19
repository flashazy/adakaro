import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
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
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";

export const metadata = {
  title: "Report card — Parent",
};

export default async function ParentReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    term?: string;
    year?: string;
  }>;
}) {
  const sp = await searchParams;
  const studentId = sp.studentId?.trim();
  const term = sp.term?.trim() ?? "Term 1";
  const academicYear = sp.year?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!studentId || !academicYear) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Report card
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Open the link from your email, or ask the school to send it again. A
          student, term, and academic year are required.
        </p>
      </div>
    );
  }

  const { data: link } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!link) {
    return (
      <p className="text-sm text-red-600">
        You do not have access to this student&apos;s report card.
      </p>
    );
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
      students ( full_name ),
      classes ( name ),
      schools ( name, logo_url )
    `
    )
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (rcErr || !rc) {
    return (
      <p className="text-sm text-slate-600">
        No report card found for this term and year.
      </p>
    );
  }

  const row = rc as unknown as {
    id: string;
    status: string;
    term: string;
    academic_year: string;
    class_id: string;
    students: { full_name: string } | null;
    classes: { name: string } | null;
    schools: { name: string; logo_url: string | null } | null;
  };

  if (row.status !== "approved") {
    return (
      <p className="text-sm text-slate-600">
        This report card is not yet approved for sharing. Please check back
        later.
      </p>
    );
  }

  // `position` (migration 00085) may not exist on older deployments; the
  // fallback select keeps parents able to view the report card.
  let comments: unknown[] | null = null;
  {
    const baseCols =
      "id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden";
    const fullCols = `${baseCols}, position`;
    let res = await supabase
      .from("teacher_report_card_comments")
      .select(fullCols)
      .eq("report_card_id", row.id);
    if (res.error && /column.*position/i.test(res.error.message ?? "")) {
      res = await supabase
        .from("teacher_report_card_comments")
        .select(baseCols)
        .eq("report_card_id", row.id);
    }
    comments = (res.data as unknown[] | null) ?? null;
  }

  const parseNum = (v: unknown): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const commentRows: ReportCardCommentRow[] = (comments ?? []).map((raw) => {
    const r = raw as {
      id: string;
      subject: string;
      comment: string | null;
      score_percent: number | string | null;
      letter_grade: string | null;
      exam1_score: number | string | null;
      exam2_score: number | string | null;
      calculated_score: number | string | null;
      calculated_grade: string | null;
      exam1_gradebook_original?: number | string | null;
      exam2_gradebook_original?: number | string | null;
      exam1_score_overridden?: boolean | null;
      exam2_score_overridden?: boolean | null;
      position?: number | string | null;
    };
    return {
      id: r.id,
      subject: r.subject,
      comment: r.comment,
      scorePercent: parseNum(r.score_percent),
      letterGrade: r.letter_grade,
      exam1Score: parseNum(r.exam1_score),
      exam2Score: parseNum(r.exam2_score),
      calculatedScore: parseNum(r.calculated_score),
      calculatedGrade: r.calculated_grade,
      exam1GradebookOriginal: parseNum(r.exam1_gradebook_original),
      exam2GradebookOriginal: parseNum(r.exam2_gradebook_original),
      exam1ScoreOverridden: r.exam1_score_overridden === true,
      exam2ScoreOverridden: r.exam2_score_overridden === true,
      position: parseNum(r.position),
    };
  });

  const subjectOrder = [...new Set(commentRows.map((c) => c.subject))].sort(
    (a, b) => a.localeCompare(b)
  );

  const syntheticStudent: StudentReportRow = {
    studentId,
    fullName: row.students?.full_name ?? "—",
    parentEmail: null,
    reportCardId: row.id,
    status: "approved",
    comments: commentRows,
  };

  const positionBySubject = await loadSubjectPositionsForParentReportCard({
    parentUserId: user.id,
    focusStudentId: studentId,
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });

  // Footer summary needs the cohort to compute "X out of Y students" and the
  // school level to decide between average % vs. total marks phrasing.
  const cohortInfo = await loadParentReportCardCohort({
    parentUserId: user.id,
    focusStudentId: studentId,
    classId: row.class_id,
    term: row.term,
    academicYear: row.academic_year,
  });
  const schoolLevel = normalizeSchoolLevel(cohortInfo?.schoolLevel);
  // Make sure the focus student is part of the cohort even if their card is
  // approved but not picked up by the cohort query (defensive).
  const cohortStudents = (() => {
    const list = cohortInfo?.cohort ?? [];
    return list.some((s) => s.studentId === studentId)
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
    focusStudentId: studentId,
    schoolLevel,
    studentName: row.students?.full_name ?? "",
    term: row.term,
    academicYear: row.academic_year,
  });

  // Built after the summary so we can pass `selectedSubjects` into the row
  // builder for the ✅ "Selected" indicator (only set when something was
  // actually dropped from the best-N selection).
  const subjects: ReportCardPreviewData["subjects"] = buildSubjectPreviewRows(
    row.term,
    subjectOrder,
    syntheticStudent,
    positionBySubject,
    summary.selectedSubjects
  );

  const { start, end } = termDateRange(term, academicYear);
  const { data: attRowsRaw } = await supabase
    .from("teacher_attendance")
    .select("status, attendance_date, subject_id")
    .eq("student_id", studentId)
    .eq("class_id", row.class_id)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  const attRows = dedupeTeacherAttendanceByStudentAndDate(
    (attRowsRaw ?? []).map((a) => ({
      student_id: studentId,
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

  const data: ReportCardPreviewData = {
    schoolName: row.schools?.name ?? "School",
    logoUrl: row.schools?.logo_url ?? null,
    studentName: row.students?.full_name ?? "—",
    className: row.classes?.name ?? "—",
    term: row.term,
    academicYear: row.academic_year,
    teacherName: "—",
    dateIssued: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
    }).format(new Date()),
    statusLabel: "Approved — official report card.",
    subjects,
    attendance: {
      present,
      absent,
      late,
      daysInTermLabel: "this term (from school calendar)",
    },
    summary,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
        Report card
      </h1>
      <ReportCardPreview data={data} />
    </div>
  );
}
