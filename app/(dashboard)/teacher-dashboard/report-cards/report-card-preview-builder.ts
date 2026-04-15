import { REPORT_CARD_EXAM_LABELS, type ReportTermValue } from "./constants";
import { letterGradeFromPercent, computeReportCardTermAverage } from "./report-card-grades";
import type {
  ReportCardCommentRow,
  StudentReportRow,
} from "./report-card-types";
import type { ReportCardPreviewData } from "./report-card-preview-types";

/** Draft fields needed to align report card preview with the editor. */
export interface ReportCardExamDraftOverlay {
  comment: string;
  exam1: string;
  exam2: string;
  exam1Overridden: boolean;
  exam2Overridden: boolean;
  exam1GbOriginal: string | null;
  exam2GbOriginal: string | null;
}

function parseDraftPercentString(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merges in-memory draft exam scores and comments over server `student.comments`
 * so preview/PDF match the teacher matrix (including unsaved edits).
 */
export function mergeStudentCommentsWithDraftsForPreview(
  student: StudentReportRow,
  subjects: string[],
  draftBySubject: Record<string, ReportCardExamDraftOverlay> | undefined,
  options?: { restrictOutputToSubjects?: boolean }
): StudentReportRow {
  if (!draftBySubject) return student;

  const bySub = new Map<string, ReportCardCommentRow>(
    student.comments.map((c) => [c.subject, { ...c }])
  );
  const subjList = subjects.length > 0 ? subjects : ["General"];

  for (const subject of subjList) {
    const d = draftBySubject[subject];
    if (!d) continue;
    const prev = bySub.get(subject);
    const e1 = parseDraftPercentString(d.exam1);
    const e2 = parseDraftPercentString(d.exam2);
    const avg = computeReportCardTermAverage(e1, e2);
    const grade = avg != null ? letterGradeFromPercent(avg) : null;

    const merged: ReportCardCommentRow = {
      id: prev?.id ?? "",
      subject,
      comment:
        d.comment.trim() !== "" ? d.comment : prev?.comment ?? null,
      scorePercent: avg ?? prev?.scorePercent ?? null,
      letterGrade: grade ?? prev?.letterGrade ?? null,
      exam1Score: e1,
      exam2Score: e2,
      calculatedScore: avg,
      calculatedGrade: grade,
      exam1GradebookOriginal: d.exam1Overridden
        ? parseDraftPercentString(d.exam1GbOriginal ?? "") ??
          prev?.exam1GradebookOriginal ??
          null
        : (prev?.exam1GradebookOriginal ?? null),
      exam2GradebookOriginal: d.exam2Overridden
        ? parseDraftPercentString(d.exam2GbOriginal ?? "") ??
          prev?.exam2GradebookOriginal ??
          null
        : (prev?.exam2GradebookOriginal ?? null),
      exam1ScoreOverridden: d.exam1Overridden,
      exam2ScoreOverridden: d.exam2Overridden,
    };
    bySub.set(subject, merged);
  }

  const allComments = Array.from(bySub.values());
  const comments =
    options?.restrictOutputToSubjects === true
      ? allComments.filter((c) =>
          subjList.some(
            (s) => s.trim().toLowerCase() === c.subject.trim().toLowerCase()
          )
        )
      : allComments;

  return { ...student, comments };
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return `${Math.round(v * 10) / 10}%`;
}

function parseNum(
  v: number | string | null | undefined
): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isReportTerm(t: string): t is ReportTermValue {
  return t === "Term 1" || t === "Term 2";
}

/** Term average (Exam1+Exam2)/2 when both present; matches preview row logic. */
export function termAverageFromComment(
  c: ReportCardCommentRow | null | undefined
): number | null {
  if (!c) return null;
  let e1 = parseNum(c.exam1Score ?? null);
  let e2 = parseNum(c.exam2Score ?? null);
  if (e1 == null && e2 == null && c.scorePercent != null) {
    e1 = parseNum(c.scorePercent);
  }
  const storedCalc = parseNum(c.calculatedScore ?? null);
  const computed = computeReportCardTermAverage(e1, e2);
  const avgRaw = storedCalc ?? computed;
  return avgRaw != null && Number.isFinite(avgRaw) ? avgRaw : null;
}

/**
 * Competition-style class rank per subject: 1 + count of classmates with a strictly higher term average.
 * Only students with a computable term average participate; others get "—".
 */
export function computeClassSubjectPositions(
  allStudents: StudentReportRow[],
  subjects: string[],
  focusStudentId: string
): Record<string, string> {
  const out: Record<string, string> = {};
  const subjList = subjects.length > 0 ? subjects : ["General"];

  for (const subject of subjList) {
    const rows: { studentId: string; avg: number }[] = [];
    for (const s of allStudents) {
      const c = s.comments.find((x) => x.subject === subject);
      const avg = termAverageFromComment(c);
      if (avg != null) rows.push({ studentId: s.studentId, avg });
    }
    const focus = allStudents.find((x) => x.studentId === focusStudentId);
    const fc = focus?.comments.find((x) => x.subject === subject);
    const fAvg = termAverageFromComment(fc);
    if (fAvg == null) {
      out[subject] = "—";
      continue;
    }
    const strictlyHigher = rows.filter((r) => r.avg > fAvg).length;
    out[subject] = String(strictlyHigher + 1);
  }
  return out;
}

export function buildSubjectPreviewRows(
  term: string,
  subjects: string[],
  student: StudentReportRow,
  positionsBySubject?: Record<string, string>
): ReportCardPreviewData["subjects"] {
  const bySub = new Map(student.comments.map((c) => [c.subject, c]));
  const list = subjects.length
    ? subjects
    : [...new Set(student.comments.map((c) => c.subject))];

  return list.map((subject) => {
    const c = bySub.get(subject);
    let e1 = parseNum(c?.exam1Score ?? null);
    let e2 = parseNum(c?.exam2Score ?? null);
    if (e1 == null && e2 == null && c?.scorePercent != null) {
      e1 = parseNum(c.scorePercent);
    }
    const storedCalc = parseNum(c?.calculatedScore ?? null);
    const computed = computeReportCardTermAverage(e1, e2);
    const avgRaw = storedCalc ?? computed;
    let grade =
      c?.calculatedGrade?.trim() ||
      c?.letterGrade?.trim() ||
      "";
    if (!grade && avgRaw != null && Number.isFinite(avgRaw)) {
      grade = letterGradeFromPercent(avgRaw);
    }
    if (!grade) grade = "—";

    return {
      subject,
      exam1Pct: fmtPct(e1),
      exam2Pct: fmtPct(e2),
      exam1Overridden: c?.exam1ScoreOverridden === true,
      exam2Overridden: c?.exam2ScoreOverridden === true,
      averagePct: avgRaw != null && Number.isFinite(avgRaw) ? `${avgRaw}%` : "—",
      grade,
      position: positionsBySubject?.[subject] ?? "—",
      comment: c?.comment?.trim() ?? "",
    };
  });
}

export function reportCardExamColumnTitles(term: string): {
  exam1: string;
  exam2: string;
} {
  const labels = isReportTerm(term)
    ? REPORT_CARD_EXAM_LABELS[term]
    : REPORT_CARD_EXAM_LABELS["Term 1"];
  return {
    exam1: `${labels.exam1} (%)`,
    exam2: `${labels.exam2} (%)`,
  };
}
