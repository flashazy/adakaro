import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeReportCardCommentsWithGradebookForParent } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import {
  buildSubjectPreviewRows,
  reportCardExamColumnTitles,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import type {
  ReportCardStatus,
  StudentReportRow,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-types";
import { formatPaymentRecorderLine } from "@/lib/payment-recorder-label";
import type { SchoolLevel } from "@/lib/school-level";
import {
  getCurrentAcademicYearAndTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { tanzaniaLetterGrade, tanzaniaPercentFromScore } from "@/lib/tanzania-grades";
import type { Database, UserRole } from "@/types/supabase";

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
  | "id"
  | "class_id"
  | "term"
  | "academic_year"
  | "status"
  | "submitted_at"
  | "admin_note"
>;
type PaymentWithReceipt = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "id" | "amount" | "reference_number" | "recorded_at" | "recorded_by_id"
> & {
  receipt: { receipt_number: string } | null;
};

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

/**
 * Aligned with parent report card rows: merged DB comments + major-exam
 * gradebook scores, same formatting as `buildSubjectPreviewRows`.
 */
export interface ProfileReportCardSubjectLine {
  subject: string;
  exam1Pct: string;
  exam2Pct: string;
  averagePct: string;
  grade: string;
  /** Display; "—" when empty. */
  comment: string;
}

export interface ProfileReportCardBlock {
  id: string;
  term: string;
  academicYear: string;
  status: string;
  submittedAt: string | null;
  adminNote: string | null;
  /** Column headers for this card's term, e.g. "April Midterm (%)". */
  exam1ColumnLabel: string;
  exam2ColumnLabel: string;
  subjectLines: ProfileReportCardSubjectLine[];
}

/** Free-form staff finance note on a student profile (replaces old term “snapshots”). */
export interface ProfileFinanceNoteRow {
  id: string;
  body: string;
  created_at: string;
  /** Last update time (equals created_at on insert; use for “recorded at” in UI). */
  updated_at: string;
  /** e.g. "Amina (Finance)" for the table. */
  recorded_by_line: string;
}

export interface ProfilePaymentRow {
  id: string;
  amount: number;
  /** ISO-8601 — time the row was saved; use `formatPaymentRecordedAtInSchoolZone` in the client. */
  recorded_at: string;
  /** Preformatted e.g. "Full name (Admin)" for the table. */
  recorded_by_line: string;
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
  const scoresRaw = await fetchAllRows<TeacherScorePick>({
    label: "student-profile:auto-data teacher_scores by student",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("id, assignment_id, score")
        .eq("student_id", studentId)
        .range(from, to),
  });
  const scores = scoresRaw as TeacherScorePick[] | null;
  if (!scores?.length) return [];

  const assignmentIds = [...new Set(scores.map((s) => s.assignment_id))];
  const assignsRaw = await fetchAllRows<GradebookAssignmentPick>({
    label: "student-profile:auto-data gradebook assignments by ids",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select("id, title, max_score, subject, term, academic_year, class_id")
        .in("id", assignmentIds)
        .range(from, to),
  });
  const assigns = assignsRaw as GradebookAssignmentPick[] | null;
  if (!assigns?.length) return [];

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

  const rows = await fetchAllRows<{ attendance_date: string; status: "present" | "absent" | "late" }>({
    label: "student-profile:auto-data attendance by student+class",
    fetchPage: async (from, to) =>
      await supabase
        .from("teacher_attendance")
        .select("attendance_date, status")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .range(from, to),
  });

  if (!rows?.length) {
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
  studentId: string,
  schoolLevel: SchoolLevel
): Promise<ProfileReportCardBlock[]> {
  const { data: cardsRaw, error } = await supabase
    .from("report_cards")
    .select(
      "id, class_id, term, academic_year, status, submitted_at, admin_note"
    )
    .eq("student_id", studentId)
    .order("academic_year", { ascending: false });

  const cards = cardsRaw as ReportCardPick[] | null;
  if (error || !cards?.length) return [];

  const buildBlock = async (c: ReportCardPick): Promise<ProfileReportCardBlock> => {
    const { exam1, exam2 } = reportCardExamColumnTitles(c.term);
    try {
      const commentRows = await mergeReportCardCommentsWithGradebookForParent({
        reportCardId: c.id,
        studentId,
        classId: c.class_id,
        academicYear: c.academic_year,
        term: c.term,
      });
      const subjectOrder = [
        ...new Set(commentRows.map((r) => r.subject)),
      ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      const syntheticStudent: StudentReportRow = {
        studentId,
        fullName: "—",
        parentEmail: null,
        reportCardId: c.id,
        status: c.status as ReportCardStatus,
        comments: commentRows,
      };
      const rows = buildSubjectPreviewRows(
        c.term,
        subjectOrder,
        syntheticStudent,
        undefined,
        null,
        schoolLevel
      );
      const subjectLines: ProfileReportCardSubjectLine[] = rows.map((r) => ({
        subject: r.subject,
        exam1Pct: r.exam1Pct,
        exam2Pct: r.exam2Pct,
        averagePct: r.averagePct,
        grade: r.grade,
        comment: r.comment.trim() === "" ? "—" : r.comment,
      }));
      return {
        id: c.id,
        term: c.term,
        academicYear: c.academic_year,
        status: c.status,
        submittedAt: c.submitted_at,
        adminNote: c.admin_note,
        exam1ColumnLabel: exam1,
        exam2ColumnLabel: exam2,
        subjectLines,
      };
    } catch (e) {
      console.error("[loadProfileReportCards] build failed", c.id, e);
      return {
        id: c.id,
        term: c.term,
        academicYear: c.academic_year,
        status: c.status,
        submittedAt: c.submitted_at,
        adminNote: c.admin_note,
        exam1ColumnLabel: exam1,
        exam2ColumnLabel: exam2,
        subjectLines: [],
      };
    }
  };

  const blocks: ProfileReportCardBlock[] = await Promise.all(
    cards.map((c) => buildBlock(c))
  );

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
      "id, amount, reference_number, recorded_at, recorded_by_id, receipt:receipts(receipt_number)"
    )
    .eq("student_id", studentId)
    .order("recorded_at", { ascending: false });

  const data = dataRaw as PaymentWithReceipt[] | null;
  if (error || !data) return [];

  const byId = new Set(
    data.map((p) => p.recorded_by_id).filter((u): u is string => Boolean(u))
  );
  const ids = Array.from(byId);
  const profileById = new Map<string, { full_name: string | null; role: UserRole }>();

  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", ids);
    for (const r of (profs ?? []) as {
      id: string;
      full_name: string | null;
      role: UserRole;
    }[]) {
      profileById.set(r.id, { full_name: r.full_name, role: r.role });
    }
  }

  return data.map((p) => {
    const receipt = p.receipt;
    const pro = p.recorded_by_id
      ? profileById.get(p.recorded_by_id) ?? null
      : null;
    return {
      id: p.id,
      amount: Number(p.amount),
      recorded_at: p.recorded_at,
      recorded_by_line: formatPaymentRecorderLine(
        pro?.full_name ?? null,
        pro?.role ?? null
      ),
      receipt_number: receipt?.receipt_number ?? null,
      reference_number: p.reference_number,
    };
  });
}

export async function loadProfileFinanceNotes(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<ProfileFinanceNoteRow[]> {
  const { data: dataRaw, error } = await supabase
    .from("student_finance_notes")
    .select("id, body, created_at, updated_at, created_by")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) return [];
  if (!dataRaw || dataRaw.length === 0) return [];

  const rows = dataRaw as {
    id: string;
    body: string;
    created_at: string;
    updated_at: string;
    created_by: string;
  }[];

  const byId = new Set(rows.map((r) => r.created_by));
  const ids = Array.from(byId);
  const profileById = new Map<string, { full_name: string | null; role: UserRole }>();

  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", ids);
    for (const r of (profs ?? []) as {
      id: string;
      full_name: string | null;
      role: UserRole;
    }[]) {
      profileById.set(r.id, { full_name: r.full_name, role: r.role });
    }
  }

  return rows.map((r) => {
    const pro = profileById.get(r.created_by) ?? null;
    return {
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      updated_at: r.updated_at,
      recorded_by_line: formatPaymentRecorderLine(
        pro?.full_name ?? null,
        pro?.role ?? null
      ),
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
