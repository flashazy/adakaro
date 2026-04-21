import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GRADEBOOK_MAJOR_EXAM_TYPE_VALUES,
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import {
  currentAcademicYear,
  getCurrentAcademicYearAndTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import {
  buildSubjectPreviewRows,
  computeClassSubjectPositions,
  computeReportCardStudentSummary,
} from "../report-cards/report-card-preview-builder";
import {
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";
import { resolveClassCluster } from "@/lib/class-cluster";
import type { ReportCardPreviewData } from "../report-cards/report-card-preview-types";
import type {
  ReportCardCommentRow,
  ReportCardStatus,
  StudentReportRow,
} from "../report-cards/report-card-types";
import { termDateRange } from "../report-cards/report-card-dates";
import { isMissingColumnSchemaError } from "../report-cards/report-card-schema-compat";
import {
  getStudentEnrolledSubjects,
  reportAcademicYearToEnrollmentYear,
} from "@/lib/student-subject-enrollment-queries";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import type {
  CoordinatorClassOverview,
  CoordinatorOverview,
  CoordinatorReportCardItem,
  CoordinatorSubjectOverview,
  MajorExamStatus,
} from "./types";

// Re-export shared types/constants so existing consumers of `./data` continue
// to work. The underlying definitions live in the client-safe `./types`
// module to avoid dragging `server-only` into client component graphs.
export { MAJOR_EXAM_LABELS } from "./types";
export type {
  CoordinatorClassOverview,
  CoordinatorOverview,
  CoordinatorReportCardItem,
  CoordinatorSubjectOverview,
  MajorExamStatus,
} from "./types";

/** Manual widen — admin select with nested relation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function parseNumeric(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ascending sort by `admission_number`. Missing values sink to the bottom so
 * a stray card without an admission number never steals the #1 slot.
 * Numeric-only strings compare numerically so "A002" precedes "A010".
 */
function compareAdmissionNumbers(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const ax = (a ?? "").trim();
  const bx = (b ?? "").trim();
  if (!ax && !bx) return 0;
  if (!ax) return 1;
  if (!bx) return -1;
  const an = Number(ax);
  const bn = Number(bx);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: "base" });
}

function emptyExamStatusMap(): Record<
  GradebookMajorExamTypeValue,
  MajorExamStatus
> {
  const out = {} as Record<GradebookMajorExamTypeValue, MajorExamStatus>;
  for (const k of GRADEBOOK_MAJOR_EXAM_TYPE_VALUES) {
    out[k] = { state: "missing" };
  }
  return out;
}

function dateFromIso(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIssuedDate(iso: string | null | undefined): string {
  const d = iso ? dateFromIso(iso) : new Date();
  return (d ?? new Date()).toISOString().slice(0, 10);
}

function statusLabelFor(status: ReportCardStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending_review":
      return "Pending review";
    case "draft":
      return "Draft";
    case "changes_requested":
      return "Changes requested";
    default:
      return String(status);
  }
}

function termForDefault(): SubjectEnrollmentTerm {
  return getCurrentAcademicYearAndTerm().term;
}

/** Chooses the term label to display report cards in when no user choice is present. */
export function defaultCoordinatorTerm(): "Term 1" | "Term 2" {
  return termForDefault();
}

/** Chooses the default academic year string when no user choice is present. */
export function defaultCoordinatorAcademicYear(): string {
  return String(currentAcademicYear());
}

async function loadCoordinatorClassesForUser(
  userId: string
): Promise<
  {
    id: string;
    classId: string;
    schoolId: string;
  }[]
> {
  const admin = createAdminClient() as Db;
  const { data } = await admin
    .from("teacher_coordinators")
    .select("id, class_id, school_id")
    .eq("teacher_id", userId);
  return ((data ?? []) as {
    id: string;
    class_id: string;
    school_id: string;
  }[]).map((r) => ({
    id: r.id,
    classId: r.class_id,
    schoolId: r.school_id,
  }));
}

