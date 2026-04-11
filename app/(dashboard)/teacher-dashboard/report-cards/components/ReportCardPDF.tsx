"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportCardPreviewData } from "./ReportCardPreview";

function buildPdf(doc: jsPDF, data: ReportCardPreviewData, margin: number) {
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();

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

  const subBody = data.subjects.map((s) => [
    s.subject,
    s.scorePct,
    s.grade,
    s.comment || "—",
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Subject", "Score %", "Grade", "Teacher comment"]],
    body: subBody.length ? subBody : [["—", "—", "—", "No entries"]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  const lastY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastY ?? y + 40) + 6;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "Grading: A = 75–100%, B = 65–74%, C = 45–64%, D = 30–44%, F = 0–29%.",
    margin,
    y
  );
  y += 8;
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
