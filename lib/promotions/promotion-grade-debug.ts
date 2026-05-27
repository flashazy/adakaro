import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClassCluster } from "@/lib/class-cluster";
import { resolveAssignmentEnrollmentTerm } from "@/lib/gradebook-term";
import {
  classifyPromotionExamSlot,
  overallAverageFromSubjectAverages,
  resolveAssignmentSubjectKey,
  subjectAverageFromPromotionExams,
  type PromotionExamSlot,
} from "@/lib/promotions/compute-student-average-grades";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { Database } from "@/types/supabase";

function normalizeSubjectKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function assignmentMatchesAcademicYear(
  assignmentYear: string | null | undefined,
  academicYear: number
): boolean {
  const yr = (assignmentYear ?? "").trim();
  if (!yr) return true;
  const target = String(academicYear);
  if (yr === target) return true;
  if (yr.startsWith(`${target}/`) || yr.startsWith(`${target}-`)) return true;
  if (yr.includes(target)) return true;
  return false;
}

function titleLooksLikePromotionExam(title: string | null | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return t.includes("september") || t.includes("december");
}

export interface PromotionGradeDebugReport {
  classId: string;
  className: string | null;
  academicYear: number;
  classIdsInCluster: string[];
  classSubjectsFromSubjectClasses: { key: string; name: string }[];
  allGradebookAssignmentCount: number;
  assignmentsWithSeptOrDecInTitle: {
    id: string;
    title: string;
    subject: string;
    class_id: string;
    academic_year: string | null;
    exam_type: string | null;
    term: string | null;
    yearMatches: boolean;
    promotionSlot: PromotionExamSlot | null;
    subjectInClassList: boolean;
    subjectKey: string;
  }[];
  gradebookSubjectsNotLinkedToClass: string[];
  promotionAssignmentsUsed: {
    subject: string;
    september: { id: string; title: string } | null;
    december: { id: string; title: string } | null;
  }[];
  studentsSampled: {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
    overallAverage: number | null;
    subjects: {
      subject: string;
      septemberPercent: number | null;
      decemberPercent: number | null;
      subjectAverage: number;
      septemberAssignmentId: string | null;
      decemberAssignmentId: string | null;
      septemberScoreRaw: unknown;
      decemberScoreRaw: unknown;
    }[];
    scoresForPromotionAssignments: {
      assignmentId: string;
      title: string;
      subject: string;
      score: unknown;
      percent: number | null;
    }[];
  }[];
}

/**
 * Full diagnostic report for promotion grade calculation (logs + return value).
 */
