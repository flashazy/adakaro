"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CoordinatorReportCardItem } from "../../coordinator/types";
import type { ReportCardPreviewData } from "../report-card-preview-types";
import {
  gradingScaleDescription,
  tanzaniaLetterGrade,
} from "@/lib/tanzania-grades";
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import {
  calculateDivision,
  ordinalSuffix,
} from "../report-card-preview-builder";
import { subjectNameToNectaCode } from "@/lib/necta-subject-code";
import { SECONDARY_BEST_SUBJECT_COUNT } from "@/lib/school-level";
import { drawPdfSchoolMottoCentered } from "./report-card-pdf-motto";

export interface ClassResultSheetPdfInput {
  schoolName: string;
  /** From school settings; optional line under the school name on PDFs. */
  schoolMotto?: string | null;
  className: string;
  schoolLevel: SchoolLevel;
  /** Human label including exam context, e.g. "Term 1 (June Terminal Report)". */
  termDisplayLabel: string;
  /** Stored term value, e.g. "Term 1" (used for NECTA exam line). */
  term: string;
  academicYear: string;
  /** Signed-in coordinator’s display name (optional). */
  coordinatorName?: string | null;
  reportCards: CoordinatorReportCardItem[];
}

const NECTA_PAGE_BG: [number, number, number] = [214, 234, 253];
const NECTA_CELL_FILL: [number, number, number] = [255, 251, 245];
const NECTA_PURPLE: [number, number, number] = [88, 28, 135];

function studentAveragePercent(preview: ReportCardPreviewData): string {
  const raws = preview.subjects
    .map((s) => s.averagePercentRaw)
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (raws.length > 0) {
    const avg = raws.reduce((a, b) => a + b, 0) / raws.length;
    return `${Math.round(avg * 10) / 10}%`;
  }
  const parsed = preview.subjects
    .map((s) => {
      const t = String(s.averagePct ?? "").trim().replace(/%/g, "");
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : null;
    })
    .filter((x): x is number => x != null);
  if (parsed.length === 0) return "—";
  const avg = parsed.reduce((a, b) => a + b, 0) / parsed.length;
  return `${Math.round(avg * 10) / 10}%`;
}

function sortForResultSheet(
  items: CoordinatorReportCardItem[]
): CoordinatorReportCardItem[] {
  return [...items].sort((a, b) => {
    const ra = a.preview.summary?.rank ?? 999999;
    const rb = b.preview.summary?.rank ?? 999999;
    if (ra !== rb) return ra - rb;
    return a.studentName.localeCompare(b.studentName, undefined, {
      sensitivity: "base",
    });
  });
}

/** Females first, then males; unknown/null sex last. */
function nectaMainTableGenderOrder(
  g: CoordinatorReportCardItem["gender"]
): number {
  if (g === "female") return 0;
  if (g === "male") return 1;
  return 2;
}

/** NECTA MAIN RESULTS: females first, then males; A–Z by name within each group. */
function sortForNectaMainTable(
  items: CoordinatorReportCardItem[]
): CoordinatorReportCardItem[] {
  return [...items].sort((a, b) => {
    const bySex = nectaMainTableGenderOrder(a.gender) - nectaMainTableGenderOrder(b.gender);
    if (bySex !== 0) return bySex;
    return a.studentName.localeCompare(b.studentName, undefined, {
      sensitivity: "base",
    });
  });
}

function meanNumeric(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function divisionColumnKey(
  label: string | null | undefined
): "I" | "II" | "III" | "IV" | "0" {
  const l = (label ?? "0").trim();
  if (l === "I") return "I";
  if (l === "II") return "II";
  if (l === "III") return "III";
  if (l === "IV") return "IV";
  return "0";
}

type DivSummaryKey =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "0"
  | "INC"
  | "ABS";

type DivCounts = Record<
  "I" | "II" | "III" | "IV" | "0" | "INC" | "ABS",
  number
>;

function emptyDivCounts(): DivCounts {
  return { I: 0, II: 0, III: 0, IV: 0, "0": 0, INC: 0, ABS: 0 };
}

/** Secondary letter grade A–F only (matches report-card footer). */
function normalizeSecondaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDEF".includes(c)) return c;
  return null;
}

