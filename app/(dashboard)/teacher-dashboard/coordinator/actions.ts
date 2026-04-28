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
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import { resolveClassCluster } from "@/lib/class-cluster";
import { persistAcademicPerformanceReport } from "@/lib/academic-performance-report";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

/**
 * Default per-subject comments used by the coordinator's "Generate Report
 * Cards" flow when the subject teacher hasn't entered a comment of their own.
 * Mapping is keyed by the calculated letter grade for that subject so the
 * canned text matches the student's actual performance — and so no report card
 * ever ships with a blank "Teacher comment" column.
 */
// Includes both F (secondary failing band) and E (primary failing band) so the
// canned text resolves correctly regardless of the school's grading tier.
const DEFAULT_SUBJECT_COMMENT_BY_GRADE: Record<string, string> = {
  A: "Excellent performance, keep it up",
  B: "Good progress this term",
  C: "Satisfactory performance",
  D: "Needs improvement in this subject",
  E: "Struggling with this subject, needs extra support",
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

export type CoordinatorSubmitReviewState =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Coordinator moves a report card from draft or changes_requested to
 * `pending_review` (same workflow as the legacy teacher workspace, without
 * requiring the row’s `teacher_id` to match the caller).
 */
export async function submitCoordinatorReportCardForReviewAction(
  _prev: CoordinatorSubmitReviewState | null,
  formData: FormData
): Promise<CoordinatorSubmitReviewState> {
  const reportCardId = String(formData.get("report_card_id") ?? "").trim();
  if (!reportCardId) {
    return { ok: false, error: "Missing report card reference." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient() as AdminDb;
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

  if (
    cardRow.status !== "draft" &&
    cardRow.status !== "changes_requested"
  ) {
    return {
      ok: false,
      error: "Only draft or changes-requested report cards can be submitted.",
    };
  }

  const { error } = await admin
    .from("report_cards")
    .update({
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", reportCardId)
    .in("status", ["draft", "changes_requested"]);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true, message: "Submitted for head teacher review." };
}

// ---------------------------------------------------------------------------
// Approve all pending_review cards in a class (so parents can view)
// ---------------------------------------------------------------------------

export type CoordinatorSendToParentsState =
  | { ok: true; sentCount: number }
  | { ok: false; error: string };

/**
 * Sets `status` to `approved` for all `pending_review` report cards in the
 * class cluster and term + academic year. Does not modify `submitted_at` or
 * any other column (besides RLS / trigger-driven `updated_at` if present).
 */
export async function sendCoordinatorClassReportCardsToParentsAction(
  _prev: CoordinatorSendToParentsState | null,
  formData: FormData
): Promise<CoordinatorSendToParentsState> {
  const classId = String(formData.get("class_id") ?? "").trim();
  const termRaw = String(formData.get("term") ?? "").trim();
  const academicYear = String(formData.get("academic_year") ?? "").trim();

  if (!classId) return { ok: false, error: "Missing class reference." };
  const term: "Term 1" | "Term 2" = termRaw === "Term 2" ? "Term 2" : "Term 1";
  if (!/^\d{4}$/.test(academicYear)) {
    return { ok: false, error: "Invalid academic year." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient() as AdminDb;

  const { data: coordRow } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .maybeSingle();
  if (!coordRow) {
    return { ok: false, error: "You are not the coordinator for this class." };
  }

  const cluster = await resolveClassCluster(admin, classId);
  const classIds = cluster.classIds;

  const { data: updatedRows, error } = await admin
    .from("report_cards")
    .update({ status: "approved" })
    .in("class_id", classIds)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .eq("status", "pending_review")
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  const sentCount = (updatedRows ?? []).length;
  if (sentCount === 0) {
    return {
      ok: false,
      error:
        "No report cards are ready to send. Submit them for head teacher review first.",
    };
  }

  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/parent-dashboard");
  return { ok: true, sentCount };
}

// ---------------------------------------------------------------------------
// Bulk report card generation for a coordinator class
// ---------------------------------------------------------------------------

/**
 * Result shape surfaced to the UI by `generateReportCardsForClassAction`.
 *
 * `ok: true` includes `subjectsWithNoExamSetup` when the gradebook is missing
 * this term’s exam assignments for some (but not all) subjects. Generation
 * still completes; the UI should warn. `studentsMissingAllScores` is a soft
 * notice for students with no scores in any subject.
 */
export type CoordinatorGenerateState =
  | {
      ok: true;
      message: string;
      className: string;
      studentCount: number;
      generated: number;
      skipped: number;
      studentsMissingAllScores: number;
      subjectsWithNoExamSetup: string[];
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
 * Coordinator-only. For every active student in the class:
 * - Inserts a `report_cards` row (pending_review) plus `teacher_report_card_comments`
 *   when none exists for the term + academic year.
 * - When a report card already exists, updates each `teacher_report_card_comments` row
 *   with current exam % / grades / position from `teacher_scores` (same as new cards),
 *   and only fills an empty teacher `comment` from the generated default.
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

  // Parent form classes have no direct students; expand to the same cluster as
  // `loadCoordinatorOverview` (parent + streams). Single-stream coordinators
  // stay scoped to their class only.
  const cluster = await resolveClassCluster(admin, classId);
  const classIdsForData =
    cluster.isParent && cluster.childClassIds.length > 0
      ? cluster.classIds
      : [classId];

  // Letter grades have to use this school's grading tier — primary schools
  // have an A–E (max 50) scale, secondary the legacy A–F (max 100). We swallow
  // the read error so a database without the `school_level` column still
  // produces the original secondary-tier behaviour.
  let coordinatorSchoolLevel: SchoolLevel = "secondary";
  try {
    const { data: schoolLvlRow } = await admin
      .from("schools")
      .select("school_level")
      .eq("id", klass.school_id)
      .maybeSingle();
    coordinatorSchoolLevel = normalizeSchoolLevel(
      (schoolLvlRow as { school_level: string | null } | null)?.school_level
    );
  } catch {
    // keep the secondary fallback
  }

  // 3. Active students (all streams when coordinator class is a parent)
  const { data: studs } = await admin
    .from("students")
    .select("id, full_name")
    .in("class_id", classIdsForData)
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
    .in("class_id", classIdsForData);

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

  if (subjectList.length === 0) {
    return {
      ok: false,
      error:
        "No subjects are assigned to this class. Add subjects in school settings, then try again.",
    };
  }

  // 5. Look up which students already have a report card for (term, academic_year).
  //    We no longer skip them outright — existing cards still get their position
  //    + teacher comments backfilled in step 8b so the coordinator's "Generate
  //    Report Cards" button can be re-run to refresh those columns without first
  //    deleting the cards by hand.
  const existing = await fetchAllRows<{ id: string; student_id: string }>({
    label: "coordinator:generate existing report_cards by class/term/year",
    fetchPage: async (from, to) =>
      await admin
        .from("report_cards")
        .select("id, student_id")
        .eq("class_id", classId)
        .eq("term", term)
        .eq("academic_year", academicYear)
        .in("student_id", studentIds)
        .range(from, to),
  });
  const existingCardByStudent = new Map<string, string>();
  for (const r of (existing ?? []) as { id: string; student_id: string }[]) {
    existingCardByStudent.set(r.student_id, r.id);
  }

  // 6. Gradebook assignments that back the report card's exam1 / exam2 for this term.
  //    Use the admin client — coordinators aren't necessarily the teacher who owns
  //    these rows, so we can't filter by teacher_id.
  const wanted = TERM_EXAM_KEYS[term];
  const gbRowsRaw = await fetchAllRows<{
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
  }>({
    label: "coordinator:generate gradebook assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select("id, title, exam_type, subject, max_score, academic_year")
        .in("class_id", classIdsForData)
        .range(from, to),
  });

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

  const subjectsWithNoExamSetup: string[] = [];
  for (const subj of subjectList) {
    const sk = normalizeSubjectKey(subj.name);
    const bucket = assignmentsBySubjectExam.get(sk);
    const hasE1 = (bucket?.[wanted.exam1]?.length ?? 0) > 0;
    const hasE2 = (bucket?.[wanted.exam2]?.length ?? 0) > 0;
    if (!hasE1 && !hasE2) {
      subjectsWithNoExamSetup.push(subj.name);
    }
  }
  if (subjectsWithNoExamSetup.length === subjectList.length) {
    return {
      ok: false,
      error:
        "No exam scores are set up in the gradebook for any subject for this term. Add the correct exam assignments, then try again.",
    };
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
    const scoreRows = await fetchAllRows<{
      assignment_id: string;
      student_id: string;
      score: unknown;
      remarks: string | null;
      updated_at: string | null;
    }>({
      label: "coordinator:generate teacher_scores for assignments+students",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_scores")
          .select("assignment_id, student_id, score, remarks, updated_at")
          .in("assignment_id", allAssignmentIds)
          .in("student_id", studentIds)
          .order("updated_at", { ascending: false })
          .range(from, to),
    });

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
    const priorComments = await fetchAllRows<{
      student_id: string;
      subject: string;
      comment: string | null;
      updated_at: string | null;
    }>({
      label: "coordinator:generate prior teacher_report_card_comments",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_report_card_comments")
          .select("student_id, subject, comment, updated_at")
          .eq("term", term)
          .eq("academic_year", academicYear)
          .in("student_id", studentIds)
          .not("comment", "is", null)
          .order("updated_at", { ascending: false })
          .range(from, to),
    });

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

  // 7b. Compute term averages for every active student so the per-subject ranking
  // reflects the whole class. Existing cards get the same computed values applied
  // in the refresh path below.
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

  // 8. Generate new cards or refresh existing: sync exam %, calculated grade,
  //    letter grade, score_percent, and position from the current gradebook.
  //    We never overwrite a non-empty teacher `comment`.
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

      const letter =
        avg != null ? letterGradeFromPercent(avg, coordinatorSchoolLevel) : null;
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
        // Refresh path — upsert scores from `teacher_scores` + recompute ranks,
        // optionally backfill empty `comment`, and insert missing subject rows.
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

  // `skipped` in the return value counts existing cards that had their rows
  // refreshed in place.
  const skipped = refreshed;

  // Any DB error for an individual student is surfaced but we still revalidate and
  // report partial success so the coordinator can see what landed.
  if (generated === 0 && refreshed === 0 && errors.length > 0) {
    return {
      ok: false,
      error: errors.slice(0, 3).join("; ") || "Could not generate report cards.",
    };
  }

  await persistAcademicPerformanceReport({
    admin,
    schoolId: klass.school_id,
    classId,
    classIdsForData,
    className: klass.name,
    term,
    academicYear,
    schoolLevel: coordinatorSchoolLevel,
    classSubjectNames: subjectList.map((s) => s.name),
    generatedByUserId: user.id,
  });

  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/teacher-dashboard/academic-reports");

  let message = `Report cards generated for ${studentRows.length} students.`;
  if (errors.length > 0) {
    message += ` Some updates could not be completed (${errors.length} error${
      errors.length === 1 ? "" : "s"
    }).`;
  }

  return {
    ok: true,
    message,
    className: klass.name,
    studentCount: studentRows.length,
    generated,
    skipped,
    studentsMissingAllScores,
    subjectsWithNoExamSetup,
  };
}

/**
 * For an existing report card, update each comment row with gradebook-derived
 * exam %, calculated/letter grades, score_percent, and position; backfill
 * `comment` only when empty; insert missing subjects. Never overwrites a
 * non-empty teacher comment.
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
    .eq("report_card_id", reportCardId)
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
    // "richest row wins" merger always sees fresh scores + position. The
    // comment update is skipped when a row already has one.
    for (const p of prior) {
      const update: Record<string, unknown> = {
        position: computedPosition,
        exam1_score: row.exam1_score ?? null,
        exam2_score: row.exam2_score ?? null,
        calculated_score: row.calculated_score ?? null,
        calculated_grade: row.calculated_grade ?? null,
        score_percent: row.score_percent ?? null,
        letter_grade: row.letter_grade ?? null,
      };
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
