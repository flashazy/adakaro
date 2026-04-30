"use client";

import jsPDF from "jspdf";
import autoTable, {
  type FontStyle,
  type HAlignType,
  type OverflowType,
  type StandardFontType,
  type VAlignType,
} from "jspdf-autotable";
import { passingThresholdPercent } from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";

/** Lines include Tanzania letter after the count, e.g. `80% (4 out of 5 students) (A)`. */
export interface PassRateStatsPdf {
  passRateLine: string;
  boysLine: string;
  girlsLine: string;
}

export interface FailRateStatsPdf {
  failRateLine: string;
  boysLine: string;
  girlsLine: string;
}

export interface RankingRowPdf {
  rank: number;
  name: string;
  scorePct: string;
  grade: string;
  badge: string;
}

export interface FullGradeReportPdfInput {
  schoolName: string;
  className: string;
  subject: string;
  teacherName: string;
  termLabel: string;
  dateLabel: string;
  /** Selected assignment only */
  assignmentTitle: string;
  assignmentMaxScore: number;
  passing: PassRateStatsPdf;
  failing: FailRateStatsPdf;
  /**
   * Grade buckets for both tiers. Renderer picks E (primary) or F (secondary)
   * based on `schoolLevel`.
   */
  dist: { A: number; B: number; C: number; D: number; E: number; F: number };
  ranking: RankingRowPdf[];
  /** School grading tier; defaults to "secondary" so legacy callers work. */
  schoolLevel?: SchoolLevel;
  rows: {
    name: string;
    gender: string;
    /** e.g. "56%" */
    scorePct: string;
    grade: string;
    remarks: string;
  }[];
}

/**
 * Helvetica has no emoji / pictograph glyphs — strip them plus joiners/variation selectors
 * so PDFs stay clean while keeping ordinary letters (including accented), digits, and punctuation.
 */
function sanitizeMarksReportPdfText(value: string): string {
  if (!value) return "";
  let s = value.normalize("NFC");
  s = s.replace(
    /\uFE0F|\u200D|\u231A|\u231B|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F100}-\u{1F251}]|[\u{1F1E6}-\u{1F1FF}]/gu,
    ""
  );
  return s.replace(/\s+/g, " ").trim();
}

