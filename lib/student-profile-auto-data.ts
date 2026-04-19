import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { tanzaniaLetterGrade, tanzaniaPercentFromScore } from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";

type TeacherScorePick = Pick<
  Database["public"]["Tables"]["teacher_scores"]["Row"],
  "id" | "assignment_id" | "score"
>;
type GradebookAssignmentPick = Pick<
  Database["public"]["Tables"]["teacher_gradebook_assignments"]["Row"],
  "id" | "title" | "max_score" | "subject" | "term" | "academic_year" | "class_id"
>;
type ReportCardPick = Pick<
  Database["public"]["Tables"]["report_cards"]["Row"],
  "id" | "term" | "academic_year" | "status" | "submitted_at" | "admin_note"
>;
type ReportCommentPick = Pick<
  Database["public"]["Tables"]["teacher_report_card_comments"]["Row"],
  | "report_card_id"
  | "subject"
  | "comment"
  | "letter_grade"
  | "calculated_grade"
  | "score_percent"
>;
type PaymentWithReceipt = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "id" | "amount" | "payment_date" | "reference_number"
> & {
  receipt: { receipt_number: string } | null;
};
import {
  getCurrentAcademicYearAndTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

export interface ProfileGradebookScoreRow {
  id: string;
  subject: string;
  assignmentTitle: string;
  scoreDisplay: string;
  grade: string;
  termLabel: string;
}

export interface ProfileAttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  termLabel: string;
}

export interface ProfileReportCardSubjectLine {
  subject: string;
  comment: string | null;
  letterGrade: string | null;
  calculatedGrade: string | null;
  scorePercent: number | null;
}

export interface ProfileReportCardBlock {
  id: string;
  term: string;
  academicYear: string;
  status: string;
  submittedAt: string | null;
  adminNote: string | null;
  subjectLines: ProfileReportCardSubjectLine[];
}

export interface ProfilePaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  receipt_number: string | null;
  reference_number: string | null;
}

