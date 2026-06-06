import "server-only";

import {
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import { gradebookAssignmentIsOnOrAfterEnrollment } from "@/lib/parent-academic-from-enrollment";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import { GRADEBOOK_EXAM_ASSIGNMENT_TITLES } from "@/app/(dashboard)/teacher-dashboard/report-cards/constants";
import { reportAcademicYearToEnrollmentYear } from "@/lib/student-subject-enrollment-queries";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ReportCardTermValue = "Term 1" | "Term 2";

export interface StudentTermExamSlotPercents {
  exam1Pct: number | null;
  exam2Pct: number | null;
}

export interface ResolveStudentTermExamScoresParams {
  studentId: string;
  schoolId: string;
  academicYear: string;
  term: ReportCardTermValue;
  subjects: string[];
  reportClassId: string;
  /** Parent preview: omit assignments before enrollment. */
  enrollmentDate?: string | null;
}

export interface BatchResolveStudentTermExamScoresParams {
  entries: {
    studentId: string;
    reportClassId: string;
    enrollmentDate?: string | null;
  }[];
  schoolId: string;
  academicYear: string;
  term: ReportCardTermValue;
  subjects: string[];
}

const TERM_EXAM_TYPES: Record<
  ReportCardTermValue,
  { exam1: GradebookMajorExamTypeValue; exam2: GradebookMajorExamTypeValue }
> = {
  "Term 1": { exam1: "April_Midterm", exam2: "June_Terminal" },
  "Term 2": { exam1: "September_Midterm", exam2: "December_Annual" },
};

/** Reference calendar dates used to infer which class the student was in per exam slot. */
const EXAM_REFERENCE_DATES: Record<
  ReportCardTermValue,
  { exam1: string; exam2: string }
> = {
  "Term 1": { exam1: "-04-15", exam2: "-06-15" },
  "Term 2": { exam1: "-09-15", exam2: "-12-15" },
};

const NORM_TITLE_TO_EXAM_TYPE: Record<string, GradebookMajorExamTypeValue> = {
  [normalizeAssignmentTitle(GRADEBOOK_EXAM_ASSIGNMENT_TITLES.aprilMidterm)]:
    "April_Midterm",
  [normalizeAssignmentTitle(GRADEBOOK_EXAM_ASSIGNMENT_TITLES.juneTerminal)]:
    "June_Terminal",
  [normalizeAssignmentTitle(
    GRADEBOOK_EXAM_ASSIGNMENT_TITLES.septemberMidterm
  )]: "September_Midterm",
  [normalizeAssignmentTitle(GRADEBOOK_EXAM_ASSIGNMENT_TITLES.decemberAnnual)]:
    "December_Annual",
};

function normalizeAssignmentTitle(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSubjectKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseScore(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function percentFromScore(score: unknown, maxScore: number): number | null {
  const n = parseScore(score);
  if (n == null) return null;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return null;
  return Math.round((n / maxScore) * 1000) / 10;
}

function academicYearMatches(
  rowYear: string | null | undefined,
  reportYear: string
): boolean {
  const trimmed = (rowYear ?? "").trim();
  if (!trimmed) return true;
  const target = reportYear.trim();
  if (trimmed === target) return true;
  return (
    reportAcademicYearToEnrollmentYear(trimmed) ===
    reportAcademicYearToEnrollmentYear(target)
  );
}

function historyRowInReportTerm(
  effectiveAt: string,
  term: ReportCardTermValue,
  academicYear: string
): boolean {
  const { start, end } = termDateRange(term, academicYear);
  const at = effectiveAt.slice(0, 10);
  return at >= start && at <= end;
}

interface StudentClassHistoryRow {
  from_class_id: string | null;
  to_class_id: string;
  effective_at: string;
  academic_year: string | null;
}

function filterHistoryForTermYear(
  rows: StudentClassHistoryRow[],
  term: ReportCardTermValue,
  academicYear: string
): StudentClassHistoryRow[] {
  return rows.filter((row) => {
    if (academicYearMatches(row.academic_year, academicYear)) return true;
    if (!(row.academic_year ?? "").trim()) {
      return historyRowInReportTerm(row.effective_at, term, academicYear);
    }
    return false;
  });
}

function classIdsForLookup(
  reportClassId: string,
  history: StudentClassHistoryRow[]
): string[] {
  const ids = new Set<string>([reportClassId]);
  for (const row of history) {
    if (row.from_class_id?.trim()) ids.add(row.from_class_id.trim());
    if (row.to_class_id?.trim()) ids.add(row.to_class_id.trim());
  }
  return [...ids];
}

function historyAscending(
  rows: StudentClassHistoryRow[]
): StudentClassHistoryRow[] {
  return [...rows].sort((a, b) =>
    a.effective_at.localeCompare(b.effective_at)
  );
}

function classAtDate(
  reportClassId: string,
  historyAsc: StudentClassHistoryRow[],
  isoDate: string
): string {
  let cls = reportClassId;
  if (historyAsc.length > 0) {
    const first = historyAsc[0];
    cls = first.from_class_id?.trim() || first.to_class_id.trim() || reportClassId;
  }
  for (const row of historyAsc) {
    if (row.effective_at <= isoDate) {
      cls = row.to_class_id.trim();
    }
  }
  return cls;
}

function examReferenceDate(
  term: ReportCardTermValue,
  slot: "exam1" | "exam2",
  academicYear: string
): string {
  const parts = academicYear.trim().split(/[-/]/);
  const startYear = parseInt(parts[0] ?? "", 10) || new Date().getFullYear();
  const y2 = startYear + 1;
  return `${y2}${EXAM_REFERENCE_DATES[term][slot]}`;
}

function resolveExamType(
  examTypeRaw: string | null,
  title: string
): GradebookMajorExamTypeValue | null {
  return (
    parseGradebookExamType(examTypeRaw) ??
    inferMajorExamTypeFromTitle(title) ??
    NORM_TITLE_TO_EXAM_TYPE[normalizeAssignmentTitle(title)] ??
    null
  );
}

function slotForExamType(
  term: ReportCardTermValue,
  examType: GradebookMajorExamTypeValue
): "exam1" | "exam2" | null {
  const wanted = TERM_EXAM_TYPES[term];
  if (examType === wanted.exam1) return "exam1";
  if (examType === wanted.exam2) return "exam2";
  return null;
}

interface AssignmentCandidate {
  assignmentId: string;
  classId: string;
  subjectKey: string;
  slot: "exam1" | "exam2";
  maxScore: number;
  updatedAt: string;
  pct: number;
}

interface ScorePickContext {
  studentId: string;
  reportClassId: string;
  historyAsc: StudentClassHistoryRow[];
  term: ReportCardTermValue;
  academicYear: string;
}

function pickScorePriority(
  candidates: AssignmentCandidate[],
  ctx: ScorePickContext
): AssignmentCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const reportClassMatches = candidates.filter(
    (c) => c.classId === ctx.reportClassId
  );
  if (reportClassMatches.length === 1) return reportClassMatches[0];
  if (reportClassMatches.length > 1) {
    return pickLatestCandidate(reportClassMatches, ctx, "reportClassId");
  }

  const slot = candidates[0]?.slot;
  if (!slot) return pickLatestCandidate(candidates, ctx, "latest");

  const refDate = examReferenceDate(ctx.term, slot, ctx.academicYear);
  const classAtExam = classAtDate(ctx.reportClassId, ctx.historyAsc, refDate);
  const historyMatches = candidates.filter((c) => c.classId === classAtExam);
  if (historyMatches.length === 1) return historyMatches[0];
  if (historyMatches.length > 1) {
    return pickLatestCandidate(historyMatches, ctx, "historyClass");
  }

  return pickLatestCandidate(candidates, ctx, "latest");
}

function pickLatestCandidate(
  candidates: AssignmentCandidate[],
  ctx: ScorePickContext,
  reason: "reportClassId" | "historyClass" | "latest"
): AssignmentCandidate {
  const sorted = [...candidates].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  const winner = sorted[0]!;
  if (candidates.length > 1 && reason === "latest") {
    console.warn(
      "[resolveStudentTermExamScores] duplicate exam scores; using latest",
      {
        studentId: ctx.studentId,
        reportClassId: ctx.reportClassId,
        subjectKey: winner.subjectKey,
        slot: winner.slot,
        classIds: candidates.map((c) => c.classId),
      }
    );
  }
  return winner;
}

function emptyBySubject(
  subjects: string[]
): Map<string, StudentTermExamSlotPercents> {
  const out = new Map<string, StudentTermExamSlotPercents>();
  for (const subject of subjects) {
    const key = normalizeSubjectKey(subject);
    if (!key) continue;
    out.set(key, { exam1Pct: null, exam2Pct: null });
  }
  return out;
}

/**
 * Student-centric term exam resolver: finds gradebook marks across the report
 * class and prior classes from `student_class_history` for the same term/year.
 * Read-only — never moves or rewrites gradebook rows.
 */
export async function resolveStudentTermExamScores(
  admin: Db,
  params: ResolveStudentTermExamScoresParams
): Promise<Map<string, StudentTermExamSlotPercents>> {
  const batch = await batchResolveStudentTermExamScores(admin, {
    schoolId: params.schoolId,
    academicYear: params.academicYear,
    term: params.term,
    subjects: params.subjects,
    entries: [
      {
        studentId: params.studentId,
        reportClassId: params.reportClassId,
        enrollmentDate: params.enrollmentDate,
      },
    ],
  });
  return batch.get(params.studentId) ?? emptyBySubject(params.subjects);
}

/**
 * Batch variant for coordinator preview/generate. Returns subjectKey (lower) → slots.
 */
export async function batchResolveStudentTermExamScores(
  admin: Db,
  params: BatchResolveStudentTermExamScoresParams
): Promise<Map<string, Map<string, StudentTermExamSlotPercents>>> {
  const out = new Map<string, Map<string, StudentTermExamSlotPercents>>();
  if (params.entries.length === 0) return out;

  const subjectKeys = [
    ...new Set(
      params.subjects
        .map((s) => normalizeSubjectKey(s))
        .filter((k) => k.length > 0)
    ),
  ];
  if (subjectKeys.length === 0) return out;

  const canonicalByKey = new Map<string, string>();
  for (const subject of params.subjects) {
    const key = normalizeSubjectKey(subject);
    if (key && !canonicalByKey.has(key)) canonicalByKey.set(key, subject.trim());
  }

  const studentIds = [...new Set(params.entries.map((e) => e.studentId))];
  const reportClassByStudent = new Map(
    params.entries.map((e) => [e.studentId, e.reportClassId] as const)
  );
  const enrollmentByStudent = new Map(
    params.entries.map(
      (e) => [e.studentId, e.enrollmentDate ?? null] as const
    )
  );

  for (const sid of studentIds) {
    out.set(sid, emptyBySubject(params.subjects));
  }

  const { data: historyRaw } = await admin
    .from("student_class_history")
    .select("student_id, from_class_id, to_class_id, effective_at, academic_year")
    .eq("school_id", params.schoolId.trim())
    .in("student_id", studentIds)
    .order("effective_at", { ascending: true });

  const historyByStudent = new Map<string, StudentClassHistoryRow[]>();
  for (const row of (historyRaw ?? []) as (StudentClassHistoryRow & {
    student_id: string;
  })[]) {
    const filtered = filterHistoryForTermYear(
      [
        {
          from_class_id: row.from_class_id,
          to_class_id: row.to_class_id,
          effective_at: row.effective_at,
          academic_year: row.academic_year,
        },
      ],
      params.term,
      params.academicYear
    );
    if (filtered.length === 0) continue;
    const list = historyByStudent.get(row.student_id) ?? [];
    list.push(filtered[0]!);
    historyByStudent.set(row.student_id, list);
  }

  const allClassIds = new Set<string>();
  for (const entry of params.entries) {
    const history = historyAscending(
      historyByStudent.get(entry.studentId) ?? []
    );
    for (const id of classIdsForLookup(entry.reportClassId, history)) {
      allClassIds.add(id);
    }
  }

  if (allClassIds.size === 0) return out;

  const assignments = await fetchAllRows<{
    id: string;
    class_id: string;
    subject: string;
    title: string;
    exam_type: string | null;
    max_score: number | string;
    academic_year: string | null;
    term: string | null;
    due_date: string | null;
    created_at: string;
  }>({
    label: "report-card-term-exam-resolver:assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select(
          "id, class_id, subject, title, exam_type, max_score, academic_year, term, due_date, created_at"
        )
        .in("class_id", [...allClassIds])
        .range(from, to),
  });

  type AssignmentMeta = {
    assignmentId: string;
    classId: string;
    subjectKey: string;
    slot: "exam1" | "exam2";
    maxScore: number;
    dueDate: string | null;
    createdAt: string;
  };

  const metaByAssignmentId = new Map<string, AssignmentMeta>();
  const yearTrim = params.academicYear.trim();

  for (const row of assignments) {
    if (!academicYearMatches(row.academic_year, yearTrim)) continue;
    const assignTerm = (row.term ?? "").trim();
    if (assignTerm && assignTerm !== params.term) continue;

    const subjectKey = normalizeSubjectKey(row.subject);
    if (!subjectKeys.includes(subjectKey)) continue;

    const examType = resolveExamType(row.exam_type, row.title);
    if (!examType) continue;
    const slot = slotForExamType(params.term, examType);
    if (!slot) continue;

    const maxScore = Number(row.max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) continue;

    metaByAssignmentId.set(row.id, {
      assignmentId: row.id,
      classId: row.class_id,
      subjectKey,
      slot,
      maxScore,
      dueDate: row.due_date,
      createdAt: row.created_at,
    });
  }

  const assignmentIds = [...metaByAssignmentId.keys()];
  if (assignmentIds.length === 0) return out;

  const scoreRows = await fetchAllRows<{
    assignment_id: string;
    student_id: string;
    score: unknown;
    updated_at: string | null;
  }>({
    label: "report-card-term-exam-resolver:scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("assignment_id, student_id, score, updated_at")
        .in("student_id", studentIds)
        .in("assignment_id", assignmentIds)
        .order("updated_at", { ascending: false })
        .range(from, to),
  });

  const candidatesByStudentSubjectSlot = new Map<
    string,
    AssignmentCandidate[]
  >();

  for (const row of scoreRows) {
    const meta = metaByAssignmentId.get(row.assignment_id);
    if (!meta) continue;

    const enrollmentDate = enrollmentByStudent.get(row.student_id) ?? null;
    if (
      enrollmentDate != null &&
      !gradebookAssignmentIsOnOrAfterEnrollment(
        { due_date: meta.dueDate, created_at: meta.createdAt },
        enrollmentDate
      )
    ) {
      continue;
    }

    const pct = percentFromScore(row.score, meta.maxScore);
    if (pct == null) continue;

    const bucketKey = `${row.student_id}\u0000${meta.subjectKey}\u0000${meta.slot}`;
    const list = candidatesByStudentSubjectSlot.get(bucketKey) ?? [];
    list.push({
      assignmentId: meta.assignmentId,
      classId: meta.classId,
      subjectKey: meta.subjectKey,
      slot: meta.slot,
      maxScore: meta.maxScore,
      updatedAt: row.updated_at ?? meta.createdAt,
      pct,
    });
    candidatesByStudentSubjectSlot.set(bucketKey, list);
  }

  for (const entry of params.entries) {
    const studentOut = out.get(entry.studentId) ?? emptyBySubject(params.subjects);
    const historyAsc = historyAscending(
      historyByStudent.get(entry.studentId) ?? []
    );
    const pickCtx: ScorePickContext = {
      studentId: entry.studentId,
      reportClassId: entry.reportClassId,
      historyAsc,
      term: params.term,
      academicYear: params.academicYear,
    };

    for (const subjectKey of subjectKeys) {
      const slots: StudentTermExamSlotPercents = {
        exam1Pct: null,
        exam2Pct: null,
      };
      for (const slot of ["exam1", "exam2"] as const) {
        const bucketKey = `${entry.studentId}\u0000${subjectKey}\u0000${slot}`;
        const candidates = candidatesByStudentSubjectSlot.get(bucketKey) ?? [];
        const winner = pickScorePriority(candidates, pickCtx);
        if (winner) {
          slots[slot === "exam1" ? "exam1Pct" : "exam2Pct"] = winner.pct;
        }
      }
      studentOut.set(subjectKey, slots);
    }
    out.set(entry.studentId, studentOut);
  }

  return out;
}

/** Map slot percents to the four-bucket shape used by the teacher report editor. */
export function termExamSlotsToGradebookPercentages(
  term: ReportCardTermValue,
  slots: StudentTermExamSlotPercents
): {
  aprilMidtermPct: number | null;
  juneTerminalPct: number | null;
  septemberMidtermPct: number | null;
  decemberAnnualPct: number | null;
} {
  return {
    aprilMidtermPct: term === "Term 1" ? slots.exam1Pct : null,
    juneTerminalPct: term === "Term 1" ? slots.exam2Pct : null,
    septemberMidtermPct: term === "Term 2" ? slots.exam1Pct : null,
    decemberAnnualPct: term === "Term 2" ? slots.exam2Pct : null,
  };
}

/** Convert resolver output to coordinator preview `GradebookExamPair`. */
export function termExamSlotsToExamPair(
  slots: StudentTermExamSlotPercents
): { exam1Pct: number | null; exam2Pct: number | null } {
  return { exam1Pct: slots.exam1Pct, exam2Pct: slots.exam2Pct };
}
