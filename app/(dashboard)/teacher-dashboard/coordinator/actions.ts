"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import { letterGradeFromPercent } from "../report-cards/report-card-grades";
import { shareReportCardWithParent } from "../report-cards/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

/**
 * Default per-subject comments used by the coordinator's "Generate Report
 * Cards" flow when the subject teacher hasn't entered a comment of their own.
 * Mapping is keyed by the calculated letter grade for that subject so the
 * canned text matches the student's actual performance — and so no report card
 * ever ships with a blank "Teacher comment" column.
 */
const DEFAULT_SUBJECT_COMMENT_BY_GRADE: Record<string, string> = {
  A: "Excellent performance, keep it up",
  B: "Good progress this term",
  C: "Satisfactory performance",
  D: "Needs improvement in this subject",
  F: "Struggling with this subject, needs extra support",
};

/**
 * Returns the configured default comment for the given letter grade, or
 * `null` when no grade was calculated yet (e.g. the student has no exam
 * scores). Falling back to the teacher's own comment is the caller's job —
 * this helper only owns the canned text.
 */
function defaultCommentForGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  return DEFAULT_SUBJECT_COMMENT_BY_GRADE[grade.trim().toUpperCase()] ?? null;
}

/**
 * Picks the comment that should be persisted on a coordinator-generated report
 * card row. Teacher-authored text always wins; if the teacher hasn't written
 * anything, we fall back to the grade-based default so the column is never
 * blank when a grade exists.
 */
function resolveCommentForGeneratedRow(
  teacherComment: string | null | undefined,
  letterGrade: string | null | undefined
): string | null {
  const trimmed = (teacherComment ?? "").trim();
  if (trimmed) return trimmed;
  return defaultCommentForGrade(letterGrade);
}

export type CoordinatorShareState =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Coordinator-scoped report card share. Confirms the caller is the assigned
 * coordinator for the report card's class, then reuses the existing share
 * implementation to email the parent.
 */