export function attendanceDateInCurrentSchoolTerm(
  attendanceDateIso: string,
  academicYear: number,
  term: SubjectEnrollmentTerm
): boolean {
  const raw = attendanceDateIso.includes("T")
    ? attendanceDateIso
    : `${attendanceDateIso}T12:00:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (term === "Term 2") {
    return y === academicYear && m >= 9 && m <= 12;
  }
  return y === academicYear && m >= 1 && m <= 8;
}

/** One calendar day → strongest status seen that day (present > late > absent). */
function summarizeAttendanceDays(
  rows: { attendance_date: string; status: "present" | "absent" | "late" }[],
  academicYear: number,
  term: SubjectEnrollmentTerm
): Pick<ProfileAttendanceSummary, "presentDays" | "absentDays" | "lateDays"> {
  const dayRank = new Map<string, number>();
  const rankFor = (s: "present" | "absent" | "late") =>
    s === "present" ? 2 : s === "late" ? 1 : 0;

  for (const r of rows) {
    if (!attendanceDateInCurrentSchoolTerm(r.attendance_date, academicYear, term)) {
      continue;
    }
    const day = r.attendance_date.slice(0, 10);
    const next = rankFor(r.status);
    dayRank.set(day, Math.max(dayRank.get(day) ?? -1, next));
  }

  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  for (const r of dayRank.values()) {
    if (r === 2) presentDays++;
    else if (r === 1) lateDays++;
    else if (r === 0) absentDays++;
  }
  return { presentDays, absentDays, lateDays };
}

/**
 * Loads gradebook scores for a student (all subjects / terms on record).
 * Uses a service-role Supabase client so reads match the teacher Marks UI
 * (which bypasses RLS via the admin client). Caller must enforce auth.
 *
 * Rows are limited to assignments whose class belongs to `studentSchoolId`.
 */
export async function loadProfileGradebookScores(
  admin: SupabaseClient<Database>,
  studentId: string,
  studentSchoolId: string,
  /**
   * School grading tier the student belongs to. Drives the letter band
   * (A–E for primary, A–F for secondary). Defaults to "secondary" so legacy
   * callers keep their existing behaviour. Pass the value resolved via
   * `normalizeSchoolLevel(school.school_level)`.
   */
  schoolLevel: SchoolLevel = "secondary"
): Promise<ProfileGradebookScoreRow[]> {
  const { data: scoresRaw, error } = await admin
    .from("teacher_scores")
    .select("id, assignment_id, score")
    .eq("student_id", studentId);
  const scores = scoresRaw as TeacherScorePick[] | null;
  if (error || !scores?.length) return [];

  const assignmentIds = [...new Set(scores.map((s) => s.assignment_id))];
  const { data: assignsRaw, error: aErr } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, max_score, subject, term, academic_year, class_id")
    .in("id", assignmentIds);
  const assigns = assignsRaw as GradebookAssignmentPick[] | null;
  if (aErr || !assigns?.length) return [];

  const classIds = [...new Set(assigns.map((a) => a.class_id))];
  const { data: classRowsRaw } = await admin
    .from("classes")
    .select("id, school_id")
    .in("id", classIds);
  const allowedClassIds = new Set(
    (classRowsRaw ?? [])
      .filter(
        (c) =>
          (c as { id: string; school_id: string }).school_id ===
          studentSchoolId
      )
      .map((c) => (c as { id: string }).id)
  );

  const byId = new Map(
    assigns
      .filter((a) => allowedClassIds.has(a.class_id))
      .map((a) => [a.id, a])
  );
  const rows: ProfileGradebookScoreRow[] = [];

  for (const s of scores) {
    const a = byId.get(s.assignment_id);
    if (!a) continue;
    const max = Number(a.max_score);
    const score = s.score;
    const pct =
      score != null && Number.isFinite(max)
        ? tanzaniaPercentFromScore(score, max)
        : null;
    const grade = tanzaniaLetterGrade(pct, schoolLevel);
    const scoreDisplay =
      score != null && Number.isFinite(max) ? `${score}/${max}` : "—";
    const termPart = a.term ?? "—";
    const yearPart = a.academic_year ?? "—";
    rows.push({
      id: s.id,
      subject: a.subject?.trim() || "—",
      assignmentTitle: a.title?.trim() || "—",
      scoreDisplay,
      grade,
      termLabel: `${termPart} · ${yearPart}`,
    });
  }

  rows.sort((x, y) => {
    const ta = x.termLabel.localeCompare(y.termLabel);
    if (ta !== 0) return ta;
    const sb = x.subject.localeCompare(y.subject);
    if (sb !== 0) return sb;
    return x.assignmentTitle.localeCompare(y.assignmentTitle);
  });
  return rows;
}

/** @alias loadProfileGradebookScores — same implementation. */
export const loadStudentScores = loadProfileGradebookScores;

export async function loadProfileAttendanceSummary(
  supabase: SupabaseClient<Database>,
  studentId: string,
  classId: string | null
): Promise<ProfileAttendanceSummary> {
  const { academicYear, term } = getCurrentAcademicYearAndTerm();
  const termLabel = `${term} · ${academicYear}`;

  if (!classId) {
    return { presentDays: 0, absentDays: 0, lateDays: 0, termLabel };
  }

  const { data: rows, error } = await supabase
    .from("teacher_attendance")
    .select("attendance_date, status")
    .eq("student_id", studentId)
    .eq("class_id", classId);

  if (error || !rows?.length) {
    return { presentDays: 0, absentDays: 0, lateDays: 0, termLabel };
  }

  const { presentDays, absentDays, lateDays } = summarizeAttendanceDays(
    rows as { attendance_date: string; status: "present" | "absent" | "late" }[],
    academicYear,
    term
  );
  return { presentDays, absentDays, lateDays, termLabel };
}

function reportCardSortKey(academicYear: string, term: string): number {
  const y = parseInt(academicYear, 10);
  const yearNum = Number.isFinite(y) ? y : 0;
  const termNum = term === "Term 2" ? 2 : term === "Term 1" ? 1 : 0;
  return yearNum * 10 + termNum;
}

export async function loadProfileReportCards(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<ProfileReportCardBlock[]> {
  const { data: cardsRaw, error } = await supabase
    .from("report_cards")
    .select(
      "id, term, academic_year, status, submitted_at, admin_note"
    )
    .eq("student_id", studentId)
    .order("academic_year", { ascending: false });

  const cards = cardsRaw as ReportCardPick[] | null;
  if (error || !cards?.length) return [];

  const cardIds = cards.map((c) => c.id);
  const { data: commentsRaw, error: cErr } = await supabase
    .from("teacher_report_card_comments")
    .select(
      "report_card_id, subject, comment, letter_grade, calculated_grade, score_percent"
    )
    .eq("student_id", studentId)
    .in("report_card_id", cardIds);

  const comments = commentsRaw as ReportCommentPick[] | null;

  if (cErr) {
    return cards.map((c) => ({
      id: c.id,
      term: c.term,
      academicYear: c.academic_year,
      status: c.status,
      submittedAt: c.submitted_at,
      adminNote: c.admin_note,
      subjectLines: [],
    }));
  }

  const byCard = new Map<string, ProfileReportCardSubjectLine[]>();
  for (const row of comments ?? []) {
    const list = byCard.get(row.report_card_id) ?? [];
    list.push({
      subject: row.subject?.trim() || "—",
      comment: row.comment,
      letterGrade: row.letter_grade,
      calculatedGrade: row.calculated_grade,
      scorePercent: row.score_percent,
    });
    byCard.set(row.report_card_id, list);
  }

  const blocks: ProfileReportCardBlock[] = cards.map((c) => ({
    id: c.id,
    term: c.term,
    academicYear: c.academic_year,
    status: c.status,
    submittedAt: c.submitted_at,
    adminNote: c.admin_note,
    subjectLines: (byCard.get(c.id) ?? []).sort((a, b) =>
      a.subject.localeCompare(b.subject)
    ),
  }));

  blocks.sort(
    (a, b) =>
      reportCardSortKey(b.academicYear, b.term) -
      reportCardSortKey(a.academicYear, a.term)
  );
  return blocks;
}

export async function loadProfilePayments(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<ProfilePaymentRow[]> {
  const { data: dataRaw, error } = await supabase
    .from("payments")
    .select(
      "id, amount, payment_date, reference_number, receipt:receipts(receipt_number)"
    )
    .eq("student_id", studentId)
    .order("payment_date", { ascending: false });

  const data = dataRaw as PaymentWithReceipt[] | null;
  if (error || !data) return [];

  return data.map((p) => {
    const receipt = p.receipt;
    return {
      id: p.id,
      amount: Number(p.amount),
      payment_date: p.payment_date,
      receipt_number: receipt?.receipt_number ?? null,
      reference_number: p.reference_number,
    };
  });
}

export async function loadProfileFeeBalances(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<Database["public"]["Views"]["student_fee_balances"]["Row"][]> {
  const { data: dataRaw, error } = await supabase
    .from("student_fee_balances")
    .select("*")
    .eq("student_id", studentId);
  if (error || !dataRaw) return [];
  return dataRaw as Database["public"]["Views"]["student_fee_balances"]["Row"][];
}