function writePassRates(
  doc: jsPDF,
  margin: number,
  y: number,
  title: string,
  subtitle: string,
  seg: PassRateStatsPdf
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(subtitle, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4.5;
  doc.setFontSize(9);
  const lines = [
    `Pass rate: ${seg.passRateLine}`,
    `Boys pass rate: ${seg.boysLine}`,
    `Girls pass rate: ${seg.girlsLine}`,
  ];
  for (const line of lines) {
    doc.text(sanitizeMarksReportPdfText(line), margin, y);
    y += 4;
  }
  return y + 2;
}

function writeFailRates(
  doc: jsPDF,
  margin: number,
  y: number,
  title: string,
  subtitle: string,
  seg: FailRateStatsPdf
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(subtitle, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4.5;
  doc.setFontSize(9);
  const lines = [
    `Fail rate: ${seg.failRateLine}`,
    `Boys fail rate: ${seg.boysLine}`,
    `Girls fail rate: ${seg.girlsLine}`,
  ];
  for (const line of lines) {
    doc.text(sanitizeMarksReportPdfText(line), margin, y);
    y += 4;
  }
  return y + 2;
}

export function downloadFullGradeReportPdf(data: FullGradeReportPdfInput): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;
  const pageH = doc.internal.pageSize.getHeight();
  /**
   * Width available for tables on every page = page width minus the
   * left/right margins. We use this as the basis for percentage-based
   * column widths so the tables stretch edge-to-edge instead of
   * collapsing to the sum of their fixed mm widths and leaving big
   * empty space on the right.
   */
  const contentW = doc.internal.pageSize.getWidth() - margin * 2;

  const schoolLine = sanitizeMarksReportPdfText(data.schoolName);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(schoolLine.toUpperCase(), doc.internal.pageSize.getWidth() / 2, y, {
    align: "center",
  });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(
    sanitizeMarksReportPdfText(`${data.className} — ${data.subject}`),
    doc.internal.pageSize.getWidth() / 2,
    y,
    {
      align: "center",
    }
  );
  y += 5;
  doc.setFontSize(10);
  doc.text(
    `Teacher: ${sanitizeMarksReportPdfText(data.teacherName)}`,
    margin,
    y
  );
  y += 5;
  doc.text(`Term: ${sanitizeMarksReportPdfText(data.termLabel)}`, margin, y);
  y += 5;
  doc.text(`Date: ${sanitizeMarksReportPdfText(data.dateLabel)}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(
    `Assignment: ${sanitizeMarksReportPdfText(data.assignmentTitle)} (max ${data.assignmentMaxScore})`,
    margin,
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Class statistics (this assignment)", margin, y);
  y += 6;

  const passingPct = passingThresholdPercent(data.schoolLevel);
  y = writePassRates(
    doc,
    margin,
    y,
    "Passing students",
    `Score >= ${passingPct}%`,
    data.passing
  );
  y = writeFailRates(
    doc,
    margin,
    y,
    "Failing students",
    `Score < ${passingPct}%`,
    data.failing
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Grade distribution (all scored)", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  const d = data.dist;
  const failingLetter = data.schoolLevel === "primary" ? "E" : "F";
  const failingCount = data.schoolLevel === "primary" ? d.E : d.F;
  doc.text(
    `A: ${d.A}  B: ${d.B}  C: ${d.C}  D: ${d.D}  ${failingLetter}: ${failingCount}`,
    margin,
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Student ranking (highest to lowest)", margin, y);
  y += 4;

  if (data.ranking.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("No scores entered for this assignment.", margin, y);
    y += 6;
  } else {
    /** Left column ranks 1 … ceil(N/2); right column the rest. Same data as UI. */
    const nLen = data.ranking.length;
    const leftCount = Math.ceil(nLen / 2);
    const leftRows = data.ranking.slice(0, leftCount);
    const rightRows = data.ranking.slice(leftCount);
    const rankStartY = y;
    const rankGapMm = 3;
    const rankColW = (contentW - rankGapMm) / 2;
    const numW = rankColW * 0.14;

    const rankGrid = {
      theme: "grid" as const,
      showHead: "everyPage" as const,
      startY: rankStartY,
      head: [["#", "Student"]] as [[string, string]],
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak" as OverflowType,
        valign: "top" as VAlignType,
        lineWidth: 0.1,
        lineColor: [0, 0, 0] as [number, number, number],
      },
      headStyles: {
        fillColor: [51, 65, 85] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: "bold" as FontStyle,
        halign: "center" as HAlignType,
        lineWidth: 0.1,
        lineColor: [0, 0, 0] as [number, number, number],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245] as [number, number, number],
      },
      columnStyles: {
        0: {
          cellWidth: numW,
          halign: "right" as HAlignType,
          font: "courier" as StandardFontType,
        },
        1: {
          cellWidth: rankColW - numW,
          halign: "left" as HAlignType,
        },
      },
    };

    autoTable(doc, {
      ...rankGrid,
      margin: { left: margin, right: margin + rankColW + rankGapMm },
      tableWidth: rankColW,
      body: leftRows.map((r) => [
        String(r.rank),
        sanitizeMarksReportPdfText(r.name),
      ]),
    });

    const docExt = doc as unknown as { lastAutoTable?: { finalY: number } };
    const leftFinalY = docExt.lastAutoTable?.finalY ?? rankStartY;

    autoTable(doc, {
      ...rankGrid,
      margin: { left: margin + rankColW + rankGapMm, right: margin },
      tableWidth: rankColW,
      body: rightRows.map((r) => [
        String(r.rank),
        sanitizeMarksReportPdfText(r.name),
      ]),
    });

    const rightFinalY = docExt.lastAutoTable?.finalY ?? rankStartY;
    y = Math.max(leftFinalY, rightFinalY) + 6;
  }

  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }

  const head = [["Student", "Gender", "Score", "Grade", "Remarks"]];
  const body = data.rows.map((r) => [
    sanitizeMarksReportPdfText(r.name),
    sanitizeMarksReportPdfText(r.gender),
    sanitizeMarksReportPdfText(r.scorePct),
    sanitizeMarksReportPdfText(r.grade),
    sanitizeMarksReportPdfText(r.remarks || "—") || "—",
  ]);

  autoTable(doc, {
    startY: y,
    showHead: "everyPage",
    head,
    body,
    // Same percentage-of-content-width strategy as the ranking table
    // so the scores table also fills the page edge-to-edge on every
    // page, with cells aligned exactly under their headers.
    //   Student : 30%
    //   Gender  : 12%
    //   Score   : 15%
    //   Grade   : 13%
    //   Remarks : 30%
    //   Σ       : 100%
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: "linebreak" as OverflowType,
      valign: "top" as VAlignType,
      // Hairline border on every cell → horizontal lines between
      // rows AND vertical lines between columns.
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      // Student — left-aligned, the widest text column.
      0: { cellWidth: contentW * 0.3, halign: "left" },
      // Gender — centered.
      1: { cellWidth: contentW * 0.12, halign: "center" },
      // Score — right-aligned + monospace so the digits line up
      // perfectly down the column.
      2: { cellWidth: contentW * 0.15, halign: "right", font: "courier" },
      // Grade letter — centered, bold.
      3: { cellWidth: contentW * 0.13, halign: "center", fontStyle: "bold" },
      // Remarks — left-aligned, takes the remaining 30%.
      4: { cellWidth: contentW * 0.3, halign: "left" },
    },
    margin: { left: margin, right: margin },
  });

  const safe = (s: string) =>
    s.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
  doc.save(
    `marks-report-${safe(data.assignmentTitle)}-${safe(data.className)}.pdf`
  );
}