/** Letter shown on the sheet: explicit grade or derived from term average %. */
function effectiveSecondaryGradeForNecta(
  s: ReportCardPreviewData["subjects"][number]
): string | null {
  const g = normalizeSecondaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return tanzaniaLetterGrade(s.averagePercentRaw, "secondary");
  }
  return null;
}

/**
 * Grade letter for NECTA when the subject has at least one major-exam
 * (gradebook) score; otherwise `'X'` (no April/June terminal entries).
 */
function nectaSubjectGradeLetterOrX(
  s: ReportCardPreviewData["subjects"][number]
): string {
  /** Only April/June (or term equivalents); omitting the flag must not fall back to legacy grades. */
  if (s.hasMajorExamScore !== true) return "X";
  return effectiveSecondaryGradeForNecta(s) ?? "X";
}

/** At least one assessed subject with a gradebook midterm/terminal score. */
function subjectHasScoreForNectaPresence(
  s: ReportCardPreviewData["subjects"][number]
): boolean {
  if (s.hasMajorExamScore !== true) return false;
  return effectiveSecondaryGradeForNecta(s) != null;
}

/** Subjects with at least one major-exam score and a printable letter grade. */
function scoredSubjectsForNecta(
  preview: ReportCardPreviewData
): ReportCardPreviewData["subjects"] {
  return preview.subjects.filter((s) => subjectHasScoreForNectaPresence(s));
}

function nectaAggtAndDiv(preview: ReportCardPreviewData): {
  aggt: string;
  div: string;
} {
  const scored = scoredSubjectsForNecta(preview);
  const n = scored.length;
  if (n === 0) {
    return { aggt: "-", div: "ABS" };
  }
  if (n < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const withGrade = scored
    .map((s) => ({
      avg: s.averagePercentRaw ?? 0,
      grade: effectiveSecondaryGradeForNecta(s),
    }))
    .filter((p): p is { avg: number; grade: string } => p.grade != null);
  if (withGrade.length < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const best7 = [...withGrade]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, SECONDARY_BEST_SUBJECT_COUNT);
  const calc = calculateDivision(best7.map((p) => p.grade));
  if (!calc) {
    return { aggt: "-", div: "INC" };
  }
  return {
    aggt: String(Math.round(calc.totalPoints)),
    div: calc.division,
  };
}

function bucketForDivisionSummary(r: CoordinatorReportCardItem): DivSummaryKey {
  const { div } = nectaAggtAndDiv(r.preview);
  if (div === "ABS" || div === "INC") return div;
  return divisionColumnKey(div);
}

/**
 * NECTA-style line: every enrolled subject is listed; real grade only when
 * there is a gradebook midterm/terminal score; otherwise `'X'`.
 */
function buildDetailedSubjectsLine(preview: ReportCardPreviewData): string {
  const sorted = [...preview.subjects].sort((a, b) =>
    a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" })
  );
  if (sorted.length === 0) return "—";
  const parts: string[] = [];
  for (const s of sorted) {
    const code = subjectNameToNectaCode(s.subject);
    const g = nectaSubjectGradeLetterOrX(s);
    parts.push(`${code} - '${g}'`);
  }
  return parts.join(" ");
}

function sexLetter(
  gender: CoordinatorReportCardItem["gender"]
): "F" | "M" | "—" {
  if (gender === "female") return "F";
  if (gender === "male") return "M";
  return "—";
}

function buildNectaDivisionPerformanceRows(
  reportCards: CoordinatorReportCardItem[]
): { F: DivCounts; M: DivCounts; T: DivCounts } {
  const F = emptyDivCounts();
  const M = emptyDivCounts();
  const T = emptyDivCounts();
  for (const r of reportCards) {
    const key = bucketForDivisionSummary(r);
    T[key] += 1;
    if (r.gender === "female") F[key] += 1;
    else if (r.gender === "male") M[key] += 1;
  }
  return { F, M, T };
}

function drawNectaPageBackground(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...NECTA_PAGE_BG);
  doc.rect(0, 0, w, h, "F");
}

function buildNectaSecondaryPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  const {
    schoolName,
    schoolMotto,
    className,
    term,
    academicYear,
    coordinatorName,
    reportCards,
  } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const examTitle = `${className.trim().toUpperCase()} TERMINAL RESULTS - ${term.toUpperCase()} ${academicYear}`;

  drawNectaPageBackground(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(schoolName, pageW / 2, 18, { align: "center" });
  let yHead = 18 + 8;
  yHead = drawPdfSchoolMottoCentered(doc, pageW / 2, yHead, schoolMotto, "times");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const yExam = yHead;
  doc.text(examTitle, pageW / 2, yExam, { align: "center" });
  const coord = (coordinatorName ?? "").trim();
  if (coord) {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Class coordinator: ${coord}`, pageW / 2, yExam + 7, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
  }

  /** Same vertical gap as legacy layout: exam baseline + 14 mm to first table. */
  let y = yExam + 14;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("DIVISION PERFORMANCE SUMMARY", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const { F, M, T } = buildNectaDivisionPerformanceRows(reportCards);
  const divHead = [["SEX", "I", "II", "III", "IV", "0", "INC", "ABS"]];
  const divBody = [
    [
      "F",
      String(F.I),
      String(F.II),
      String(F.III),
      String(F.IV),
      String(F["0"]),
      String(F.INC),
      String(F.ABS),
    ],
    [
      "M",
      String(M.I),
      String(M.II),
      String(M.III),
      String(M.IV),
      String(M["0"]),
      String(M.INC),
      String(M.ABS),
    ],
    [
      "T",
      String(T.I),
      String(T.II),
      String(T.III),
      String(T.IV),
      String(T["0"]),
      String(T.INC),
      String(T.ABS),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: divHead,
    body: divBody,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1.8,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastDivY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastDivY ?? y + 30) + 8;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("MAIN RESULTS", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const orderedMain = sortForNectaMainTable(reportCards);
  const mainHead = [
    [
      "S/N",
      "CNO",
      "STUDENT NAME",
      "SEX",
      "AGGT",
      "DIV",
      "DETAILED SUBJECTS",
    ],
  ];
  const mainBody = orderedMain.map((r, idx) => {
    const sn = String(idx + 1);
    const cno = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const { aggt, div } = nectaAggtAndDiv(r.preview);
    const detail = buildDetailedSubjectsLine(r.preview);
    return [sn, cno, name, sex, aggt, div, detail];
  });

  /** Fixed widths (mm); last column uses remaining table width for wrapping. */
  const mainTableInnerWidth = pageW - margin * 2;
  const MAIN_COL_SN_MM = 8;
  const MAIN_COL_CNO_MM = 15;
  const MAIN_COL_NAME_MM = 35;
  const MAIN_COL_SEX_MM = 10;
  const MAIN_COL_AGGT_MM = 12;
  const MAIN_COL_DIV_MM = 12;
  const MAIN_COL_FIXED_SUM_MM =
    MAIN_COL_SN_MM +
    MAIN_COL_CNO_MM +
    MAIN_COL_NAME_MM +
    MAIN_COL_SEX_MM +
    MAIN_COL_AGGT_MM +
    MAIN_COL_DIV_MM;
  const MAIN_COL_DETAIL_MM = mainTableInnerWidth - MAIN_COL_FIXED_SUM_MM;

  autoTable(doc, {
    startY: y,
    head: mainHead,
    body: mainBody.length
      ? mainBody
      : [["—", "—", "—", "—", "—", "—", "No students"]],
    theme: "grid",
    tableWidth: mainTableInnerWidth,
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: MAIN_COL_SN_MM },
      1: { cellWidth: MAIN_COL_CNO_MM },
      2: { cellWidth: MAIN_COL_NAME_MM },
      3: { cellWidth: MAIN_COL_SEX_MM },
      4: { cellWidth: MAIN_COL_AGGT_MM },
      5: { cellWidth: MAIN_COL_DIV_MM },
      6: {
        cellWidth: MAIN_COL_DETAIL_MM,
        fontSize: 7,
        overflow: "linebreak",
      },
    },
    margin: { left: margin, right: margin },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastMainY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastMainY ?? y + 40) + 6;

  if (y > doc.internal.pageSize.getHeight() - 24) {
    doc.addPage();
    drawNectaPageBackground(doc);
    y = margin;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    "AGGT = sum of grade points from best 7 scored subjects (A=1 … F=5). DIV = Division from that aggregate. INC = incomplete (<7 scored). ABS = absent (0 scored).",
    margin,
    y
  );
  y += 4;
  doc.text(
    `Grading scale: ${gradingScaleDescription("secondary")}.`,
    margin,
    y
  );
  y += 4;
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    y
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`class-result-sheet-${filenameSafe}.pdf`);
}

function buildPrimaryClassResultSheetPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  const {
    schoolName,
    schoolMotto,
    className,
    schoolLevel,
    termDisplayLabel,
    academicYear,
    coordinatorName,
    reportCards,
  } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - margin * 2;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName, pageW / 2, y, { align: "center" });
  y += 8;
  y = drawPdfSchoolMottoCentered(doc, pageW / 2, y, schoolMotto, "helvetica");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Class result sheet", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "For display on notice boards · Print on A4 portrait",
    pageW / 2,
    y,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Class / Form: ${className}`, margin, y);
  y += 5;
  doc.text(`Term: ${termDisplayLabel}`, margin, y);
  y += 5;
  doc.text(`Academic year: ${academicYear}`, margin, y);
  y += 5;
  const coord = (coordinatorName ?? "").trim();
  if (coord) {
    doc.text(`Class coordinator: ${coord}`, margin, y);
    y += 5;
  }
  doc.text(
    "Level: Primary (ranking: total marks across all subjects)",
    margin,
    y
  );
  y += 8;

  const ordered = sortForResultSheet(reportCards);
  const head: string[][] = [
    ["SN", "Student name", "Position", "Total marks", "Average %"],
  ];

  const body = ordered.map((r, idx) => {
    const sum = r.preview.summary;
    const pos =
      sum?.rank != null && sum.totalStudents > 0
        ? `${ordinalSuffix(sum.rank)} of ${sum.totalStudents}`
        : "—";
    const totalMarks =
      sum?.totalScore != null ? String(sum.totalScore) : "—";
    const avgPct = studentAveragePercent(r.preview);
    return [String(idx + 1), r.studentName, pos, totalMarks, avgPct];
  });

  const totals = ordered
    .map((r) => r.preview.summary?.totalScore)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const classMeanTotal = meanNumeric(totals);
  const avgPercents = ordered
    .map((r) => {
      const raw = studentAveragePercent(r.preview);
      const n = parseFloat(raw.replace(/%/g, ""));
      return Number.isFinite(n) ? n : null;
    })
    .filter((x): x is number => x != null);
  const classMeanPct = meanNumeric(avgPercents);

  const rankOnes = ordered.filter((r) => r.preview.summary?.rank === 1);
  const topLine =
    rankOnes.length > 0
      ? rankOnes.map((r) => r.studentName).join(", ")
      : "—";

  autoTable(doc, {
    startY: y,
    head,
    body: body.length ? body : [["—", "No students", "—", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  const lastY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastY ?? y + 40) + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const summaryLines = [
    `Students on this list: ${reportCards.length}`,
    `Class mean (total marks): ${
      classMeanTotal != null ? `${Math.round(classMeanTotal * 10) / 10}` : "—"
    }`,
    `Class mean (average %): ${
      classMeanPct != null ? `${Math.round(classMeanPct * 10) / 10}%` : "—"
    }`,
    `Top position (${ordinalSuffix(1)}): ${topLine}`,
  ];
  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(line, usable);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4;
  }
  y += 4;

  doc.setTextColor(80, 80, 80);
  doc.text(
    `Grading: ${gradingScaleDescription(schoolLevel)}.`,
    margin,
    y
  );
  doc.setTextColor(0, 0, 0);
  y += 4;

  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    y
  );
  y += 10;

  doc.setFontSize(10);
  doc.text(
    "Class coordinator: ___________________________",
    margin,
    y
  );
  y += 10;
  doc.text("Head teacher: ___________________________", margin, y);

  doc.save(`class-result-sheet-${filenameSafe}.pdf`);
}

export function downloadClassResultSheetPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  // NECTA layout is secondary-only; normalize so stray casing / values never
  // pick the NECTA branch for primary schools.
  const level = normalizeSchoolLevel(input.schoolLevel);
  if (level === "secondary") {
    buildNectaSecondaryPdf(input, filenameSafe);
  } else {
    buildPrimaryClassResultSheetPdf(input, filenameSafe);
  }
}
