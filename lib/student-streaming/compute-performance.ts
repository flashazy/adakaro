import "server-only";

import { calculateDivision } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import { letterGradeFromPercent } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-grades";
import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import type { StudentStreamingPerformance } from "@/lib/student-streaming/types";
import {
  SECONDARY_BEST_SUBJECT_COUNT,
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

function parseNumeric(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function assignmentMatchesExamType(
  row: {
    title: string;
    exam_type: string | null;
    academic_year: string | null;
  },
  examType: GradebookMajorExamTypeValue,
  academicYear: string
): boolean {
  const explicit = parseGradebookExamType(row.exam_type);
  const resolved =
    explicit ?? inferMajorExamTypeFromTitle(row.title);
  if (resolved !== examType) return false;
  if (row.academic_year && row.academic_year.trim() !== academicYear.trim()) {
    return false;
  }
  return true;
}

function emptyPerformance(): StudentStreamingPerformance {
  return {
    averageScorePercent: null,
    totalMarks: null,
    division: null,
    divisionPoints: null,
    subjectsScored: 0,
  };
}

function computeDivisionFromPercents(
  percents: number[],
  schoolLevel: SchoolLevel
): Pick<StudentStreamingPerformance, "division" | "divisionPoints"> {
  if (percents.length === 0) {
    return { division: "ABS", divisionPoints: null };
  }
  if (
    schoolLevel === "secondary" &&
    percents.length < SECONDARY_BEST_SUBJECT_COUNT
  ) {
    return { division: "INC", divisionPoints: null };
  }

  const grades = percents
    .map((pct) => letterGradeFromPercent(pct, schoolLevel))
    .filter((g) => g && g !== "—");

  if (
    schoolLevel === "secondary" &&
    grades.length < SECONDARY_BEST_SUBJECT_COUNT
  ) {
    return { division: "INC", divisionPoints: null };
  }

  const ranked =
    schoolLevel === "secondary"
      ? [...percents]
          .sort((a, b) => b - a)
          .slice(0, SECONDARY_BEST_SUBJECT_COUNT)
          .map((pct) => letterGradeFromPercent(pct, schoolLevel))
      : grades;

  const calc = calculateDivision(ranked);
  if (!calc) {
    return { division: "INC", divisionPoints: null };
  }
  return {
    division: calc.division,
    divisionPoints: calc.totalPoints,
  };
}

/**
 * Compute per-student performance metrics for a single major examination.
 */
export async function computeStudentExamPerformanceBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: {
    classIds: string[];
    academicYear: string;
    examType: GradebookMajorExamTypeValue;
    studentIds: string[];
    schoolLevel: string | null | undefined;
  }
): Promise<Map<string, StudentStreamingPerformance>> {
  const out = new Map<string, StudentStreamingPerformance>();
  for (const id of params.studentIds) out.set(id, emptyPerformance());
  if (params.studentIds.length === 0 || params.classIds.length === 0) {
    return out;
  }

  const schoolLevel = normalizeSchoolLevel(params.schoolLevel);

  const { data: assignmentRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, exam_type, subject, max_score, academic_year")
    .in("class_id", params.classIds);

  const assignmentRows = (assignmentRowsRaw ?? []) as {
    id: string;
    title: string;
    exam_type: string | null;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
  }[];

  const metaByAssignment = new Map<
    string,
    { subjectKey: string; maxScore: number }
  >();

  for (const row of assignmentRows) {
    if (
      !assignmentMatchesExamType(row, params.examType, params.academicYear)
    ) {
      continue;
    }
    const maxScore = Number(row.max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) continue;
    metaByAssignment.set(row.id, {
      subjectKey: row.subject.trim().toLowerCase(),
      maxScore,
    });
  }

  const assignmentIds = [...metaByAssignment.keys()];
  if (assignmentIds.length === 0) return out;

  const scoreRows = await fetchAllRows<{
    assignment_id: string;
    student_id: string;
    score: unknown;
  }>({
    label: "student-streaming: teacher_scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("assignment_id, student_id, score")
        .in("assignment_id", assignmentIds)
        .in("student_id", params.studentIds)
        .order("id", { ascending: true })
        .range(from, to),
  });

  const percentsByStudent = new Map<string, Map<string, number>>();
  const rawMarksByStudent = new Map<string, Map<string, number>>();

  for (const row of scoreRows) {
    const meta = metaByAssignment.get(row.assignment_id);
    if (!meta) continue;
    const score = parseNumeric(row.score);
    if (score == null) continue;

    const percent = Math.round(((score / meta.maxScore) * 100) * 10) / 10;

    const subjectMap =
      percentsByStudent.get(row.student_id) ?? new Map<string, number>();
    subjectMap.set(meta.subjectKey, percent);
    percentsByStudent.set(row.student_id, subjectMap);

    const marksMap =
      rawMarksByStudent.get(row.student_id) ?? new Map<string, number>();
    marksMap.set(meta.subjectKey, score);
    rawMarksByStudent.set(row.student_id, marksMap);
  }

  for (const studentId of params.studentIds) {
    const percents = [...(percentsByStudent.get(studentId)?.values() ?? [])];
    const rawMarks = [...(rawMarksByStudent.get(studentId)?.values() ?? [])];
    if (percents.length === 0) continue;

    const averageScorePercent =
      Math.round(
        (percents.reduce((sum, p) => sum + p, 0) / percents.length) * 10
      ) / 10;
    const totalMarks = rawMarks.reduce((sum, m) => sum + m, 0);
    const divisionInfo = computeDivisionFromPercents(percents, schoolLevel);

    out.set(studentId, {
      averageScorePercent,
      totalMarks,
      division: divisionInfo.division,
      divisionPoints: divisionInfo.divisionPoints,
      subjectsScored: percents.length,
    });
  }

  return out;
}

/**
 * Returns exam types that have at least one scored result for the class cluster.
 */
export async function loadExamsWithResultsForCluster(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: {
    classIds: string[];
    academicYear: string;
    studentIds: string[];
  }
): Promise<Set<GradebookMajorExamTypeValue>> {
  const found = new Set<GradebookMajorExamTypeValue>();
  if (params.studentIds.length === 0 || params.classIds.length === 0) {
    return found;
  }

  const { data: assignmentRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, exam_type, academic_year")
    .in("class_id", params.classIds);

  const assignmentRows = (assignmentRowsRaw ?? []) as {
    id: string;
    title: string;
    exam_type: string | null;
    academic_year: string | null;
  }[];

  const examTypeByAssignment = new Map<string, GradebookMajorExamTypeValue>();
  for (const row of assignmentRows) {
    if (row.academic_year && row.academic_year.trim() !== params.academicYear.trim()) {
      continue;
    }
    const explicit = parseGradebookExamType(row.exam_type);
    const resolved =
      explicit ?? inferMajorExamTypeFromTitle(row.title);
    if (resolved) examTypeByAssignment.set(row.id, resolved);
  }

  const assignmentIds = [...examTypeByAssignment.keys()];
  if (assignmentIds.length === 0) return found;

  const scoreRows = await fetchAllRows<{
    assignment_id: string;
    student_id: string;
  }>({
    label: "student-streaming: exam availability scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("assignment_id, student_id")
        .in("assignment_id", assignmentIds)
        .in("student_id", params.studentIds)
        .not("score", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
  });

  for (const row of scoreRows) {
    const examType = examTypeByAssignment.get(row.assignment_id);
    if (examType) found.add(examType);
  }

  return found;
}