async function resolveSubjectsForClass(
  admin: Db,
  classIds: string[]
): Promise<CoordinatorSubjectOverview[]> {
  const { data: scRows } = await admin
    .from("subject_classes")
    .select("subject_id, subjects ( id, name )")
    .in("class_id", classIds);

  const seen = new Map<string, { subjectId: string | null; name: string }>();
  for (const r of (scRows ?? []) as {
    subject_id: string;
    subjects: { id: string; name: string } | null;
  }[]) {
    const id = r.subjects?.id ?? r.subject_id;
    const name = r.subjects?.name?.trim() || "Subject";
    if (!seen.has(id)) seen.set(id, { subjectId: id, name });
  }
  const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  return list.map((s) => ({
    subjectId: s.subjectId,
    name: s.name,
    examStatus: emptyExamStatusMap(),
  }));
}

async function attachExamStatuses(
  admin: Db,
  classIds: string[],
  academicYear: string,
  subjects: CoordinatorSubjectOverview[],
  rosterSize: number
) {
  if (subjects.length === 0) return;

  const { data: gbRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, exam_type, subject, academic_year")
    .in("class_id", classIds);

  const gbRows = ((gbRowsRaw ?? []) as {
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    academic_year: string | null;
  }[]).filter((r) => {
    const yr = (r.academic_year ?? "").trim();
    return !yr || yr === academicYear;
  });

  const assignmentsBySubjectExam = new Map<
    string,
    { assignmentId: string }[]
  >();
  const subjectNameLowerIndex = new Map(
    subjects.map((s, i) => [s.name.trim().toLowerCase(), i] as const)
  );

  const assignmentIds: string[] = [];

  for (const r of gbRows) {
    const examType =
      parseGradebookExamType(r.exam_type) ??
      inferMajorExamTypeFromTitle(r.title);
    if (!examType) continue;
    const subjIdx = subjectNameLowerIndex.get(r.subject.trim().toLowerCase());
    if (subjIdx == null) continue;
    const subjName = subjects[subjIdx].name;
    const key = `${subjName}\0${examType}`;
    const list = assignmentsBySubjectExam.get(key) ?? [];
    list.push({ assignmentId: r.id });
    assignmentsBySubjectExam.set(key, list);
    assignmentIds.push(r.id);
  }

  const scoredStudentsByAssignment = new Map<string, Set<string>>();
  if (assignmentIds.length > 0) {
    const { data: scoreRows } = await admin
      .from("teacher_scores")
      .select("assignment_id, student_id, score")
      .in("assignment_id", assignmentIds);
    for (const r of (scoreRows ?? []) as {
      assignment_id: string;
      student_id: string;
      score: unknown;
    }[]) {
      if (parseNumeric(r.score) == null) continue;
      const set =
        scoredStudentsByAssignment.get(r.assignment_id) ?? new Set<string>();
      set.add(r.student_id);
      scoredStudentsByAssignment.set(r.assignment_id, set);
    }
  }

  for (const subject of subjects) {
    for (const examType of GRADEBOOK_MAJOR_EXAM_TYPE_VALUES) {
      const key = `${subject.name}\0${examType}`;
      const list = assignmentsBySubjectExam.get(key);
      if (!list?.length) continue;
      const scored = new Set<string>();
      for (const { assignmentId } of list) {
        const set = scoredStudentsByAssignment.get(assignmentId);
        if (!set) continue;
        for (const sid of set) scored.add(sid);
      }
      subject.examStatus[examType] = {
        state: "created",
        studentsScored: scored.size,
        rosterSize,
      };
    }
  }
}

async function loadClassCommentsByCard(
  admin: Db,
  cardIds: string[]
): Promise<Map<string, ReportCardCommentRow[]>> {
  const commentsByCard = new Map<string, ReportCardCommentRow[]>();
  if (cardIds.length === 0) return commentsByCard;

  // Columns added over multiple migrations (00066/00069/00070/00085). Fall back
  // to narrower selects when the live schema is behind so coordinators on older
  // DBs still see the teacher's scores instead of an empty preview.
  const selectColsLegacy =
    "id, report_card_id, subject, comment, score_percent, letter_grade";
  const selectColsExams =
    `${selectColsLegacy}, exam1_score, exam2_score, calculated_score, calculated_grade`;
  const selectColsOverride =
    `${selectColsExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
  const selectColsFull = `${selectColsOverride}, position`;

  let res = await admin
    .from("teacher_report_card_comments")
    .select(selectColsFull)
    .in("report_card_id", cardIds);

  if (res.error && isMissingColumnSchemaError(res.error)) {
    res = await admin
      .from("teacher_report_card_comments")
      .select(selectColsOverride)
      .in("report_card_id", cardIds);
  }
  if (res.error && isMissingColumnSchemaError(res.error)) {
    res = await admin
      .from("teacher_report_card_comments")
      .select(selectColsExams)
      .in("report_card_id", cardIds);
  }
  if (res.error && isMissingColumnSchemaError(res.error)) {
    res = await admin
      .from("teacher_report_card_comments")
      .select(selectColsLegacy)
      .in("report_card_id", cardIds);
  }

  if (res.error) {
    console.error(
      "[coordinator/loadClassCommentsByCard] select failed",
      res.error
    );
    return commentsByCard;
  }

  for (const row of (res.data ?? []) as {
    id: string;
    report_card_id: string;
    subject: string;
    comment: string | null;
    score_percent: number | string | null;
    letter_grade: string | null;
    exam1_score?: number | string | null;
    exam2_score?: number | string | null;
    calculated_score?: number | string | null;
    calculated_grade?: string | null;
    exam1_gradebook_original?: number | string | null;
    exam2_gradebook_original?: number | string | null;
    exam1_score_overridden?: boolean | null;
    exam2_score_overridden?: boolean | null;
    position?: number | string | null;
  }[]) {
    const list = commentsByCard.get(row.report_card_id) ?? [];
    list.push({
      id: row.id,
      subject: row.subject,
      comment: row.comment,
      scorePercent: parseNumeric(row.score_percent),
      letterGrade: row.letter_grade ?? null,
      exam1Score: parseNumeric(row.exam1_score ?? null),
      exam2Score: parseNumeric(row.exam2_score ?? null),
      calculatedScore: parseNumeric(row.calculated_score ?? null),
      calculatedGrade: row.calculated_grade ?? null,
      exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original ?? null),
      exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original ?? null),
      exam1ScoreOverridden: row.exam1_score_overridden === true,
      exam2ScoreOverridden: row.exam2_score_overridden === true,
      position: parseNumeric(row.position ?? null),
    });
    commentsByCard.set(row.report_card_id, list);
  }

  return commentsByCard;
}

/**
 * Merges per-subject comments that may come from different teachers (different
 * `teacher_id` rows) for the same (student, subject, term, year). Instead of
 * picking ONE row (which would drop the teacher's `comment` whenever the
 * coordinator-inserted row had richer score columns), we field-merge across
 * rows so the resulting preview row carries every teacher's contribution: the
 * richest score from any row, the freshest non-empty comment, the highest
 * stored position, etc.
 */
function collapseCommentsToOnePerSubject(
  rows: ReportCardCommentRow[]
): ReportCardCommentRow[] {
  const bySubject = new Map<string, ReportCardCommentRow>();
  const scoreRichness = (r: ReportCardCommentRow): number => {
    let s = 0;
    if (r.exam1Score != null) s += 3;
    if (r.exam2Score != null) s += 3;
    if (r.calculatedScore != null) s += 2;
    if (r.scorePercent != null) s += 2;
    if (r.letterGrade) s += 1;
    return s;
  };
  for (const r of rows) {
    const key = r.subject.trim().toLowerCase();
    const prev = bySubject.get(key);
    if (!prev) {
      bySubject.set(key, { ...r });
      continue;
    }

    // Pick the row whose SCORE columns are richer as the base, so we keep its
    // exam1/exam2/calculated/etc. Then patch in the freshest comment + best
    // position from either row.
    const base = scoreRichness(r) > scoreRichness(prev) ? r : prev;
    const other = base === r ? prev : r;

    const prevComment = (prev.comment ?? "").trim();
    const incomingComment = (r.comment ?? "").trim();
    const mergedComment = incomingComment || prevComment || base.comment || null;

    const mergedPosition =
      base.position ?? other.position ?? null;

    const mergedLetterGrade =
      base.letterGrade ?? other.letterGrade ?? null;
    const mergedCalculatedGrade =
      base.calculatedGrade ?? other.calculatedGrade ?? null;

    bySubject.set(key, {
      ...base,
      comment: mergedComment,
      position: mergedPosition,
      letterGrade: mergedLetterGrade,
      calculatedGrade: mergedCalculatedGrade,
    });
  }
  return [...bySubject.values()];
}

interface GradebookExamPair {
  exam1Pct: number | null;
  exam2Pct: number | null;
}

/**
 * Map (studentId → subject name (lowercased) → { exam1Pct, exam2Pct }) built
 * from `teacher_scores` + `teacher_gradebook_assignments` for the class, so we
 * can backfill comment rows whose exam fields are null (e.g. the coordinator
 * `Generate Report Cards` placeholder ran before the subject teacher entered
 * scores, or the teacher hasn't saved their report card yet but the gradebook
 * already has scores).
 */
async function loadGradebookScoresForClass(
  admin: Db,
  params: {
    classIds: string[];
    academicYear: string;
    term: "Term 1" | "Term 2";
    studentIds: string[];
  }
): Promise<Map<string, Map<string, GradebookExamPair>>> {
  const out = new Map<string, Map<string, GradebookExamPair>>();
  if (params.studentIds.length === 0) return out;

  const wanted: {
    exam1: GradebookMajorExamTypeValue;
    exam2: GradebookMajorExamTypeValue;
  } =
    params.term === "Term 2"
      ? { exam1: "September_Midterm", exam2: "December_Annual" }
      : { exam1: "April_Midterm", exam2: "June_Terminal" };

  const { data: gbRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, exam_type, subject, max_score, academic_year")
    .in("class_id", params.classIds);

  const gbRows = ((gbRowsRaw ?? []) as {
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
  }[]).filter((r) => {
    const yr = (r.academic_year ?? "").trim();
    return !yr || yr === params.academicYear;
  });

  type Meta = {
    subjectKey: string;
    maxScore: number;
    slot: "exam1" | "exam2";
  };
  const metaByAssignment = new Map<string, Meta>();

  for (const r of gbRows) {
    const examType =
      parseGradebookExamType(r.exam_type) ??
      inferMajorExamTypeFromTitle(r.title);
    if (!examType) continue;
    const slot: "exam1" | "exam2" | null =
      examType === wanted.exam1
        ? "exam1"
        : examType === wanted.exam2
          ? "exam2"
          : null;
    if (!slot) continue;
    const maxScore = Number(r.max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) continue;
    metaByAssignment.set(r.id, {
      subjectKey: r.subject.trim().toLowerCase(),
      maxScore,
      slot,
    });
  }

  const assignmentIds = [...metaByAssignment.keys()];
  if (assignmentIds.length === 0) return out;

  const { data: scRows } = await admin
    .from("teacher_scores")
    .select("assignment_id, student_id, score")
    .in("assignment_id", assignmentIds)
    .in("student_id", params.studentIds);

  for (const row of (scRows ?? []) as {
    assignment_id: string;
    student_id: string;
    score: unknown;
  }[]) {
    const meta = metaByAssignment.get(row.assignment_id);
    if (!meta) continue;
    const n = parseNumeric(row.score);
    if (n == null) continue;
    const pct = Math.round((n / meta.maxScore) * 1000) / 10;

    let bySubject = out.get(row.student_id);
    if (!bySubject) {
      bySubject = new Map<string, GradebookExamPair>();
      out.set(row.student_id, bySubject);
    }
    const existing = bySubject.get(meta.subjectKey) ?? {
      exam1Pct: null,
      exam2Pct: null,
    };
    if (meta.slot === "exam1") existing.exam1Pct = pct;
    else existing.exam2Pct = pct;
    bySubject.set(meta.subjectKey, existing);
  }

  return out;
}

/**
 * Returns a copy of `comments` where subjects without a stored comment row —
 * or with null exam fields — are backfilled from the gradebook. This mirrors
 * the teacher's report-card auto-fill, so the coordinator preview shows the
 * same April Midterm / June Terminal scores the teacher sees pre-populated.
 */
function mergeGradebookScoresIntoComments(
  comments: ReportCardCommentRow[],
  studentSubjects: string[],
  gradebookBySubject: Map<string, GradebookExamPair> | undefined
): ReportCardCommentRow[] {
  if (!gradebookBySubject || gradebookBySubject.size === 0) {
    // No gradebook scores yet — pass through existing comments as-is.
    return comments;
  }

  const bySubjectKey = new Map<string, ReportCardCommentRow>(
    comments.map((c) => [c.subject.trim().toLowerCase(), c])
  );

  // Use the broader of the two lists so we cover subjects that only exist in
  // comments (legacy) or only in gradebook.
  const allSubjectKeys = new Set<string>();
  for (const k of bySubjectKey.keys()) allSubjectKeys.add(k);
  for (const s of studentSubjects) {
    const k = s.trim().toLowerCase();
    if (k) allSubjectKeys.add(k);
  }
  for (const k of gradebookBySubject.keys()) allSubjectKeys.add(k);

  const canonicalName = new Map<string, string>();
  for (const s of studentSubjects) {
    const k = s.trim().toLowerCase();
    if (!canonicalName.has(k)) canonicalName.set(k, s.trim());
  }
  for (const c of comments) {
    const k = c.subject.trim().toLowerCase();
    if (!canonicalName.has(k)) canonicalName.set(k, c.subject.trim());
  }

  const out: ReportCardCommentRow[] = [];
  for (const key of allSubjectKeys) {
    const existing = bySubjectKey.get(key);
    const gb = gradebookBySubject.get(key);
    if (!existing && !gb) continue;

    const exam1 = existing?.exam1Score ?? gb?.exam1Pct ?? null;
    const exam2 = existing?.exam2Score ?? gb?.exam2Pct ?? null;
    const subjectLabel =
      existing?.subject || canonicalName.get(key) || key;

    out.push({
      id: existing?.id ?? `gb:${key}`,
      subject: subjectLabel,
      comment: existing?.comment ?? null,
      scorePercent: existing?.scorePercent ?? null,
      letterGrade: existing?.letterGrade ?? null,
      exam1Score: exam1,
      exam2Score: exam2,
      calculatedScore: existing?.calculatedScore ?? null,
      calculatedGrade: existing?.calculatedGrade ?? null,
      exam1GradebookOriginal: existing?.exam1GradebookOriginal ?? null,
      exam2GradebookOriginal: existing?.exam2GradebookOriginal ?? null,
      exam1ScoreOverridden: existing?.exam1ScoreOverridden === true,
      exam2ScoreOverridden: existing?.exam2ScoreOverridden === true,
      position: existing?.position ?? null,
    });
  }
  return out;
}

async function loadClassReportCards(
  admin: Db,
  params: {
    /** Primary class id (the coordinator's assigned class — often the parent). */
    classId: string;
    /** Cluster class ids: parent + every child stream, or just [classId]. */
    classIds: string[];
    className: string;
    schoolName: string;
    schoolMotto: string | null;
    schoolLogoUrl: string | null;
    schoolLevel: SchoolLevel;
    academicYear: string;
    term: "Term 1" | "Term 2";
    /** Class-level subject list resolved from `subject_classes`. */
    classSubjectNames: string[];
  }
): Promise<CoordinatorReportCardItem[]> {
  const { data: cards } = await admin
    .from("report_cards")
    .select(
      "id, class_id, status, student_id, term, academic_year, approved_at, updated_at, teacher_id, students ( full_name, parent_email, admission_number, class_id, gender )"
    )
    .in("class_id", params.classIds)
    .eq("term", params.term)
    .eq("academic_year", params.academicYear);

  const cardRows = (cards ?? []) as {
    id: string;
    class_id: string;
    status: ReportCardStatus;
    student_id: string;
    term: string;
    academic_year: string;
    approved_at: string | null;
    updated_at: string | null;
    teacher_id: string | null;
    students: {
      full_name: string;
      parent_email: string | null;
      admission_number: string | null;
      class_id: string;
      gender: "male" | "female" | null;
    } | null;
  }[];

  if (cardRows.length === 0) return [];

  const streamClassIds = [
    ...new Set(
      cardRows
        .map((c) => c.students?.class_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const streamClassNameById = new Map<string, string>();
  if (streamClassIds.length > 0) {
    const { data: clsRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", streamClassIds);
    for (const row of (clsRows ?? []) as { id: string; name: string }[]) {
      streamClassNameById.set(row.id, row.name.trim());
    }
  }

  const cardIds = cardRows.map((c) => c.id);
  const rawCommentsByCard = await loadClassCommentsByCard(admin, cardIds);

  // Collapse multi-teacher comments down to one row per subject per card so
  // the preview doesn't render duplicate rows when both the subject teacher and
  // the coordinator (via Generate Report Cards) have inserted rows.
  const commentsByCard = new Map<string, ReportCardCommentRow[]>();
  for (const [cardId, list] of rawCommentsByCard) {
    commentsByCard.set(cardId, collapseCommentsToOnePerSubject(list));
  }

  const studentIds = [...new Set(cardRows.map((c) => c.student_id))];

  // Pull major-exam scores straight from the gradebook. Coordinators are not
  // restricted by `teacher_id`, so `admin` returns every subject teacher's
  // scores — this matches what the teacher sees auto-filled in their editor.
  const gradebookByStudent = await loadGradebookScoresForClass(admin, {
    classIds: params.classIds,
    academicYear: params.academicYear,
    term: params.term,
    studentIds,
  });
  const attendanceByStudent = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const sid of studentIds) {
    attendanceByStudent.set(sid, { present: 0, absent: 0, late: 0 });
  }

  const { start, end } = termDateRange(params.term, params.academicYear);
  const { data: attRowsRaw } = await admin
    .from("teacher_attendance")
    .select("student_id, status, attendance_date, subject_id")
    .in("class_id", params.classIds)
    .in("student_id", studentIds)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  const attRows = dedupeTeacherAttendanceByStudentAndDate(
    (attRowsRaw ?? []) as {
      student_id: string;
      attendance_date: string;
      subject_id: string | null;
      status: "present" | "absent" | "late";
    }[]
  );
  for (const a of attRows) {
    const b = attendanceByStudent.get(a.student_id);
    if (!b) continue;
    if (a.status === "present") b.present += 1;
    else if (a.status === "absent") b.absent += 1;
    else if (a.status === "late") b.late += 1;
  }

  const teacherIds = [
    ...new Set(
      cardRows
        .map((c) => c.teacher_id)
        .filter((v): v is string => typeof v === "string")
    ),
  ];
  const teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teacherProfiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (teacherProfiles ?? []) as {
      id: string;
      full_name: string | null;
    }[]) {
      teacherNameById.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  // Coordinator teacher IDs for this class — used to swap "Class teacher" for
  // "Class Coordinator" on cards whose owning teacher coordinates the class.
  // For streamed classes we include coordinators of every class in the cluster
  // so the label is consistent whether the card's teacher is on the parent
  // or any child stream.
  const coordinatorTeacherIds = new Set<string>();
  {
    const { data: coordRows } = await admin
      .from("teacher_coordinators")
      .select("teacher_id")
      .in("class_id", params.classIds);
    for (const r of (coordRows ?? []) as { teacher_id: string }[]) {
      if (r.teacher_id) coordinatorTeacherIds.add(r.teacher_id);
    }
  }

  // Class + DB comment subjects (before gradebook merge). Enrolment and per-student
  // merge use the same lists as the report-card table so rank/totals never count
  // subjects that are not shown for that student.
  const classSubjectSet = new Set<string>();
  for (const name of params.classSubjectNames) {
    const trimmed = name.trim();
    if (trimmed) classSubjectSet.add(trimmed);
  }
  for (const [, list] of commentsByCard) {
    for (const row of list) {
      const t = row.subject?.trim();
      if (t) classSubjectSet.add(t);
    }
  }
  const allSubjectsV0 = [...classSubjectSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  // Per-student subject list: narrow to enrolled subjects when the student has
  // enrolment rows for the period, otherwise show the whole class list.
  const termParsed = params.term;
  const academicYearInt = reportAcademicYearToEnrollmentYear(
    params.academicYear
  );
  const subjectsByStudent = new Map<string, string[]>();
  await Promise.all(
    cardRows.map(async (c) => {
      const studentClassId = c.students?.class_id ?? c.class_id;
      const enrolled = await getStudentEnrolledSubjects(admin, {
        studentId: c.student_id,
        classId: studentClassId,
        academicYear: academicYearInt,
        term: termParsed,
        teacherSubjectLabels: allSubjectsV0,
      });
      subjectsByStudent.set(
        c.student_id,
        enrolled.length > 0 ? enrolled : allSubjectsV0
      );
    })
  );

  const studentsForRank: StudentReportRow[] = cardRows.map((c) => ({
    studentId: c.student_id,
    fullName: c.students?.full_name ?? "",
    parentEmail: c.students?.parent_email ?? null,
    reportCardId: c.id,
    status: c.status,
    comments: mergeGradebookScoresIntoComments(
      commentsByCard.get(c.id) ?? [],
      subjectsByStudent.get(c.student_id) ?? allSubjectsV0,
      gradebookByStudent.get(c.student_id)
    ),
  }));

  // Union class subjects with any label introduced by the gradebook merge
  // (e.g. a subject that only came from `teacher_scores`).
  const allSubjectsSet = new Set<string>(allSubjectsV0);
  for (const s of studentsForRank) {
    for (const c of s.comments) {
      const t = c.subject.trim();
      if (t) allSubjectsSet.add(t);
    }
  }
  const allSubjects = [...allSubjectsSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  // Cross-stream coordinators (parent class) rank by admission_number so one
  // overall ordering spans every stream. Single-stream coordinators keep the
  // existing alphabetical-by-name ordering so their view is unchanged.
  const sortByAdmission = params.classIds.length > 1;
  const cardsSorted = cardRows.sort((a, b) => {
    if (sortByAdmission) {
      return compareAdmissionNumbers(
        a.students?.admission_number ?? null,
        b.students?.admission_number ?? null
      );
    }
    return (a.students?.full_name ?? "").localeCompare(
      b.students?.full_name ?? ""
    );
  });

  const items: CoordinatorReportCardItem[] = cardsSorted.map((c) => {
    const studentSubjects = subjectsByStudent.get(c.student_id) ?? allSubjects;

    const mergedComments = mergeGradebookScoresIntoComments(
      commentsByCard.get(c.id) ?? [],
      studentSubjects,
      gradebookByStudent.get(c.student_id)
    );

    const studentRow: StudentReportRow = {
      studentId: c.student_id,
      fullName: c.students?.full_name ?? "Student",
      parentEmail: c.students?.parent_email ?? null,
      reportCardId: c.id,
      status: c.status,
      comments: mergedComments,
    };

    // Positions are ranked against the full class so coordinators see a true
    // class position even when students take different subject combinations.
    const positions = computeClassSubjectPositions(
      studentsForRank,
      allSubjects,
      c.student_id
    );
    // Footer summary (rank + total/avg) uses the same cohort that powers the
    // per-subject positions, so the footer line agrees with the table above.
    // We compute the summary first so we can pass `selectedSubjects` (best 7
    // for secondary students with >7 subjects) into the row builder for the
    // ✅ "Selected" indicator column.
    const summary = computeReportCardStudentSummary({
      allStudents: studentsForRank,
      getSubjects: (id) => subjectsByStudent.get(id) ?? allSubjects,
      subjects: allSubjects,
      focusStudentId: c.student_id,
      schoolLevel: params.schoolLevel,
      studentName: studentRow.fullName,
      term: params.term,
      academicYear: params.academicYear,
    });
    const subjectRows = buildSubjectPreviewRows(
      params.term,
      studentSubjects,
      studentRow,
      positions,
      summary.selectedSubjects,
      params.schoolLevel
    );

    const attendance = attendanceByStudent.get(c.student_id) ?? {
      present: 0,
      absent: 0,
      late: 0,
    };

    const streamLabel =
      params.classIds.length > 1 && c.students?.class_id
        ? streamClassNameById.get(c.students.class_id)
        : null;
    const displayClassName = streamLabel ?? params.className;

    const preview: ReportCardPreviewData = {
      schoolName: params.schoolName,
      schoolMotto: params.schoolMotto,
      logoUrl: params.schoolLogoUrl,
      studentName: studentRow.fullName,
      className: displayClassName,
      term: params.term,
      academicYear: params.academicYear,
      teacherName:
        (c.teacher_id && teacherNameById.get(c.teacher_id)) || "Teacher",
      teacherIsCoordinator: c.teacher_id
        ? coordinatorTeacherIds.has(c.teacher_id)
        : false,
      dateIssued: formatIssuedDate(c.approved_at ?? c.updated_at),
      statusLabel: statusLabelFor(c.status),
      subjects: subjectRows,
      attendance: {
        present: attendance.present,
        absent: attendance.absent,
        late: attendance.late,
        daysInTermLabel: `${start} – ${end}`,
      },
      summary,
    };

    return {
      reportCardId: c.id,
      studentId: c.student_id,
      studentName: studentRow.fullName,
      parentEmail: studentRow.parentEmail,
      admissionNumber: c.students?.admission_number ?? null,
      gender: c.students?.gender ?? null,
      status: c.status,
      preview,
    };
  });

  return items;
}

/**
 * Loads report-card items (with previews) for one coordinator class — used by
 * analytics and the academic performance report after Generate Report Cards.
 */
export async function loadCoordinatorReportCardsForClass(
  admin: Db,
  params: {
    classId: string;
    classIds: string[];
    className: string;
    schoolName: string;
    schoolMotto: string | null;
    schoolLogoUrl: string | null;
    schoolLevel: SchoolLevel;
    academicYear: string;
    term: "Term 1" | "Term 2";
    classSubjectNames: string[];
  }
): Promise<CoordinatorReportCardItem[]> {
  return loadClassReportCards(admin, params);
}

export async function loadCoordinatorOverview(params: {
  userId: string;
  term: "Term 1" | "Term 2";
  academicYear: string;
}): Promise<CoordinatorOverview> {
  const admin = createAdminClient() as Db;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", params.userId)
    .maybeSingle();
  const teacherName =
    (profile as { full_name: string | null } | null)?.full_name?.trim() ||
    "Coordinator";

  const assignments = await loadCoordinatorClassesForUser(params.userId);
  if (assignments.length === 0) {
    return { teacherName, classes: [] };
  }

  const classIds = [...new Set(assignments.map((a) => a.classId))];
  const schoolIds = [...new Set(assignments.map((a) => a.schoolId))];

  const { data: classRows } = await admin
    .from("classes")
    .select("id, name, school_id")
    .in("id", classIds);

  const classById = new Map(
    ((classRows ?? []) as { id: string; name: string; school_id: string }[]).map(
      (c) => [c.id, c]
    )
  );

  // `school_level` (migration 00086) may be missing on older deployments;
  // fall back to the legacy column set so the coordinator dashboard still
  // loads. Defaults to "primary" via `normalizeSchoolLevel` below.
  let schoolRows:
    | {
        id: string;
        name: string;
        logo_url: string | null;
        school_level?: string | null;
        motto?: string | null;
      }[]
    | null = null;
  {
    let res = await admin
      .from("schools")
      .select("id, name, logo_url, school_level, motto")
      .in("id", schoolIds);
    if (res.error && /column/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url, school_level")
        .in("id", schoolIds);
    }
    if (res.error && /column.*school_level/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url")
        .in("id", schoolIds);
    }
    schoolRows = (res.data as typeof schoolRows) ?? [];
  }

  const schoolById = new Map(
    (schoolRows ?? []).map((s) => [s.id, s])
  );

  const academicYear = params.academicYear.trim() || defaultCoordinatorAcademicYear();

  const classes: CoordinatorClassOverview[] = [];

  for (const classId of classIds) {
    const c = classById.get(classId);
    if (!c) continue;
    const school = schoolById.get(c.school_id);
    const schoolLevel = normalizeSchoolLevel(school?.school_level);

    // When the coordinator is assigned to a parent class, expand queries to
    // the whole cluster (parent + every child stream). Coordinators promoted
    // on a single stream only see that stream — they must be promoted on the
    // parent class to get the aggregated view.
    const cluster = await resolveClassCluster(admin, classId);
    const clusterIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [classId];

    const { count: studentCount } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("class_id", clusterIds)
      .eq("status", "active");

    const subjects = await resolveSubjectsForClass(admin, clusterIds);
    await attachExamStatuses(
      admin,
      clusterIds,
      academicYear,
      subjects,
      studentCount ?? 0
    );

    const mottoTrim = (school?.motto ?? "").trim();
    const reportCards = await loadClassReportCards(admin, {
      classId,
      classIds: clusterIds,
      className: c.name,
      schoolName: school?.name ?? "School",
      schoolMotto: mottoTrim ? mottoTrim : null,
      schoolLogoUrl: school?.logo_url ?? null,
      schoolLevel,
      academicYear,
      term: params.term,
      classSubjectNames: subjects.map((s) => s.name),
    });

    classes.push({
      classId,
      className: c.name,
      schoolId: c.school_id,
      schoolName: school?.name ?? "School",
      schoolMotto: mottoTrim ? mottoTrim : null,
      schoolLogoUrl: school?.logo_url ?? null,
      schoolLevel,
      academicYear,
      studentCount: studentCount ?? 0,
      subjects,
      reportCards,
    });
  }

  classes.sort((a, b) => a.className.localeCompare(b.className));

  return { teacherName, classes };
}
