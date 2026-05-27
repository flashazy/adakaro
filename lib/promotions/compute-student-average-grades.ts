import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClassCluster } from "@/lib/class-cluster";
import { resolveAssignmentEnrollmentTerm } from "@/lib/gradebook-term";
import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
} from "@/lib/gradebook-major-exams";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { Database } from "@/types/supabase";

const DEBUG =
  process.env.NODE_ENV === "development" ||
  process.env.DEBUG_PROMOTION_GRADES === "1";

/** Tanzania year-end promotion uses only these two exams. */
export type PromotionExamSlot = "september" | "december";

function debugLog(message: string, payload?: unknown) {
  if (!DEBUG) return;
  if (payload !== undefined) {
    console.log(`[promotions:compute-grades] ${message}`, payload);
  } else {
    console.log(`[promotions:compute-grades] ${message}`);
  }
}

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

function roundPercent(n: number): number {
  return Math.round(n * 10) / 10;
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

/** Strip common suffixes so "ENGLISH LANGUAGE" ↔ "ENGLISH", "BUSINESS STUDY" ↔ "BUSINESS". */
function normalizeSubjectAlias(raw: string): string {
  return normalizeSubjectKey(raw)
    .replace(/\blanguage\b/g, "")
    .replace(/\bstudies?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when gradebook `subject` text likely refers to the same subject as subject_classes.
 */
export function subjectsLikelyMatch(
  classSubjectName: string,
  assignmentSubject: string
): boolean {
  const classKey = normalizeSubjectKey(classSubjectName);
  const assignKey = normalizeSubjectKey(assignmentSubject);
  if (!classKey || !assignKey) return false;
  if (classKey === assignKey) return true;

  const classAlias = normalizeSubjectAlias(classSubjectName);
  const assignAlias = normalizeSubjectAlias(assignmentSubject);
  if (classAlias && assignAlias && classAlias === assignAlias) return true;

  const minPrefixLen = 4;
  if (classKey.length >= minPrefixLen && assignKey.length >= minPrefixLen) {
    if (classKey.startsWith(assignKey) || assignKey.startsWith(classKey)) {
      return true;
    }
  }
  if (
    classAlias.length >= minPrefixLen &&
    assignAlias.length >= minPrefixLen &&
    (classAlias.startsWith(assignAlias) || assignAlias.startsWith(classAlias))
  ) {
    return true;
  }

  return false;
}

/**
 * Map gradebook assignment `subject` text to a class subject_classes key.
 */
export function resolveAssignmentSubjectKey(
  assignmentSubject: string,
  subjectsByKey: Map<string, { name: string }>
): { key: string; matchedName: string; via: string } | null {
  const raw = assignmentSubject.trim();
  if (!raw) return null;

  const key = normalizeSubjectKey(raw);
  if (subjectsByKey.has(key)) {
    return { key, matchedName: subjectsByKey.get(key)!.name, via: "exact_key" };
  }

  for (const [k, { name }] of subjectsByKey) {
    if (name.toLowerCase() === raw.toLowerCase()) {
      return { key: k, matchedName: name, via: "display_name_ci" };
    }
  }

  for (const [k, { name }] of subjectsByKey) {
    if (subjectsLikelyMatch(name, raw)) {
      return { key: k, matchedName: name, via: "fuzzy_name" };
    }
  }

  return null;
}

/**
 * Classify gradebook rows used for Tanzania promotion (Sept midterm + Dec annual only).
 */
export function classifyPromotionExamSlot(args: {
  examType: string | null | undefined;
  title: string | null | undefined;
  term: string | null | undefined;
}): PromotionExamSlot | null {
  const parsed =
    parseGradebookExamType(args.examType) ??
    inferMajorExamTypeFromTitle(args.title);

  if (parsed === "September_Midterm") return "september";
  if (parsed === "December_Annual") return "december";

  const title = (args.title ?? "").toLowerCase();
  if (title.includes("september")) return "september";
  if (title.includes("december")) return "december";

  const term = (args.term ?? "").trim();
  if (term === "Term 2" && title.includes("september")) return "september";
  if (
    (term === "Term 2" || term === "Term 3") &&
    (title.includes("december") || title.includes("annual"))
  ) {
    return "december";
  }

  return null;
}

interface ExamAssignmentMeta {
  assignmentId: string;
  maxScore: number;
  title: string;
  examType: string | null;
  classId: string;
  assignmentSubject: string;
}

interface SubjectExamSetup {
  september: ExamAssignmentMeta | null;
  december: ExamAssignmentMeta | null;
}

/**
 * Per-subject average from Sept/Dec exam percentages (Tanzania promotion rules).
 */
export function subjectAverageFromPromotionExams(
  setup: SubjectExamSetup,
  septPercent: number | null,
  decPercent: number | null
): number {
  const hasSept = setup.september != null;
  const hasDec = setup.december != null;

  if (!hasSept && !hasDec) return 0;
  if (hasSept && hasDec) {
    return roundPercent(((septPercent ?? 0) + (decPercent ?? 0)) / 2);
  }
  if (hasSept) return roundPercent(septPercent ?? 0);
  return roundPercent(decPercent ?? 0);
}

/**
 * Overall promotion average (%): mean of per-subject averages across all class subjects.
 */
export function overallAverageFromSubjectAverages(
  subjectAverages: number[],
  totalSubjectsInClass: number
): number {
  if (totalSubjectsInClass <= 0) return 0;
  const sum = subjectAverages.reduce((a, b) => a + b, 0);
  return roundPercent(sum / totalSubjectsInClass);
}

/**
 * Tanzania year-end promotion average per student:
 * - Only September Midterm + December Annual exams
 * - Per subject: average of Sept+Dec when both exist; else single exam or 0
 * - Overall: sum(subject averages) / number of subjects in the class
 */
export async function computeStudentAverageExamGrades(
  supabase: SupabaseClient<Database>,
  args: {
    classId: string;
    academicYear: number;
    studentIds: string[];
    className?: string | null;
  }
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  for (const id of args.studentIds) {
    result.set(id, null);
  }
  if (args.studentIds.length === 0) return result;

  const cluster = await resolveClassCluster(supabase, args.classId);
  const classIdsForData =
    cluster.isParent && cluster.childClassIds.length > 0
      ? cluster.classIds
      : [args.classId];

  debugLog("=== promotion grade run ===", {
    classId: args.classId,
    className: args.className ?? null,
    classIdsForData,
    academicYear: args.academicYear,
    studentCount: args.studentIds.length,
    cluster,
  });

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

  debugLog("subject_classes for class cluster", {
    rowCount: scRows.length,
    subjects: [...subjectsByKey.entries()].map(([key, { name }]) => ({
      key,
      name,
    })),
  });

  const subjectList = [...subjectsByKey.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );

  if (subjectList.length === 0) {
    debugLog(
      "WARNING: no subjects in subject_classes — cannot compute promotion averages"
    );
    return result;
  }

  const totalSubjects = subjectList.length;

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
    label: "promotions:gradebook assignments",
    fetchPage: async (from, to) =>
      await supabase
        .from("teacher_gradebook_assignments")
        .select(
          "id, title, subject, max_score, academic_year, exam_type, term, class_id"
        )
        .in("class_id", classIdsForData)
        .range(from, to),
  });

  debugLog("all gradebook assignments in cluster", {
    count: gbRowsRaw?.length ?? 0,
    byClass: Object.fromEntries(
      classIdsForData.map((cid) => [
        cid,
        (gbRowsRaw ?? []).filter((r) => r.class_id === cid).length,
      ])
    ),
  });

  const septDecTitleRows = (gbRowsRaw ?? []).filter((r) =>
    titleLooksLikePromotionExam(r.title)
  );
  debugLog('assignments with "September" or "December" in title', {
    count: septDecTitleRows.length,
    rows: septDecTitleRows.map((r) => ({
      id: r.id,
      title: r.title,
      subject: r.subject,
      class_id: r.class_id,
      academic_year: r.academic_year,
      exam_type: r.exam_type,
      term: r.term,
      yearMatches: assignmentMatchesAcademicYear(
        r.academic_year,
        args.academicYear
      ),
      slot: classifyPromotionExamSlot({
        examType: r.exam_type,
        title: r.title,
        term: r.term,
      }),
      subjectResolved: resolveAssignmentSubjectKey(r.subject, subjectsByKey),
    })),
  });

  const examSetupBySubject = new Map<string, SubjectExamSetup>();
  for (const [key] of subjectList) {
    examSetupBySubject.set(key, { september: null, december: null });
  }

  const promotionAssignmentIds = new Set<string>();
  const skippedAssignments: {
    reason: string;
    title: string;
    subject: string;
    academic_year: string | null;
    class_id: string;
  }[] = [];

  for (const r of gbRowsRaw ?? []) {
    const yearMatches = assignmentMatchesAcademicYear(
      r.academic_year,
      args.academicYear
    );
    if (!yearMatches) {
      if (titleLooksLikePromotionExam(r.title)) {
        skippedAssignments.push({
          reason: `academic_year "${r.academic_year ?? ""}" does not match ${args.academicYear}`,
          title: r.title ?? "",
          subject: r.subject ?? "",
          academic_year: r.academic_year,
          class_id: r.class_id,
        });
      }
      continue;
    }

    const enrollmentTerm = resolveAssignmentEnrollmentTerm({
      term: r.term,
      exam_type: r.exam_type,
      title: r.title,
    });
    if (enrollmentTerm !== "Term 2") continue;

    const slot = classifyPromotionExamSlot({
      examType: r.exam_type,
      title: r.title,
      term: r.term,
    });
    if (!slot) continue;

    const resolved = resolveAssignmentSubjectKey(r.subject, subjectsByKey);
    if (!resolved) {
      skippedAssignments.push({
        reason: `subject "${r.subject}" not in subject_classes`,
        title: r.title ?? "",
        subject: r.subject ?? "",
        academic_year: r.academic_year,
        class_id: r.class_id,
      });
      continue;
    }

    const maxScore = Number(r.max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      skippedAssignments.push({
        reason: `invalid max_score ${r.max_score}`,
        title: r.title ?? "",
        subject: r.subject ?? "",
        academic_year: r.academic_year,
        class_id: r.class_id,
      });
      continue;
    }

    const meta: ExamAssignmentMeta = {
      assignmentId: r.id,
      maxScore,
      title: r.title ?? "",
      examType: r.exam_type,
      classId: r.class_id,
      assignmentSubject: r.subject ?? "",
    };

    const setup = examSetupBySubject.get(resolved.key)!;
    const existing = setup[slot];
    if (!existing) {
      setup[slot] = meta;
      promotionAssignmentIds.add(r.id);
      debugLog(`linked ${slot} exam`, {
        subject: resolved.matchedName,
        via: resolved.via,
        assignment: meta,
      });
      continue;
    }

    const existingTyped = parseGradebookExamType(existing.examType);
    const newTyped = parseGradebookExamType(r.exam_type);
    if (!existingTyped && newTyped) {
      promotionAssignmentIds.delete(existing.assignmentId);
      setup[slot] = meta;
      promotionAssignmentIds.add(r.id);
    }
  }

  if (skippedAssignments.length > 0) {
    debugLog("skipped Sept/Dec-like assignments", skippedAssignments);
  }

  debugLog("promotion exam setup (Sept + Dec only)", {
    totalSubjects,
    subjects: subjectList.map(([key, { name }]) => {
      const setup = examSetupBySubject.get(key)!;
      return {
        subject: name,
        september: setup.september
          ? {
              id: setup.september.assignmentId,
              title: setup.september.title,
              class_id: setup.september.classId,
            }
          : null,
        december: setup.december
          ? {
              id: setup.december.assignmentId,
              title: setup.december.title,
              class_id: setup.december.classId,
            }
          : null,
      };
    }),
    promotionAssignmentCount: promotionAssignmentIds.size,
    promotionAssignmentIds: [...promotionAssignmentIds],
  });

  if (promotionAssignmentIds.size === 0) {
    debugLog(
      "no September/December exams linked to class subjects — all students get 0% overall"
    );
    for (const studentId of args.studentIds) {
      result.set(studentId, 0);
    }
    return result;
  }

  const scoreRows = await fetchAllRows<{
    assignment_id: string;
    student_id: string;
    score: unknown;
  }>({
    label: "promotions:teacher scores",
    fetchPage: async (from, to) =>
      await supabase
        .from("teacher_scores")
        .select("assignment_id, student_id, score")
        .in("student_id", args.studentIds)
        .range(from, to),
  });

  debugLog("teacher_scores fetched for students", {
    totalScoreRows: scoreRows?.length ?? 0,
    forPromotionAssignments: (scoreRows ?? []).filter((s) =>
      promotionAssignmentIds.has(s.assignment_id)
    ).length,
  });

  const scoreByStudentAssignment = new Map<string, unknown>();
  for (const row of scoreRows ?? []) {
    if (!promotionAssignmentIds.has(row.assignment_id)) continue;
    const cellKey = `${row.student_id}\u0000${row.assignment_id}`;
    if (!scoreByStudentAssignment.has(cellKey)) {
      scoreByStudentAssignment.set(cellKey, row.score);
    }
  }

  for (const studentId of args.studentIds) {
    const subjectBreakdown: {
      subject: string;
      september: number | null;
      december: number | null;
      subjectAverage: number;
      septScoreRaw: unknown;
      decScoreRaw: unknown;
      hasSeptExam: boolean;
      hasDecExam: boolean;
    }[] = [];
    const subjectAverages: number[] = [];

    for (const [subjectKey, { name }] of subjectList) {
      const setup = examSetupBySubject.get(subjectKey)!;

      let septPercent: number | null = null;
      let decPercent: number | null = null;
      let septRaw: unknown = null;
      let decRaw: unknown = null;

      if (setup.september) {
        septRaw = scoreByStudentAssignment.get(
          `${studentId}\u0000${setup.september.assignmentId}`
        );
        septPercent = percentFromScore(septRaw, setup.september.maxScore);
      }
      if (setup.december) {
        decRaw = scoreByStudentAssignment.get(
          `${studentId}\u0000${setup.december.assignmentId}`
        );
        decPercent = percentFromScore(decRaw, setup.december.maxScore);
      }

      const subjectAvg = subjectAverageFromPromotionExams(
        setup,
        septPercent,
        decPercent
      );
      subjectAverages.push(subjectAvg);
      subjectBreakdown.push({
        subject: name,
        september: setup.september ? (septPercent ?? 0) : null,
        december: setup.december ? (decPercent ?? 0) : null,
        subjectAverage: subjectAvg,
        septScoreRaw: septRaw,
        decScoreRaw: decRaw,
        hasSeptExam: setup.september != null,
        hasDecExam: setup.december != null,
      });
    }

    const overall = overallAverageFromSubjectAverages(
      subjectAverages,
      totalSubjects
    );
    result.set(studentId, overall);

    debugLog(`student ${studentId}`, {
      overallAverage: overall,
      totalSubjects,
      formula: `sum(${subjectAverages.join(" + ")}) / ${totalSubjects}`,
      subjects: subjectBreakdown,
    });
  }

  return result;
}
