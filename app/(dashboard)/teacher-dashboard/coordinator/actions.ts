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

  // 5. Skip students that already have a report card for (term, academic_year)
  const { data: existing } = await admin
    .from("report_cards")
    .select("student_id")
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .in("student_id", studentIds);
  const alreadyHaveCard = new Set<string>(
    ((existing ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );

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
  for (const bucket of assignmentsBySubjectExam.values()) {
    for (const list of Object.values(bucket)) {
      for (const meta of list ?? []) allAssignmentIds.push(meta.assignmentId);
    }
  }

  const scoreByStudentAssignment = new Map<string, unknown>();
  if (allAssignmentIds.length > 0) {
    const { data: scoreRows } = await admin
      .from("teacher_scores")
      .select("assignment_id, student_id, score")
      .in("assignment_id", allAssignmentIds)
      .in("student_id", studentIds);

    for (const s of (scoreRows ?? []) as {
      assignment_id: string;
      student_id: string;
      score: unknown;
    }[]) {
      scoreByStudentAssignment.set(
        `${s.student_id}\u0000${s.assignment_id}`,
        s.score
      );
    }
  }

  // 8. Generate
  let generated = 0;
  let studentsMissingAllScores = 0;
  const errors: string[] = [];

  for (const stud of studentRows) {
    if (alreadyHaveCard.has(stud.id)) continue;

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
    const reportCardId = (createdCard as { id: string }).id;

    let allSubjectsEmpty = true;
    const commentRows: Record<string, unknown>[] = [];

    for (const subj of subjectList) {
      const subjectKey = normalizeSubjectKey(subj.name);
      const bucket = assignmentsBySubjectExam.get(subjectKey) ?? {};

      const pickPct = (examType: GradebookMajorExamTypeValue): number | null => {
        const list = bucket[examType];
        if (!list?.length) return null;
        for (const meta of list) {
          const raw = scoreByStudentAssignment.get(
            `${stud.id}\u0000${meta.assignmentId}`
          );
          const pct = percentFromScore(raw, meta.maxScore);
          if (pct != null) return pct;
        }
        return null;
      };

      const exam1Pct = pickPct(wanted.exam1);
      const exam2Pct = pickPct(wanted.exam2);

      let avg: number | null = null;
      if (exam1Pct != null && exam2Pct != null) {
        avg = Math.round(((exam1Pct + exam2Pct) / 2) * 10) / 10;
      } else if (exam1Pct != null) {
        avg = exam1Pct;
      } else if (exam2Pct != null) {
        avg = exam2Pct;
      }

      if (exam1Pct != null || exam2Pct != null) allSubjectsEmpty = false;

      const letter = avg != null ? letterGradeFromPercent(avg) : null;

      commentRows.push({
        teacher_id: user.id,
        school_id: klass.school_id,
        student_id: stud.id,
        subject: subj.name,
        academic_year: academicYear,
        term,
        report_card_id: reportCardId,
        comment: null,
        exam1_score: exam1Pct,
        exam2_score: exam2Pct,
        calculated_score: avg,
        calculated_grade: letter,
        score_percent: avg,
        letter_grade: letter,
      });
    }

    if (allSubjectsEmpty) studentsMissingAllScores += 1;

    if (commentRows.length > 0) {
      const { error: insCommentsErr } = await admin
        .from("teacher_report_card_comments")
        .insert(commentRows);
      if (insCommentsErr) {
        errors.push(
          `${stud.full_name || "Student"}: ${insCommentsErr.message}`
        );
        // Don't fail the whole batch; the report card row itself was created.
      }
    }

    generated += 1;
  }

  const skipped = alreadyHaveCard.size;

  // Any DB error for an individual student is surfaced but we still revalidate and
  // report partial success so the coordinator can see what landed.
  if (generated === 0 && errors.length > 0) {
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
  if (skipped > 0) {
    suffixParts.push(
      `${skipped} student${skipped === 1 ? "" : "s"} already had a report card`
    );
  }
  if (studentsMissingAllScores > 0) {
    suffixParts.push(
      `${studentsMissingAllScores} ${
        studentsMissingAllScores === 1 ? "has" : "have"
      } no exam scores yet`
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
