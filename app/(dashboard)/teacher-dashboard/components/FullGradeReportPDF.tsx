"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SegmentStatsPdf {
  combinedPct: string;
  combinedLetter: string;
  combinedCount: number;
  boysPct: string;
  boysLetter: string;
  boysCount: number;
  girlsPct: string;
  girlsLetter: string;
  girlsCount: number;
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
  passing: SegmentStatsPdf;
  failing: SegmentStatsPdf;
  dist: { A: number; B: number; C: number; D: number; F: number };
  ranking: RankingRowPdf[];
  rows: {
    name: string;
    gender: string;
    /** e.g. "56%" */
    scorePct: string;
    grade: string;
    remarks: string;
  }[];
}

function writeSegmentStats(
  doc: jsPDF,
  margin: number,
  y: number,
  title: string,
  subtitle: string,
  seg: SegmentStatsPdf
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
    `Combined average: ${seg.combinedPct} (Grade: ${seg.combinedLetter}) — ${seg.combinedCount} students`,
    `Boys average: ${seg.boysPct} (Grade: ${seg.boysLetter}) — ${seg.boysCount} boys`,
    `Girls average: ${seg.girlsPct} (Grade: ${seg.girlsLetter}) — ${seg.girlsCount} girls`,
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

  y = writeSegmentStats(
    doc,
    margin,
    y,
    "Passing students",
    "Score >= 45%",
    data.passing
  );
  y = writeSegmentStats(
    doc,
    margin,
    y,
    "Failing students",
    "Score < 45%",
    data.failing
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Grade distribution (all scored)", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  const d = data.dist;
  doc.text(
    `A: ${d.A}  B: ${d.B}  C: ${d.C}  D: ${d.D}  F: ${d.F}`,
    margin,
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Student ranking (highest to lowest)", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (data.ranking.length === 0) {
    doc.text("No scores entered for this assignment.", margin, y);
    y += 6;
  } else {
    for (const r of data.ranking) {
      if (y > pageH - 28) {
        doc.addPage();
        y = margin;
      }
      const line = `${r.rank}. ${r.name}  ${r.scorePct} (${r.grade})  ${r.badge}`.trim();
      const split = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - 2 * margin);
      doc.text(split, margin, y);
      y += 3.5 * split.length + 1;
    }
    y += 4;
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
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 14 },
      4: { cellWidth: "auto" as unknown as number },
    },
    margin: { left: margin, right: margin },
  });

  const safe = (s: string) =>
    s.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
  doc.save(
    `grade-report-${safe(data.assignmentTitle)}-${safe(data.className)}.pdf`
  );
}
