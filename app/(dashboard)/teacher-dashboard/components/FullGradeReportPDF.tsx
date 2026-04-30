"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
    doc.text(line, margin, y);
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
    doc.text(line, margin, y);
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

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.schoolName.toUpperCase(), doc.internal.pageSize.getWidth() / 2, y, {
    align: "center",
  });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.className} — ${data.subject}`, doc.internal.pageSize.getWidth() / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFontSize(10);
  doc.text(`Teacher: ${data.teacherName}`, margin, y);
  y += 5;
  doc.text(`Term: ${data.termLabel}`, margin, y);
  y += 5;
  doc.text(`Date: ${data.dateLabel}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(
    `Assignment: ${data.assignmentTitle} (max ${data.assignmentMaxScore})`,
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
    /**
     * The ranking section was previously rendered as
     *   `${rank}. ${name}  ${scorePct} (${grade})  ${badge}`
     * concatenated into a single `doc.text(...)` line. Because names
     * vary in width, the score / grade / badge columns visibly drifted
     * left and right from row to row — the so-called "snake movement".
     *
     * Switching to `autoTable` with fixed column widths and explicit
     * alignments fixes that, and also gives us automatic page breaks
     * + repeated headers for free.
     */
    autoTable(doc, {
      startY: y,
      // Four columns: #, Student, Score %, Grade.
      // The "Highlight" / badge column was removed earlier because it
      // printed special glyphs (medals, ⚠️ etc.) that didn't render
      // cleanly in the PDF font. The badge values still surface on
      // screen via `RankingRow.badge` — only the printed table omits
      // them.
      head: [["#", "Student", "Score %", "Grade"]],
      body: data.ranking.map((r) => [
        String(r.rank),
        r.name,
        r.scorePct,
        r.grade,
      ]),
      // `theme: "grid"` draws a full border + cell grid on every row,
      // turning the table from spaced text into a real ruled table.
      // Combined with the percentage-based column widths below, the
      // table also spans edge-to-edge on every page size.
      //   #        : 10% (rank)
      //   Student  : 50%
      //   Score %  : 20%
      //   Grade    : 20%
      //   Σ        : 100%
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
        // Hairline black border on every cell — gives us both
        // horizontal lines between rows AND vertical lines between
        // columns without further configuration.
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        // Match the body line so the header doesn't look stitched
        // onto the table.
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      // Subtle zebra striping on the body rows for scanability.
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        // Rank — right-aligned, monospace for tabular numerals.
        0: { cellWidth: contentW * 0.1, halign: "right", font: "courier" },
        // Student name — left-aligned, the widest column.
        1: { cellWidth: contentW * 0.5, halign: "left" },
        // Score % — right-aligned + monospace so digits line up
        // perfectly down the column.
        2: { cellWidth: contentW * 0.2, halign: "right", font: "courier" },
        // Grade letter — centered, bold.
        3: { cellWidth: contentW * 0.2, halign: "center", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });

    /* `lastAutoTable` is the documented way autoTable reports where it
       stopped drawing. Cast through unknown to keep the local jsPDF
       type clean without pulling in a separate jspdf-autotable
       declaration shim. */
    const after = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = (after?.finalY ?? y) + 6;
  }

  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }

  const head = [["Student", "Gender", "Score", "Grade", "Remarks"]];
  const body = data.rows.map((r) => [
    r.name,
    r.gender,
    r.scorePct,
    r.grade,
    r.remarks,
  ]);

  autoTable(doc, {
    startY: y,
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
      overflow: "linebreak",
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
