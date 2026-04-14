import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
import { buildSubjectPreviewRows } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type {
  ReportCardCommentRow,
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";

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

  const { data: comments } = await supabase
    .from("teacher_report_card_comments")
    .select(
      "id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade"
    )
    .eq("report_card_id", row.id);

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

  const subjects: ReportCardPreviewData["subjects"] = buildSubjectPreviewRows(
    row.term,
    subjectOrder,
    syntheticStudent
  );

  const { start, end } = termDateRange(term, academicYear);
  const { data: attRows } = await supabase
    .from("teacher_attendance")
    .select("status")
    .eq("student_id", studentId)
    .eq("class_id", row.class_id)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  let present = 0;
  let absent = 0;
  let late = 0;
  for (const a of attRows ?? []) {
    const st = (a as { status: string }).status;
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
