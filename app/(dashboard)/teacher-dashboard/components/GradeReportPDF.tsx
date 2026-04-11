"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface GradeReportExportData {
  schoolName: string;
  className: string;
  subject: string;
  assignmentTitle: string;
  teacherName: string;
  dateLabel: string;
  rows: {
    name: string;
    genderLabel: string;
    score: string;
    grade: string;
    remarks: string;
  }[];
  stats: {
    combinedAvg: string;
    boysAvg: string;
    boysCount: number;
    girlsAvg: string;
    girlsCount: number;
    dist: { A: number; B: number; C: number; D: number; F: number };
  };
}

/** Percentage (0–100) from raw score and max. */
export function tanzaniaPercentFromScore(
  score: number,
  max: number
): number | null {
  if (max <= 0 || !Number.isFinite(score)) return null;
  return Math.round((score / max) * 1000) / 10;
}

/** Tanzania letter grade from percentage (75–100 = A, etc.). */
export function tanzaniaLetterGrade(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  if (percent >= 75) return "A";
  if (percent >= 65) return "B";
  if (percent >= 45) return "C";
  if (percent >= 30) return "D";
  return "F";
}

export function tanzaniaGradeBadgeClass(letter: string): string {
  switch (letter) {
    case "A":
      return "text-emerald-700 dark:text-emerald-400 font-semibold";
    case "B":
      return "text-blue-700 dark:text-blue-400 font-semibold";
    case "C":
      return "text-amber-600 dark:text-amber-400 font-semibold";
    case "D":
      return "text-orange-600 dark:text-orange-400 font-semibold";
    case "F":
      return "text-red-600 dark:text-red-400 font-semibold";
    default:
      return "text-slate-500 dark:text-zinc-400";
  }
}

export function downloadGradeReportPdf(data: GradeReportExportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.text("Grade report", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const metaLines = [
    `School: ${data.schoolName}`,
    `Class: ${data.className}`,
    `Subject: ${data.subject}`,
    `Assignment: ${data.assignmentTitle}`,
    `Teacher: ${data.teacherName}`,
    `Date: ${data.dateLabel}`,
  ];
  for (const line of metaLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  const tableBody = data.rows.map((r) => [
    r.name,
    r.genderLabel,
    r.score,
    r.grade,
    r.remarks,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Name", "Gender", "Score", "Grade", "Remarks"]],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // jspdf-autotable extends the document with lastAutoTable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? y;
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Statistics", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const s = data.stats;
  const statLines = [
    `Combined average: ${s.combinedAvg}`,
    `Boys average: ${s.boysAvg} (n = ${s.boysCount})`,
    `Girls average: ${s.girlsAvg} (n = ${s.girlsCount})`,
    `Grade distribution — A: ${s.dist.A}, B: ${s.dist.B}, C: ${s.dist.C}, D: ${s.dist.D}, F: ${s.dist.F}`,
  ];
  for (const line of statLines) {
    const split = doc.splitTextToSize(line, 180);
    doc.text(split, margin, y);
    y += split.length * 5;
  }

  const safeName = data.assignmentTitle
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  doc.save(`grade-report-${safeName || "assignment"}.pdf`);
}
