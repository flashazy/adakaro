import { REPORT_CARD_EXAM_LABELS, type ReportTermValue } from "./constants";
import { letterGradeFromPercent, computeReportCardTermAverage } from "./report-card-grades";
import type { StudentReportRow } from "./report-card-types";
import type { ReportCardPreviewData } from "./report-card-preview-types";

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

export function buildSubjectPreviewRows(
  term: string,
  subjects: string[],
  student: StudentReportRow
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
      averagePct: avgRaw != null && Number.isFinite(avgRaw) ? `${avgRaw}%` : "—",
      grade,
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
