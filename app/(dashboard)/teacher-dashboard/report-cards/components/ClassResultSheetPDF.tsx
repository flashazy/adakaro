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
import { calculateDivision } from "../report-card-preview-builder";
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

/** Fixed subject order on primary class result sheet PDFs. */
const PRIMARY_RESULT_SHEET_SUBJECTS = [
  "Kiswahili",
  "English",
  "Maarifa",
  "Hisabati",
  "Science",
  "Uraia",
] as const;

const NECTA_PAGE_BG: [number, number, number] = [214, 234, 253];
const NECTA_CELL_FILL: [number, number, number] = [255, 251, 245];
const NECTA_PURPLE: [number, number, number] = [88, 28, 135];

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

/** Primary A–E only (matches primary report-card scale). */
function normalizePrimaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDE".includes(c)) return c;
  return null;
}

function findPreviewSubjectForPrimary(
  preview: ReportCardPreviewData,
  canonical: string
): ReportCardPreviewData["subjects"][number] | undefined {
  const target = canonical.trim().toLowerCase();
  return preview.subjects.find(
    (s) => s.subject.trim().toLowerCase() === target
  );
}

/** Mid-band % for averaging when only a letter grade is present. */
function primaryGradeLetterMidpointPercent(letter: string): number {
  switch (letter) {
    case "A":
      return 91;
    case "B":
      return 71;
    case "C":
      return 51;
    case "D":
      return 31;
    case "E":
      return 10;
    default:
      return NaN;
  }
}

function percentForPrimaryAveraging(
  s: ReportCardPreviewData["subjects"][number]
): number | null {
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return s.averagePercentRaw;
  }
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) {
    const mid = primaryGradeLetterMidpointPercent(g);
    return Number.isFinite(mid) ? mid : null;
  }
  return null;
}

function effectivePrimarySubjectGradeLetter(
  s: ReportCardPreviewData["subjects"][number] | undefined
): string | null {
  if (!s) return null;
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    const fromPct = tanzaniaLetterGrade(s.averagePercentRaw, "primary");
    return fromPct === "—" ? null : fromPct;
  }
  return null;
}

function primarySheetAverageGradeLetter(
  preview: ReportCardPreviewData
): string {
  const pcts: number[] = [];
  for (const name of PRIMARY_RESULT_SHEET_SUBJECTS) {
    const row = findPreviewSubjectForPrimary(preview, name);
    if (!row) continue;
    const p = percentForPrimaryAveraging(row);
    if (p != null) pcts.push(p);
  }
  if (pcts.length === 0) return "X";
  const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const letter = tanzaniaLetterGrade(mean, "primary");
  return letter === "—" ? "X" : letter;
}

function buildPrimarySubjectsColumn(preview: ReportCardPreviewData): string {
  const parts = PRIMARY_RESULT_SHEET_SUBJECTS.map((name) => {
    const row = findPreviewSubjectForPrimary(preview, name);
    const letter = effectivePrimarySubjectGradeLetter(row);
    return `${name} - ${letter ?? "X"}`;
  });
  const avg = primarySheetAverageGradeLetter(preview);
  parts.push(`Average Grade - ${avg}`);
  return parts.join(", ");
}

type PrimarySheetGradeBucket = "A" | "B" | "C" | "D" | "E";

function emptyPrimaryGradeBuckets(): Record<PrimarySheetGradeBucket, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

/**
 * Counts A–E subject grades (fixed primary subjects only; X / missing excluded)
 * by gender for the passing-grades summary table.
 */