export async function shareCoordinatorReportCardAction(
  _prev: CoordinatorShareState | null,
  formData: FormData
): Promise<CoordinatorShareState> {
  const reportCardId = String(formData.get("report_card_id") ?? "").trim();
  const parentEmail = String(formData.get("parent_email") ?? "").trim();

  if (!reportCardId) {
    return { ok: false, error: "Missing report card reference." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: rc } = await admin
    .from("report_cards")
    .select("id, class_id, status")
    .eq("id", reportCardId)
    .maybeSingle();

  const cardRow = rc as {
    id: string;
    class_id: string;
    status: string;
  } | null;

  if (!cardRow) return { ok: false, error: "Report card not found." };

  const { data: coord } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", cardRow.class_id)
    .maybeSingle();

  if (!coord) {
    return {
      ok: false,
      error: "You are not the coordinator for this class.",
    };
  }

  const res = await shareReportCardWithParent({
    reportCardId,
    parentEmail,
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, message: "Report card emailed to parent." };
}

// ---------------------------------------------------------------------------
// Bulk report card generation for a coordinator class
// ---------------------------------------------------------------------------

/**
 * Result shape surfaced to the UI by `generateReportCardsForClassAction`.
 *
 * `ok: true` carries counts the UI uses to render a success toast. `studentsMissingAllScores`
 * is a soft warning: those students still get an (empty-scored) report card so the teacher
 * can fill it in later.
 */
export type CoordinatorGenerateState =
  | {
      ok: true;
      message: string;
      className: string;
      generated: number;
      skipped: number;
      studentsMissingAllScores: number;
    }
  | { ok: false; error: string };

interface ExamAssignmentMeta {
  assignmentId: string;
  subject: string;
  maxScore: number;
}

/** Major exams that feed exam1/exam2 on the report card, keyed per term. */
const TERM_EXAM_KEYS: Record<
  "Term 1" | "Term 2",
  { exam1: GradebookMajorExamTypeValue; exam2: GradebookMajorExamTypeValue }
> = {
  "Term 1": { exam1: "April_Midterm", exam2: "June_Terminal" },
  "Term 2": { exam1: "September_Midterm", exam2: "December_Annual" },
};

function normalizeSubjectKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function scoreToNumber(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function percentFromScore(score: unknown, maxScore: number): number | null {
  const n = scoreToNumber(score);
  if (n == null) return null;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return null;
  return Math.round((n / maxScore) * 1000) / 10;
}

/**
 * Coordinator-only. Creates report cards (status = `pending_review`) for every active
 * student in the class who does NOT already have one for the given term + academic year.
 * For each subject mapped to the class, inserts a `teacher_report_card_comments` row
 * pre-filled with the student's April Midterm / June Terminal (Term 1) or September
 * Midterm / December Annual (Term 2) percentages pulled from the gradebook. Missing
 * scores simply produce empty comment fields — the coordinator/teacher can fill them
 * in later. Existing report cards are never overwritten.
 */
export async function generateReportCardsForClassAction(
  _prev: CoordinatorGenerateState | null,
  formData: FormData
): Promise<CoordinatorGenerateState> {
  const classId = String(formData.get("class_id") ?? "").trim();
  const termRaw = String(formData.get("term") ?? "").trim();
  const academicYear = String(formData.get("academic_year") ?? "").trim();

  if (!classId) return { ok: false, error: "Missing class reference." };
  const term: "Term 1" | "Term 2" =
    termRaw === "Term 2" ? "Term 2" : "Term 1";
  if (!/^\d{4}$/.test(academicYear)) {
    return { ok: false, error: "Invalid academic year." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient() as AdminDb;

  // 1. Coordinator authorization
  const { data: coordRow } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .maybeSingle();
  if (!coordRow) {
    return {
      ok: false,
      error: "You are not the coordinator for this class.",
    };
  }

  // 2. Class + school
  const { data: classRow, error: classErr } = await admin
    .from("classes")
    .select("id, name, school_id")
    .eq("id", classId)
    .maybeSingle();
  if (classErr || !classRow) {
    return { ok: false, error: "Class not found." };
  }
  const klass = classRow as {
    id: string;
    name: string;
    school_id: string;
  };

  // 3. Active students in class
  const { data: studs } = await admin
    .from("students")
    .select("id, full_name")
    .eq("class_id", classId)
    .eq("status", "active");

  const studentRows = (studs ?? []) as { id: string; full_name: string }[];
  if (studentRows.length === 0) {
    return {
      ok: false,
      error: `No active students in ${klass.name}.`,
    };
  }
  const studentIds = studentRows.map((s) => s.id);

  // 4. Subjects mapped to this class (admin client — bypasses RLS on subjects)
  const { data: scRows } = await admin
    .from("subject_classes")
    .select("subject_id, subjects ( id, name )")
    .eq("class_id", classId);

  const subjectsByKey = new Map<string, { name: string }>();
  for (const r of (scRows ?? []) as {
    subject_id: string;
    subjects: { id: string; name: string } | null;
  }[]) {
    const name = r.subjects?.name?.trim();
    if (!name) continue;
    const key = normalizeSubjectKey(name);
    if (!subjectsByKey.has(key)) subjectsByKey.set(key, { name });
  }
  const subjectList = [...subjectsByKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // 5. Look up which students already have a report card for (term, academic_year).
  //    We no longer skip them outright — existing cards still get their position
  //    + teacher comments backfilled in step 8b so the coordinator's "Generate
  //    Report Cards" button can be re-run to refresh those columns without first
  //    deleting the cards by hand.
  const { data: existing } = await admin
    .from("report_cards")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .in("student_id", studentIds);
  const existingCardByStudent = new Map<string, string>();
  for (const r of (existing ?? []) as { id: string; student_id: string }[]) {
    existingCardByStudent.set(r.student_id, r.id);
  }

  // 6. Gradebook assignments that back the report card's exam1 / exam2 for this term.
  //    Use the admin client — coordinators aren't necessarily the teacher who owns
  //    these rows, so we can't filter by teacher_id.
  const wanted = TERM_EXAM_KEYS[term];
  const { data: gbRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, exam_type, subject, max_score, academic_year")
    .eq("class_id", classId);

  const gbRows = ((gbRowsRaw ?? []) as {
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
  }[]).filter((r) => {
    const yr = (r.academic_year ?? "").trim();
    return !yr || yr === academicYear;
  });

  // Map: subjectKey -> examKind -> [assignments]
  const assignmentsBySubjectExam = new Map<
    string,
    Partial<Record<GradebookMajorExamTypeValue, ExamAssignmentMeta[]>>
  >();

  for (const r of gbRows) {
    const examType =
      parseGradebookExamType(r.exam_type) ??
      inferMajorExamTypeFromTitle(r.title);
    if (!examType) continue;
    if (examType !== wanted.exam1 && examType !== wanted.exam2) continue;

    const subjectKey = normalizeSubjectKey(r.subject);
    if (!subjectsByKey.has(subjectKey)) continue;

    const canonicalName = subjectsByKey.get(subjectKey)!.name;
    const max = Number(r.max_score);
    if (!Number.isFinite(max) || max <= 0) continue;

    const bucket = assignmentsBySubjectExam.get(subjectKey) ?? {};
    const list = bucket[examType] ?? [];
    list.push({ assignmentId: r.id, subject: canonicalName, maxScore: max });
    bucket[examType] = list;
    assignmentsBySubjectExam.set(subjectKey, bucket);
  }

  // 7. Pull all relevant teacher_scores in a single query
  const allAssignmentIds: string[] = [];
  // assignmentId -> subjectKey, used below to bucket teacher remarks per subject.
  const subjectKeyByAssignmentId = new Map<string, string>();
  for (const [subjectKey, bucket] of assignmentsBySubjectExam.entries()) {
    for (const list of Object.values(bucket)) {
      for (const meta of list ?? []) {
        allAssignmentIds.push(meta.assignmentId);
        subjectKeyByAssignmentId.set(meta.assignmentId, subjectKey);
      }
    }
  }

  const scoreByStudentAssignment = new Map<string, unknown>();
  // (studentId\0subjectKey) -> the most recent teacher comment we could find,
  // sourced from either teacher_scores.remarks or another teacher's
  // teacher_report_card_comments row for the same (student, subject, term, year).
  const teacherCommentByStudentSubject = new Map<string, string>();
  if (allAssignmentIds.length > 0) {
    const { data: scoreRows } = await admin
      .from("teacher_scores")
      .select("assignment_id, student_id, score, remarks, updated_at")
      .in("assignment_id", allAssignmentIds)
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false });

    for (const s of (scoreRows ?? []) as {
      assignment_id: string;
      student_id: string;
      score: unknown;
      remarks: string | null;
      updated_at: string | null;
    }[]) {
      const cellKey = `${s.student_id}\u0000${s.assignment_id}`;
      if (!scoreByStudentAssignment.has(cellKey)) {
        scoreByStudentAssignment.set(cellKey, s.score);
      }

      const remark = (s.remarks ?? "").trim();
      if (!remark) continue;
      const subjectKey = subjectKeyByAssignmentId.get(s.assignment_id);
      if (!subjectKey) continue;
      const remarkKey = `${s.student_id}\u0000${subjectKey}`;
      // Rows are ordered newest first, so the first remark we see wins.
      if (!teacherCommentByStudentSubject.has(remarkKey)) {
        teacherCommentByStudentSubject.set(remarkKey, remark);
      }
    }
  }

  // 7c. Also pull existing per-subject comments from other teachers'
  // teacher_report_card_comments rows. Subject teachers usually write their
  // remark in the report card editor (not in teacher_scores.remarks), so this
  // is the most reliable source of the comment column the coordinator's
  // "Teacher comment" column should display.
  {
    const { data: priorComments } = await admin
      .from("teacher_report_card_comments")
      .select("student_id, subject, comment, updated_at")
      .eq("term", term)
      .eq("academic_year", academicYear)
      .in("student_id", studentIds)
      .not("comment", "is", null)
      .order("updated_at", { ascending: false });

    for (const r of (priorComments ?? []) as {
      student_id: string;
      subject: string;
      comment: string | null;
      updated_at: string | null;
    }[]) {
      const trimmed = (r.comment ?? "").trim();
      if (!trimmed) continue;
      const subjectKey = normalizeSubjectKey(r.subject);
      if (!subjectKey || !subjectsByKey.has(subjectKey)) continue;
      const key = `${r.student_id}\u0000${subjectKey}`;
      // Rows are ordered newest first; the freshest non-empty comment wins,
      // and we don't overwrite a teacher_scores.remark that was already set.
      if (!teacherCommentByStudentSubject.has(key)) {
        teacherCommentByStudentSubject.set(key, trimmed);
      }
    }
  }

  // 7b. Compute term averages for every active student (not just those getting a
  // new card) so the per-subject ranking reflects the whole class. Students who
  // already have a report card stay out of the insert loop further down, but
  // their averages still feed the position calculation.
  const pickPctFor = (
    studentId: string,
    subjectKey: string,
    examType: GradebookMajorExamTypeValue
  ): number | null => {
    const list = assignmentsBySubjectExam.get(subjectKey)?.[examType];
    if (!list?.length) return null;
    for (const meta of list) {
      const raw = scoreByStudentAssignment.get(
        `${studentId}\u0000${meta.assignmentId}`
      );
      const pct = percentFromScore(raw, meta.maxScore);
      if (pct != null) return pct;
    }
    return null;
  };

  const termAverage = (
    exam1Pct: number | null,
    exam2Pct: number | null
  ): number | null => {
    if (exam1Pct != null && exam2Pct != null) {
      return Math.round(((exam1Pct + exam2Pct) / 2) * 10) / 10;
    }
    if (exam1Pct != null) return exam1Pct;
    if (exam2Pct != null) return exam2Pct;
    return null;
  };

  // studentId -> subjectKey -> { exam1Pct, exam2Pct, avg }
  const computedByStudent = new Map<
    string,
    Map<
      string,
      { exam1Pct: number | null; exam2Pct: number | null; avg: number | null }
    >
  >();
  // subjectKey -> sorted (descending) list of class averages, for ranking.
  const classAvgsBySubject = new Map<string, number[]>();

  for (const stud of studentRows) {
    const perSubject = new Map<
      string,
      { exam1Pct: number | null; exam2Pct: number | null; avg: number | null }
    >();
    for (const subj of subjectList) {
      const subjectKey = normalizeSubjectKey(subj.name);
      const e1 = pickPctFor(stud.id, subjectKey, wanted.exam1);
      const e2 = pickPctFor(stud.id, subjectKey, wanted.exam2);
      const avg = termAverage(e1, e2);
      perSubject.set(subjectKey, { exam1Pct: e1, exam2Pct: e2, avg });
      if (avg != null) {
        const list = classAvgsBySubject.get(subjectKey) ?? [];
        list.push(avg);
        classAvgsBySubject.set(subjectKey, list);
      }
    }
    computedByStudent.set(stud.id, perSubject);
  }

  for (const list of classAvgsBySubject.values()) {
    list.sort((a, b) => b - a);
  }

  /** Competition-style 1-based rank: 1 + count of strictly higher averages. */
  const positionFor = (subjectKey: string, avg: number | null): number | null => {
    if (avg == null) return null;
    const sorted = classAvgsBySubject.get(subjectKey);
    if (!sorted?.length) return null;
    let strictlyHigher = 0;
    for (const v of sorted) {
      if (v > avg) strictlyHigher += 1;
      else break;
    }
    return strictlyHigher + 1;
  };

  // 8. Generate (or refresh existing). Existing cards stay in `pending_review`
  //    /etc — we only backfill their per-subject `position` and `comment` so
  //    the coordinator preview can show them. We never overwrite an existing
  //    non-empty teacher comment, and we never touch exam scores on an existing
  //    row (those belong to the subject teacher).
  let generated = 0;
  let refreshed = 0;
  let studentsMissingAllScores = 0;
  const errors: string[] = [];

  for (const stud of studentRows) {
    const existingCardId = existingCardByStudent.get(stud.id) ?? null;

    let reportCardId: string;
    if (existingCardId) {
      reportCardId = existingCardId;
    } else {
      const { data: createdCard, error: insCardErr } = await admin
        .from("report_cards")
        .insert({
          student_id: stud.id,
          class_id: classId,
          school_id: klass.school_id,
          teacher_id: user.id,
          term,
          academic_year: academicYear,
          status: "pending_review",
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insCardErr || !createdCard) {
        errors.push(
          `${stud.full_name || "Student"}: ${
            insCardErr?.message ?? "Could not create report card"
          }`
        );
        continue;
      }
      reportCardId = (createdCard as { id: string }).id;
    }

    let allSubjectsEmpty = true;
    const commentRows: Record<string, unknown>[] = [];
    const perSubject =
      computedByStudent.get(stud.id) ??
      new Map<
        string,
        { exam1Pct: number | null; exam2Pct: number | null; avg: number | null }
      >();

    for (const subj of subjectList) {
      const subjectKey = normalizeSubjectKey(subj.name);
      const computed =
        perSubject.get(subjectKey) ?? {
          exam1Pct: null,
          exam2Pct: null,
          avg: null,
        };
      const exam1Pct = computed.exam1Pct;
      const exam2Pct = computed.exam2Pct;
      const avg = computed.avg;

      if (exam1Pct != null || exam2Pct != null) allSubjectsEmpty = false;

      const letter = avg != null ? letterGradeFromPercent(avg) : null;
      const position = positionFor(subjectKey, avg);
      const teacherComment =
        teacherCommentByStudentSubject.get(`${stud.id}\u0000${subjectKey}`) ??
        null;
      // Teacher's own text wins; otherwise drop in the grade-based default so
      // the report card never displays a blank "Teacher comment" column.
      const resolvedComment = resolveCommentForGeneratedRow(
        teacherComment,
        letter
      );

      // NOTE: `teacher_report_card_comments` doesn't have a `school_id` column
      // (PostgREST returns PGRST204 if you try to set it), so we deliberately
      // omit it here — the join to a school still works through report_card_id
      // -> report_cards.school_id and student_id -> students.school_id.
      commentRows.push({
        teacher_id: user.id,
        student_id: stud.id,
        subject: subj.name,
        academic_year: academicYear,
        term,
        report_card_id: reportCardId,
        comment: resolvedComment,
        exam1_score: exam1Pct,
        exam2_score: exam2Pct,
        calculated_score: avg,
        calculated_grade: letter,
        score_percent: avg,
        letter_grade: letter,
        position,
      });
    }

    if (allSubjectsEmpty) studentsMissingAllScores += 1;

    if (commentRows.length > 0) {
      if (existingCardId) {
        // Refresh path — update each pre-existing comment row's `position` and
        // (if currently null) `comment`, and insert any subject rows that
        // weren't previously stored. We touch ONLY those two fields so we never
        // clobber a teacher's exam scores or hand-written comment.
        const refreshResult = await refreshCoordinatorCommentRows({
          admin,
          reportCardId,
          coordinatorTeacherId: user.id,
          studentId: stud.id,
          academicYear,
          term,
          commentRows,
          onError: (msg) =>
            errors.push(`${stud.full_name || "Student"}: ${msg}`),
        });
        if (refreshResult.touched) refreshed += 1;
      } else {
        let insRes = await admin
          .from("teacher_report_card_comments")
          .insert(commentRows);

        // Older databases without the position column (migration 00085 not yet
        // applied) reject the insert with a missing-column error. Strip the new
        // field and retry so report card generation degrades gracefully.
        if (
          insRes.error &&
          /column .*position/i.test(insRes.error.message ?? "")
        ) {
          const legacyRows = commentRows.map((row) => {
            const next = { ...row } as Record<string, unknown>;
            delete next.position;
            return next;
          });
          insRes = await admin
            .from("teacher_report_card_comments")
            .insert(legacyRows);
        }

        if (insRes.error) {
          errors.push(
            `${stud.full_name || "Student"}: ${insRes.error.message}`
          );
          // Don't fail the whole batch; the report card row itself was created.
        }
        generated += 1;
      }
    } else if (!existingCardId) {
      generated += 1;
    }
  }

  // `skipped` retains its old contract — number of students who already had a
  // report card before this run — but they're no longer "skipped" entirely;
  // their position + comment columns get refreshed in place. Surface that as a
  // separate suffix so coordinators understand both happened.
  const skipped = refreshed;

  // Any DB error for an individual student is surfaced but we still revalidate and
  // report partial success so the coordinator can see what landed.
  if (generated === 0 && refreshed === 0 && errors.length > 0) {
    return {
      ok: false,
      error: errors.slice(0, 3).join("; ") || "Could not generate report cards.",
    };
  }

  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/teacher-dashboard/report-cards");

  const messagePrefix = `Generated ${generated} report card${
    generated === 1 ? "" : "s"
  } for ${klass.name}`;
  const suffixParts: string[] = [];
  if (refreshed > 0) {
    suffixParts.push(
      `refreshed positions and teacher comments on ${refreshed} existing card${
        refreshed === 1 ? "" : "s"
      }`
    );
  }
  if (studentsMissingAllScores > 0) {
    suffixParts.push(
      `${studentsMissingAllScores} ${
        studentsMissingAllScores === 1 ? "has" : "have"
      } no exam scores yet`
    );
  }
  // If the per-student write paths recorded errors but at least one card still
  // landed, surface the first few so the coordinator notices instead of seeing
  // a falsely cheerful "refreshed N cards" message.
  if (errors.length > 0) {
    suffixParts.push(
      `${errors.length} write error${errors.length === 1 ? "" : "s"} (${errors
        .slice(0, 2)
        .join("; ")})`
    );
  }
  const message =
    suffixParts.length > 0
      ? `${messagePrefix} — ${suffixParts.join("; ")}.`
      : `${messagePrefix}.`;

  return {
    ok: true,
    message,
    className: klass.name,
    generated,
    skipped,
    studentsMissingAllScores,
  };
}

/**
 * For an existing report card, update each pre-existing comment row's
 * `position` and `comment` (only when previously empty) and insert any subject
 * row that wasn't previously stored. Never touches exam scores or a teacher's
 * already-written comment.
 */
async function refreshCoordinatorCommentRows(args: {
  admin: AdminDb;
  reportCardId: string;
  coordinatorTeacherId: string;
  studentId: string;
  academicYear: string;
  term: "Term 1" | "Term 2";
  commentRows: Record<string, unknown>[];
  onError: (msg: string) => void;
}): Promise<{ touched: boolean }> {
  const {
    admin,
    reportCardId,
    coordinatorTeacherId,
    studentId,
    academicYear,
    term,
    commentRows,
    onError,
  } = args;

  // Pull every pre-existing comment row for this student / term / year (any
  // teacher) so we know which subjects already exist and which need an insert.
  const { data: priorRowsRaw, error: priorErr } = await admin
    .from("teacher_report_card_comments")
    .select("id, teacher_id, subject, comment")
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear);

  if (priorErr) {
    onError(priorErr.message);
    return { touched: false };
  }

  let touched = false;

  // subjectKey -> array of pre-existing rows (may be from multiple teachers)
  const priorBySubject = new Map<
    string,
    { id: string; teacher_id: string; comment: string | null }[]
  >();
  for (const r of (priorRowsRaw ?? []) as {
    id: string;
    teacher_id: string;
    subject: string;
    comment: string | null;
  }[]) {
    const key = normalizeSubjectKey(r.subject);
    const list = priorBySubject.get(key) ?? [];
    list.push({ id: r.id, teacher_id: r.teacher_id, comment: r.comment });
    priorBySubject.set(key, list);
  }

  const toInsert: Record<string, unknown>[] = [];

  for (const row of commentRows) {
    const subjectName = String(row.subject ?? "");
    const subjectKey = normalizeSubjectKey(subjectName);
    const computedPosition =
      typeof row.position === "number" ? (row.position as number) : null;
    const computedComment =
      typeof row.comment === "string" && row.comment.trim() !== ""
        ? (row.comment as string)
        : null;

    const prior = priorBySubject.get(subjectKey) ?? [];

    if (prior.length === 0) {
      // No teacher (and no coordinator) has written a row for this subject yet —
      // insert the coordinator's placeholder so the preview has the position.
      // `school_id` is intentionally omitted — see note in the main insert
      // above; the column doesn't exist on this table.
      toInsert.push({
        teacher_id: coordinatorTeacherId,
        student_id: studentId,
        subject: subjectName,
        academic_year: academicYear,
        term,
        report_card_id: reportCardId,
        comment: computedComment,
        exam1_score: row.exam1_score ?? null,
        exam2_score: row.exam2_score ?? null,
        calculated_score: row.calculated_score ?? null,
        calculated_grade: row.calculated_grade ?? null,
        score_percent: row.score_percent ?? null,
        letter_grade: row.letter_grade ?? null,
        position: computedPosition,
      });
      continue;
    }

    // Backfill on every pre-existing row for this subject so the preview's
    // "richest row wins" merger always sees a position. The comment update is
    // skipped when a row already has one, to avoid clobbering teacher input.
    for (const p of prior) {
      const update: Record<string, unknown> = { position: computedPosition };
      const existingTrimmed = (p.comment ?? "").trim();
      if (!existingTrimmed && computedComment) {
        update.comment = computedComment;
      }
      let upd = await admin
        .from("teacher_report_card_comments")
        .update(update)
        .eq("id", p.id);

      // Schema fallback: if `position` doesn't exist yet, drop it and retry so
      // the comment refresh still lands.
      if (upd.error && /column .*position/i.test(upd.error.message ?? "")) {
        const { position: _drop, ...withoutPos } = update;
        void _drop;
        if (Object.keys(withoutPos).length === 0) continue;
        upd = await admin
          .from("teacher_report_card_comments")
          .update(withoutPos)
          .eq("id", p.id);
      }
      if (upd.error) onError(upd.error.message);
      else touched = true;
    }
  }

  if (toInsert.length > 0) {
    let insRes = await admin
      .from("teacher_report_card_comments")
      .insert(toInsert);
    if (
      insRes.error &&
      /column .*position/i.test(insRes.error.message ?? "")
    ) {
      const legacyRows = toInsert.map((row) => {
        const next = { ...row } as Record<string, unknown>;
        delete next.position;
        return next;
      });
      insRes = await admin
        .from("teacher_report_card_comments")
        .insert(legacyRows);
    }
    if (insRes.error) onError(insRes.error.message);
    else touched = true;
  }

  return { touched };
}
