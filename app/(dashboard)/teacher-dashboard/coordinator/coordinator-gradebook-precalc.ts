import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import { resolveClassCluster } from "@/lib/class-cluster";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

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

interface ExamAssignmentMeta {
  assignmentId: string;
  maxScore: number;
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

export type CoordinatorGenerationWarnings = {
  studentsMissingAllScores: number;
  subjectsWithNoExamSetup: string[];
  studentCount: number;
};

/**
 * Gradebook snapshot for pre-generation warnings (no DB writes).
 */
export async function coordinatorGenerationWarningsForClass(
  admin: SupabaseClient,
  args: {
    userId: string;
    classId: string;
    term: "Term 1" | "Term 2";
    academicYear: string;
  }
): Promise<
  | { ok: false; error: string }
  | { ok: true; warnings: CoordinatorGenerationWarnings }
> {
  const { userId, classId, term, academicYear } = args;

  const { data: coordRow } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", userId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!coordRow) {
    return { ok: false, error: "You are not the coordinator for this class." };
  }

  const { data: classRow, error: classErr } = await admin
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();
  if (classErr || !classRow) {
    return { ok: false, error: "Class not found." };
  }

  const cluster = await resolveClassCluster(admin, classId);
  const classIdsForData =
    cluster.isParent && cluster.childClassIds.length > 0
      ? cluster.classIds
      : [classId];

  const { data: studs } = await admin
    .from("students")
    .select("id")
    .in("class_id", classIdsForData)
    .eq("status", "active");

  const studentRows = (studs ?? []) as { id: string }[];
  if (studentRows.length === 0) {
    return { ok: false, error: "No active students in this class." };
  }
  const studentIds = studentRows.map((s) => s.id);

  const { data: scRows } = await admin
    .from("subject_classes")
    .select("subject_id, subjects ( id, name )")
    .in("class_id", classIdsForData);

  const subjectsByKey = new Map<string, { name: string }>();
  for (const r of scRows ?? []) {
    const joined = r.subjects;
    const subject = Array.isArray(joined) ? joined[0] : joined;
    const name =
      subject && typeof subject === "object" && "name" in subject
        ? String((subject as { name?: string }).name ?? "").trim()
        : "";
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

  const wanted = TERM_EXAM_KEYS[term];
  const gbRowsRaw = await fetchAllRows<{
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
  }>({
    label: "coordinator:generation-warnings gradebook",
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

    const max = Number(r.max_score);
    if (!Number.isFinite(max) || max <= 0) continue;

    const bucket = assignmentsBySubjectExam.get(subjectKey) ?? {};
    const list = bucket[examType] ?? [];
    list.push({ assignmentId: r.id, maxScore: max });
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

  const allAssignmentIds: string[] = [];
  for (const bucket of assignmentsBySubjectExam.values()) {
    for (const list of Object.values(bucket)) {
      for (const meta of list ?? []) {
        allAssignmentIds.push(meta.assignmentId);
      }
    }
  }

  const scoreByStudentAssignment = new Map<string, unknown>();
  if (allAssignmentIds.length > 0) {
    const scoreRows = await fetchAllRows<{
      assignment_id: string;
      student_id: string;
      score: unknown;
    }>({
      label: "coordinator:generation-warnings scores",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_scores")
          .select("assignment_id, student_id, score")
          .in("assignment_id", allAssignmentIds)
          .in("student_id", studentIds)
          .range(from, to),
    });

    for (const s of (scoreRows ?? []) as {
      assignment_id: string;
      student_id: string;
      score: unknown;
    }[]) {
      const cellKey = `${s.student_id}\u0000${s.assignment_id}`;
      if (!scoreByStudentAssignment.has(cellKey)) {
        scoreByStudentAssignment.set(cellKey, s.score);
      }
    }
  }

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

  let studentsMissingAllScores = 0;
  for (const stud of studentRows) {
    let hasAnyScore = false;
    for (const subj of subjectList) {
      const subjectKey = normalizeSubjectKey(subj.name);
      const e1 = pickPctFor(stud.id, subjectKey, wanted.exam1);
      const e2 = pickPctFor(stud.id, subjectKey, wanted.exam2);
      if (e1 != null || e2 != null) {
        hasAnyScore = true;
        break;
      }
    }
    if (!hasAnyScore) studentsMissingAllScores += 1;
  }

  return {
    ok: true,
    warnings: {
      studentsMissingAllScores,
      subjectsWithNoExamSetup,
      studentCount: studentRows.length,
    },
  };
}