function buildPrimaryPassingGradeSummaryRows(
  reportCards: CoordinatorReportCardItem[]
): {
  F: Record<PrimarySheetGradeBucket, number>;
  M: Record<PrimarySheetGradeBucket, number>;
  T: Record<PrimarySheetGradeBucket, number>;
} {
  const F = emptyPrimaryGradeBuckets();
  const M = emptyPrimaryGradeBuckets();
  const T = emptyPrimaryGradeBuckets();

  for (const r of reportCards) {
    for (const subjName of PRIMARY_RESULT_SHEET_SUBJECTS) {
      const row = findPreviewSubjectForPrimary(r.preview, subjName);
      const letter = effectivePrimarySubjectGradeLetter(row);
      if (!letter || !"ABCDE".includes(letter)) continue;
      const k = letter as PrimarySheetGradeBucket;
      T[k] += 1;
      if (r.gender === "female") F[k] += 1;
      else if (r.gender === "male") M[k] += 1;
    }
  }
  return { F, M, T };
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
      "ADN",
      "STUDENT NAME",
      "SEX",
      "AGGT",
      "DIV",
      "DETAILED SUBJECTS",
    ],
  ];
  const mainBody = orderedMain.map((r, idx) => {
    const sn = String(idx + 1);
    const adn = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const { aggt, div } = nectaAggtAndDiv(r.preview);
    const detail = buildDetailedSubjectsLine(r.preview);
    return [sn, adn, name, sex, aggt, div, detail];
  });

  /** Fixed widths (mm); last column uses remaining table width for wrapping. */
  const mainTableInnerWidth = pageW - margin * 2;
  const MAIN_COL_SN_MM = 8;
  const MAIN_COL_ADN_MM = 15;
  const MAIN_COL_NAME_MM = 35;
  const MAIN_COL_SEX_MM = 10;
  const MAIN_COL_AGGT_MM = 12;
  const MAIN_COL_DIV_MM = 12;
  const MAIN_COL_FIXED_SUM_MM =
    MAIN_COL_SN_MM +
    MAIN_COL_ADN_MM +
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
      1: { cellWidth: MAIN_COL_ADN_MM },
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
    term,
    academicYear,
    coordinatorName,
    schoolLevel,
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

  /** Same as Secondary: exam baseline + 14 mm to first table. */
  let y = yExam + 14;

  const primaryTableInnerWidth = pageW - margin * 2;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("OVERALL PASSING GRADES SUMMARY", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const { F: pgF, M: pgM, T: pgT } =
    buildPrimaryPassingGradeSummaryRows(reportCards);
  const gradeSummaryHead = [["GENDER", "A", "B", "C", "D", "E"]];
  const gradeSummaryBody = [
    [
      "FEMALE",
      String(pgF.A),
      String(pgF.B),
      String(pgF.C),
      String(pgF.D),
      String(pgF.E),
    ],
    [
      "MALE",
      String(pgM.A),
      String(pgM.B),
      String(pgM.C),
      String(pgM.D),
      String(pgM.E),
    ],
    [
      "TOTAL",
      String(pgT.A),
      String(pgT.B),
      String(pgT.C),
      String(pgT.D),
      String(pgT.E),
    ],
  ];
  const GS_GENDER_MM = 32;
  const GS_GRADE_MM = (primaryTableInnerWidth - GS_GENDER_MM) / 5;

  autoTable(doc, {
    startY: y,
    head: gradeSummaryHead,
    body: gradeSummaryBody,
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
    tableWidth: primaryTableInnerWidth,
    columnStyles: {
      0: { cellWidth: GS_GENDER_MM },
      1: { cellWidth: GS_GRADE_MM, halign: "center" },
      2: { cellWidth: GS_GRADE_MM, halign: "center" },
      3: { cellWidth: GS_GRADE_MM, halign: "center" },
      4: { cellWidth: GS_GRADE_MM, halign: "center" },
      5: { cellWidth: GS_GRADE_MM, halign: "center" },
    },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastPassingSummaryY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastPassingSummaryY ?? y + 28) + 8;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("MAIN RESULTS", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const ordered = sortForNectaMainTable(reportCards);
  const PR_COL_SN_MM = 8;
  const PR_COL_ADN_MM = 15;
  const PR_COL_NAME_MM = 35;
  const PR_COL_SEX_MM = 10;
  const PR_COL_SUBJECTS_MM =
    primaryTableInnerWidth -
    PR_COL_SN_MM -
    PR_COL_ADN_MM -
    PR_COL_NAME_MM -
    PR_COL_SEX_MM;

  const head: string[][] = [
    ["S/N", "ADN", "STUDENT NAME", "SEX", "SUBJECTS"],
  ];

  const body = ordered.map((r, idx) => {
    const sn = String(idx + 1);
    const adn = (r.admissionNumber ?? "").trim() || "—";
    const name = (r.studentName ?? "").trim() || "—";
    const sex = sexLetter(r.gender);
    const subjects = buildPrimarySubjectsColumn(r.preview);
    return [sn, adn, name, sex, subjects];
  });

  autoTable(doc, {
    startY: y,
    head,
    body: body.length ? body : [["—", "—", "—", "—", "No students"]],
    theme: "grid",
    tableWidth: primaryTableInnerWidth,
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
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: PR_COL_SN_MM },
      1: { cellWidth: PR_COL_ADN_MM },
      2: { cellWidth: PR_COL_NAME_MM },
      3: { cellWidth: PR_COL_SEX_MM },
      4: {
        cellWidth: PR_COL_SUBJECTS_MM,
        fontSize: 7,
        overflow: "linebreak",
      },
    },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastY ?? y + 40) + 6;

  if (y > doc.internal.pageSize.getHeight() - 24) {
    doc.addPage();
    drawNectaPageBackground(doc);
    y = margin;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Grading scale: ${gradingScaleDescription(schoolLevel)}.`,
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
