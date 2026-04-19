"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { reportCardExamColumnTitles } from "../report-card-preview-builder";
import type { ReportCardPreviewData } from "../report-card-preview-types";

function buildPdf(doc: jsPDF, data: ReportCardPreviewData, margin: number) {
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const examHead = reportCardExamColumnTitles(data.term);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.schoolName, pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Student report card", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(data.statusLabel, pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Student: ${data.studentName}`, margin, y);
  y += 5;
  doc.text(`Class: ${data.className}`, margin, y);
  y += 5;
  doc.text(`Term: ${data.term}   Academic year: ${data.academicYear}`, margin, y);
  y += 5;
  doc.text(`Class teacher: ${data.teacherName}`, margin, y);
  y += 5;
  doc.text(`Date issued: ${data.dateIssued}`, margin, y);
  y += 8;

  const pctWithStar = (pct: string, overridden: boolean) =>
    overridden ? `${pct}*` : pct;

  const anyOverride = data.subjects.some(
    (s) => s.exam1Overridden || s.exam2Overridden
  );
  // Mirrors the on-screen logic: only show the column when something was
  // actually dropped from the best-N selection.
  const showSelectedColumn = data.subjects.some((s) => s.selected !== null);

  const buildRow = (s: ReportCardPreviewData["subjects"][number]) => {
    const base = [
      s.subject,
      pctWithStar(s.exam1Pct, s.exam1Overridden),
      pctWithStar(s.exam2Pct, s.exam2Overridden),
      s.averagePct,
      s.grade,
      s.position,
      s.comment || "—",
    ];
    if (!showSelectedColumn) return base;
    const cell =
      s.selected === true
        ? "Yes"
        : s.selected === false
          ? "(dropped)"
          : "";
    return [...base, cell];
  };

  const subBody = data.subjects.map(buildRow);
  const head = [
    [
      "Subject",
      examHead.exam1,
      examHead.exam2,
      "Average %",
      "Grade",
      "Position",
      "Teacher comment",
      ...(showSelectedColumn ? ["Selected"] : []),
    ],
  ];
  const emptyRow = showSelectedColumn
    ? ["—", "—", "—", "—", "—", "—", "No entries", ""]
    : ["—", "—", "—", "—", "—", "—", "No entries"];
  autoTable(doc, {
    startY: y,
    head,
    body: subBody.length ? subBody : [emptyRow],
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    // Highlight counted rows light green; dim dropped rows so the pdf shows
    // the same emphasis the on-screen preview does.
    didParseCell(hookData) {
      if (hookData.section !== "body" || !showSelectedColumn) return;
      const s = data.subjects[hookData.row.index];
      if (!s) return;
      if (s.selected === true) {
        hookData.cell.styles.fillColor = [236, 253, 245];
      } else if (s.selected === false) {
        hookData.cell.styles.textColor = [120, 120, 120];
      }
    },
  });

  const lastY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastY ?? y + 40) + 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  if (anyOverride) {
    doc.text(
      "* Exam score was changed after the markbook value was used.",
      margin,
      y
    );
    y += 4;
  }
  doc.text(
    "Average = (Exam 1 + Exam 2) / 2 when both scores are entered. Grading: A = 75–100%, B = 65–74%, C = 45–64%, D = 30–44%, F = 0–29%.",
    margin,
    y
  );
  y += 4;
  if (showSelectedColumn) {
    doc.setTextColor(4, 120, 87);
    doc.text(
      "Selected subjects are the best 7 used to calculate your total score.",
      margin,
      y
    );
    y += 4;
    doc.setTextColor(80, 80, 80);
  }
  y += 4;

  if (data.summary?.sentence) {
    const usable = pageW - margin * 2;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.summary.sentence, usable);
    doc.text(lines, margin, y);
    y += lines.length * 5;
    const note =
      data.summary.schoolLevel === "secondary"
        ? "Secondary school: best 7 subject averages count toward the total marks."
        : "Primary school: total score is the sum of all subject averages.";
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(note, usable);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Attendance (${data.attendance.daysInTermLabel})`, margin, y);
  y += 5;
  doc.text(
    `Present (incl. late): ${data.attendance.present + data.attendance.late}  Absent: ${data.attendance.absent}  Late: ${data.attendance.late}`,
    margin,
    y
  );
  y += 12;
  doc.text("Class teacher: ___________________________", margin, y);
  y += 10;
  doc.text("Head teacher: ___________________________", margin, y);
  y += 10;
  doc.text("Parent / guardian: ___________________________", margin, y);
}

export function downloadReportCardPdf(
  data: ReportCardPreviewData,
  filenameSafe: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  buildPdf(doc, data, margin);
  doc.save(`report-card-${filenameSafe}.pdf`);
}

export function downloadBulkReportCardsPdf(
  items: ReportCardPreviewData[],
  filenameSafe: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  items.forEach((data, i) => {
    if (i > 0) doc.addPage();
    buildPdf(doc, data, margin);
  });
  doc.save(`report-cards-${filenameSafe}.pdf`);
}