export async function buildPromotionGradeDebugReport(
  supabase: SupabaseClient<Database>,
  args: {
    schoolId: string;
    classId: string;
    academicYear: number;
    studentNameContains?: string;
    maxStudents?: number;
  }
): Promise<PromotionGradeDebugReport> {
  const maxStudents = args.maxStudents ?? 3;

  const { data: classRow } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("id", args.classId)
    .eq("school_id", args.schoolId)
    .maybeSingle();

  const cluster = await resolveClassCluster(supabase, args.classId);
  const classIdsForData =
    cluster.isParent && cluster.childClassIds.length > 0
      ? cluster.classIds
      : [args.classId];

  const { data: scRowsRaw } = await supabase
    .from("subject_classes")
    .select("subject_id, class_id, subjects ( id, name )")
    .in("class_id", classIdsForData);

  const scRows = (scRowsRaw ?? []) as {
    subject_id: string;
    class_id: string;
    subjects:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
  }[];

  const subjectsByKey = new Map<string, { name: string }>();
  for (const r of scRows) {
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

  const classSubjectsFromSubjectClasses = [...subjectsByKey.entries()].map(
    ([key, { name }]) => ({ key, name })
  );

  const gbRowsRaw = await fetchAllRows<{
    id: string;
    title: string;
    subject: string;
    max_score: number | string;
    academic_year: string | null;
    exam_type: string | null;
    term: string | null;
    class_id: string;
  }>({
    label: "promotion-debug:gradebook",
    fetchPage: async (from, to) =>
      await supabase
        .from("teacher_gradebook_assignments")
        .select(
          "id, title, subject, max_score, academic_year, exam_type, term, class_id"
        )
        .in("class_id", classIdsForData)
        .range(from, to),
  });

  const assignmentsWithSeptOrDecInTitle = (gbRowsRaw ?? [])
    .filter((r) => titleLooksLikePromotionExam(r.title))
    .map((r) => {
      const resolved = resolveAssignmentSubjectKey(
        r.subject ?? "",
        subjectsByKey
      );
      const slot = classifyPromotionExamSlot({
        examType: r.exam_type,
        title: r.title,
        term: r.term,
      });
      return {
        id: r.id,
        title: r.title ?? "",
        subject: r.subject ?? "",
        class_id: r.class_id,
        academic_year: r.academic_year,
        exam_type: r.exam_type,
        term: r.term,
        yearMatches: assignmentMatchesAcademicYear(
          r.academic_year,
          args.academicYear
        ),
        promotionSlot: slot,
        subjectInClassList: resolved != null,
        subjectKey: resolved?.key ?? normalizeSubjectKey(r.subject),
        subjectMatchVia: resolved?.via ?? null,
        matchedClassSubject: resolved?.matchedName ?? null,
      };
    });

  const gradebookSubjectsNotLinkedToClass = [
    ...new Set(
      assignmentsWithSeptOrDecInTitle
        .filter((a) => !a.subjectInClassList)
        .map((a) => a.subject)
    ),
  ].sort();

  // Rebuild promotion setup (mirror compute logic)
  const examSetupBySubject = new Map<
    string,
    {
      september: { id: string; title: string; maxScore: number } | null;
      december: { id: string; title: string; maxScore: number } | null;
    }
  >();
  for (const [key] of subjectsByKey) {
    examSetupBySubject.set(key, { september: null, december: null });
  }

  const promotionAssignmentIds = new Set<string>();

  for (const r of gbRowsRaw ?? []) {
    if (!assignmentMatchesAcademicYear(r.academic_year, args.academicYear)) {
      continue;
    }
    const slot = classifyPromotionExamSlot({
      examType: r.exam_type,
      title: r.title,
      term: r.term,
    });
    if (!slot) continue;

    if (
      resolveAssignmentEnrollmentTerm({
        term: r.term,
        exam_type: r.exam_type,
        title: r.title,
      }) !== "Term 2"
    ) {
      continue;
    }

    const resolved = resolveAssignmentSubjectKey(r.subject ?? "", subjectsByKey);
    if (!resolved) continue;
    const subjectKey = resolved.key;

    const maxScore = Number(r.max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) continue;

    const meta = { id: r.id, title: r.title ?? "", maxScore };
    const setup = examSetupBySubject.get(subjectKey)!;
    if (!setup[slot]) {
      setup[slot] = meta;
      promotionAssignmentIds.add(r.id);
    }
  }

  const promotionAssignmentsUsed = [...subjectsByKey.entries()].map(
    ([key, { name }]) => {
      const setup = examSetupBySubject.get(key)!;
      return {
        subject: name,
        september: setup.september
          ? { id: setup.september.id, title: setup.september.title }
          : null,
        december: setup.december
          ? { id: setup.december.id, title: setup.december.title }
          : null,
      };
    }
  );

  let studentQuery = supabase
    .from("students")
    .select("id, full_name, admission_number, class_id")
    .eq("school_id", args.schoolId)
    .in("class_id", classIdsForData)
    .eq("status", "active")
    .eq("approval_status", "approved")
    .order("full_name")
    .limit(50);

  if (args.studentNameContains?.trim()) {
    studentQuery = studentQuery.ilike(
      "full_name",
      `%${args.studentNameContains.trim()}%`
    );
  }

  const { data: studentRows } = await studentQuery;
  const students = (studentRows ?? []).slice(0, maxStudents) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
  }[];

  const studentIds = students.map((s) => s.id);

  const scoreRows =
    studentIds.length > 0
      ? await fetchAllRows<{
          assignment_id: string;
          student_id: string;
          score: unknown;
        }>({
          label: "promotion-debug:scores",
          fetchPage: async (from, to) =>
            await supabase
              .from("teacher_scores")
              .select("assignment_id, student_id, score")
              .in("student_id", studentIds)
              .range(from, to),
        })
      : [];

  const assignmentMetaById = new Map<
    string,
    { title: string; subject: string; maxScore: number }
  >();
  for (const r of gbRowsRaw ?? []) {
    if (!promotionAssignmentIds.has(r.id)) continue;
    assignmentMetaById.set(r.id, {
      title: r.title ?? "",
      subject: r.subject ?? "",
      maxScore: Number(r.max_score),
    });
  }

  function percentFromScore(score: unknown, maxScore: number): number | null {
    if (score == null || String(score).trim() === "") return null;
    const n = Number(score);
    if (!Number.isFinite(n) || maxScore <= 0) return null;
    return Math.round((n / maxScore) * 1000) / 10;
  }

  const studentsSampled: PromotionGradeDebugReport["studentsSampled"] = [];

  for (const stud of students) {
    const scoresForPromotionAssignments: PromotionGradeDebugReport["studentsSampled"][0]["scoresForPromotionAssignments"] =
      [];

    for (const assignmentId of promotionAssignmentIds) {
      const meta = assignmentMetaById.get(assignmentId);
      if (!meta) continue;
      const row = (scoreRows ?? []).find(
        (s) => s.student_id === stud.id && s.assignment_id === assignmentId
      );
      scoresForPromotionAssignments.push({
        assignmentId,
        title: meta.title,
        subject: meta.subject,
        score: row?.score ?? null,
        percent: row
          ? percentFromScore(row.score, meta.maxScore)
          : null,
      });
    }

    const subjectList = [...subjectsByKey.entries()];
    const subjectAverages: number[] = [];
    const subjects: PromotionGradeDebugReport["studentsSampled"][0]["subjects"] =
      [];

    for (const [subjectKey, { name }] of subjectList) {
      const setup = examSetupBySubject.get(subjectKey)!;
      let septPercent: number | null = null;
      let decPercent: number | null = null;
      let septRaw: unknown = null;
      let decRaw: unknown = null;

      if (setup.september) {
        const row = (scoreRows ?? []).find(
          (s) =>
            s.student_id === stud.id &&
            s.assignment_id === setup.september!.id
        );
        septRaw = row?.score ?? null;
        septPercent = percentFromScore(septRaw, setup.september.maxScore);
      }
      if (setup.december) {
        const row = (scoreRows ?? []).find(
          (s) =>
            s.student_id === stud.id &&
            s.assignment_id === setup.december!.id
        );
        decRaw = row?.score ?? null;
        decPercent = percentFromScore(decRaw, setup.december.maxScore);
      }

      const setupForCalc = {
        september: setup.september
          ? {
              assignmentId: setup.september.id,
              maxScore: setup.september.maxScore,
              title: setup.september.title,
              examType: null,
              classId: "",
              assignmentSubject: "",
            }
          : null,
        december: setup.december
          ? {
              assignmentId: setup.december.id,
              maxScore: setup.december.maxScore,
              title: setup.december.title,
              examType: null,
              classId: "",
              assignmentSubject: "",
            }
          : null,
      };
      const subjectAvg = subjectAverageFromPromotionExams(
        setupForCalc,
        septPercent,
        decPercent
      );
      subjectAverages.push(subjectAvg);
      subjects.push({
        subject: name,
        septemberPercent: setup.september ? (septPercent ?? 0) : null,
        decemberPercent: setup.december ? (decPercent ?? 0) : null,
        subjectAverage: subjectAvg,
        septemberAssignmentId: setup.september?.id ?? null,
        decemberAssignmentId: setup.december?.id ?? null,
        septemberScoreRaw: septRaw,
        decemberScoreRaw: decRaw,
      });
    }

    const overall = overallAverageFromSubjectAverages(
      subjectAverages,
      subjectList.length
    );

    studentsSampled.push({
      id: stud.id,
      full_name: stud.full_name,
      admission_number: stud.admission_number,
      class_id: stud.class_id,
      overallAverage: overall,
      subjects,
      scoresForPromotionAssignments,
    });
  }

  return {
    classId: args.classId,
    className: (classRow as { name?: string } | null)?.name ?? null,
    academicYear: args.academicYear,
    classIdsInCluster: classIdsForData,
    classSubjectsFromSubjectClasses,
    allGradebookAssignmentCount: gbRowsRaw?.length ?? 0,
    assignmentsWithSeptOrDecInTitle,
    gradebookSubjectsNotLinkedToClass,
    promotionAssignmentsUsed,
    studentsSampled,
  };
}

export function logPromotionGradeDebugReport(
  report: PromotionGradeDebugReport
): void {
  console.log("\n========== PROMOTION GRADE DEBUG ==========");
  console.log(JSON.stringify(report, null, 2));
  console.log("==========================================\n");
}
