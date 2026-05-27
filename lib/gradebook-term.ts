import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import type { SubjectEnrollmentTerm } from "@/lib/student-subject-enrollment";

/** Preset titles shown when creating assignments in Term 1. */
export const TERM1_MAJOR_EXAM_PRESET_TITLES = [
  "April Midterm Examination",
  "June Terminal Examination",
] as const;

/** Preset titles shown when creating assignments in Term 2. */
export const TERM2_MAJOR_EXAM_PRESET_TITLES = [
  "September Midterm Examination",
  "December Annual Examination",
] as const;

export function presetTitlesForTerm(
  term: SubjectEnrollmentTerm
): readonly string[] {
  return term === "Term 1"
    ? TERM1_MAJOR_EXAM_PRESET_TITLES
    : TERM2_MAJOR_EXAM_PRESET_TITLES;
}

export function majorExamEnrollmentTerm(
  exam: GradebookMajorExamTypeValue
): SubjectEnrollmentTerm {
  if (exam === "April_Midterm" || exam === "June_Terminal") {
    return "Term 1";
  }
  return "Term 2";
}

/**
 * Infer term from free-form title when `term` / `exam_type` are missing (legacy rows).
 */
export function inferTermFromAssignmentTitle(
  raw: string | null | undefined
): SubjectEnrollmentTerm | null {
  const t = (raw ?? "").toLowerCase();
  if (!t) return null;
  if (
    t.includes("september") ||
    t.includes("october") ||
    t.includes("november") ||
    t.includes("december")
  ) {
    return "Term 2";
  }
  if (
    t.includes("april") ||
    t.includes("may") ||
    t.includes("june")
  ) {
    return "Term 1";
  }
  return null;
}

/**
 * Effective term for gradebook filtering.
 * Major preset exams (April/June/September/December) always use exam_type/title —
 * not the stored `term` column, which may be wrong on legacy rows.
 * Custom assignments use the stored `term`, then title inference.
 */
export function resolveAssignmentEnrollmentTerm(row: {
  term?: string | null;
  exam_type?: string | null;
  title?: string | null;
}): SubjectEnrollmentTerm | null {
  const exam =
    parseGradebookExamType(row.exam_type) ??
    inferMajorExamTypeFromTitle(row.title);
  if (exam) return majorExamEnrollmentTerm(exam);

  const explicit = (row.term ?? "").trim();
  if (explicit === "Term 1" || explicit === "Term 2") return explicit;

  return inferTermFromAssignmentTitle(row.title);
}

/**
 * True when an assignment belongs to the selected gradebook term.
 * Major exams without `term` set are inferred from exam_type / title.
 * Custom assignments require an explicit `term` value.
 */
export function assignmentMatchesGradebookTerm(
  row: {
    term?: string | null;
    exam_type?: string | null;
    title?: string | null;
  },
  gradebookTerm: SubjectEnrollmentTerm
): boolean {
  return resolveAssignmentEnrollmentTerm(row) === gradebookTerm;
}
