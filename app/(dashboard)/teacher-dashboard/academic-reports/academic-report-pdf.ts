"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type { AtRiskStudentRow, HistoricalTermSubjectMetrics } from "@/lib/academic-report-types";
import { getRecommendedActionLines } from "@/lib/academic-report-recommendations";
import type { SubjectCompareRow } from "@/lib/academic-report-comparison";

export type { SubjectCompareRow } from "@/lib/academic-report-comparison";

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${n}%`;
}

function safeFilePart(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "Class";
}

export function buildAcademicReportPdfFileName(
  className: string,
  term: string,
  academicYear: string
): string {
  const cls = safeFilePart(className);
  const t = safeFilePart(term.replace(/\s+/g, ""));
  const y = safeFilePart(academicYear);
  return `Academic_Report_${cls}_${t}_${y}.pdf`;
}

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function tableBottom(doc: jsPDF, fallback: number): number {
  const d = doc as DocWithTable;
  return d.lastAutoTable?.finalY ?? fallback;
}

export function downloadAcademicReportPdf(args: {
  data: AcademicPerformanceReportData;
  schoolName: string;
  classTitle: string;
  generatedAtLabel: string;
  teacherName: string;
  showNectaDivision: boolean;
  compareTermLabel: string;
  compareTermId: string;
  atRiskStudents: AtRiskStudentRow[];
  subjectCompareRows: SubjectCompareRow[];
  previousTermMetricsBySubject: HistoricalTermSubjectMetrics | null;
}): void {
  const {
    data,
    schoolName,
    classTitle,
    generatedAtLabel,
    teacherName,
    showNectaDivision,
    compareTermLabel,
    compareTermId,
    atRiskStudents,
    subjectCompareRows,
    previousTermMetricsBySubject,
  } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const subTitle = (text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text, margin, y);
    y += 6;
  };

  const para = (text: string, size = 8, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.4) + 3;
    doc.setTextColor(0, 0, 0);
  };

  const ensure = (minBottom: number) => {
    if (y > pageH - minBottom) newPage();
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Academic performance report", margin, y);
  y += 9;
  doc.setFont("normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(schoolName, margin, y);
  y += 4.5;
  doc.text(`Class: ${classTitle}`, margin, y);
  y += 4.5;
  doc.text(`Term: ${data.term} ${data.academic_year}`, margin, y);
  y += 4.5;
  doc.text(`Teacher: ${teacherName || "—"}`, margin, y);
  y += 4.5;
  doc.text(`Generated: ${generatedAtLabel}`, margin, y);
  y += 4.5;
  doc.text(`Compare with: ${compareTermLabel}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  subTitle("At-risk students alert");
  if (atRiskStudents.length === 0) {
    para("No at-risk students – great job!", 9, [0, 110, 50]);
  } else {
    ensure(40);
    autoTable(doc, {
      startY: y,
      head: [["Student", "Risk reason"]],
      body: atRiskStudents.map((r) => [r.studentName, r.reason]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [185, 45, 45], textColor: 255 },
    });
    y = tableBottom(doc, y) + 8;
  }

  newPage();

  subTitle("Overall performance");
  const op = data.overall_performance;
  ensure(50);
  autoTable(doc, {
    startY: y,
    body: [
      ["Total students", String(op.total_students)],
      ["Overall pass rate", pct(op.overall_pass_rate_pct)],
      ["Overall fail rate", pct(op.overall_fail_rate_pct)],
      ["Boys pass rate", pct(op.boys_pass_rate_pct)],
      ["Girls pass rate", pct(op.girls_pass_rate_pct)],
      [
        "Boys / girls fail rate",
        `${pct(op.boys_fail_rate_pct)} / ${pct(op.girls_fail_rate_pct)}`,
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 60 } },
  });
  y = tableBottom(doc, y) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Subject averages (${compareTermLabel})`, margin, y);
  y += 6;

  const compBody = subjectCompareRows.map((r) => {
    const arr = r.arrow === "up" ? "↑" : r.arrow === "down" ? "↓" : "→";
    const diff =
      r.diffPct == null
        ? "—"
        : `${r.diffPct > 0 ? "+" : ""}${r.diffPct.toFixed(1)}%`;
    return [
      r.subject,
      r.current != null ? `${r.current}%` : "—",
      r.previous != null ? `${r.previous}%` : "No data available",
      arr,
      diff,
    ];
  });
  ensure(45);
  autoTable(doc, {
    startY: y,
    head: [["Subject", "Current avg", "Previous avg", "Δ", "Change"]],
    body: compBody.length ? compBody : [["—", "—", "—", "—", "—"]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 1.2 },
  });
  y = tableBottom(doc, y) + 4;

  const recOverall = getRecommendedActionLines({
    section: "overall",
    data,
    showNectaDivision,
    compareTermId,
    previousTermMetricsBySubject,
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 70, 110);
  doc.text("Recommended actions", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  for (const line of recOverall) {
    const ln = doc.splitTextToSize(line, pageW - 2 * margin);
    doc.text(ln, margin, y);
    y += ln.length * 3.2 + 1;
  }
  y += 4;

  if (showNectaDivision) {
    newPage();
    subTitle("Division distribution (NECTA)");
    ensure(60);
    autoTable(doc, {
      startY: y,
      head: [["Division", "Boys", "Girls", "Total"]],
      body: data.division_distribution.map((r) => [
        r.division,
        String(r.boys),
        String(r.girls),
        String(r.total),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5 },
    });
    y = tableBottom(doc, y) + 4;
    const recDiv = getRecommendedActionLines({
      section: "distribution",
      data,
      showNectaDivision,
      compareTermId,
      previousTermMetricsBySubject,
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 70, 110);
    doc.text("Recommended actions", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    for (const line of recDiv) {
      const ln = doc.splitTextToSize(line, pageW - 2 * margin);
      doc.text(ln, margin, y);
      y += ln.length * 3.2 + 1;
    }
  }

  newPage();
  subTitle("Subject ranking");
  ensure(60);
  autoTable(doc, {
    startY: y,
    head: [["Rank", "Subject", "Pass %", "Fail %", "Top grade"]],
    body: data.subject_ranking.map((r) => [
      String(r.rank),
      r.subject,
      pct(r.pass_rate_pct),
      pct(r.fail_rate_pct),
      r.top_grade ?? "—",
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 1.2 },
  });
  y = tableBottom(doc, y) + 4;
  const recSub = getRecommendedActionLines({
    section: "subject_ranking",
    data,
    showNectaDivision,
    compareTermId,
    previousTermMetricsBySubject,
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 70, 110);
  doc.text("Recommended actions", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  for (const line of recSub) {
    const ln = doc.splitTextToSize(line, pageW - 2 * margin);
    doc.text(ln, margin, y);
    y += ln.length * 3.2 + 1;
  }
  y += 4;

  newPage();
  subTitle("Teacher performance");
  ensure(60);
  autoTable(doc, {
    startY: y,
    head: [["Rank", "Subject", "Teacher", "Pass %", "Class avg %"]],
    body: data.teacher_performance.map((r) => [
      String(r.rank),
      r.subject,
      r.teacher,
      pct(r.pass_rate_pct),
      r.class_average_pct != null ? `${r.class_average_pct}%` : "—",
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 1.2 },
  });
  y = tableBottom(doc, y) + 4;
  const recTp = getRecommendedActionLines({
    section: "teacher_performance",
    data,
    showNectaDivision,
    compareTermId,
    previousTermMetricsBySubject,
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 70, 110);
  doc.text("Recommended actions", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  for (const line of recTp) {
    const ln = doc.splitTextToSize(line, pageW - 2 * margin);
    doc.text(ln, margin, y);
    y += ln.length * 3.2 + 1;
  }

  const footerPage = doc.getNumberOfPages();
  for (let i = 1; i <= footerPage; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Page ${i} of ${footerPage} · ${classTitle} · ${data.term} ${data.academic_year}`,
      margin,
      pageH - 8
    );
    doc.setTextColor(0, 0, 0);
  }

  doc.save(
    buildAcademicReportPdfFileName(classTitle, data.term, data.academic_year)
  );
}
