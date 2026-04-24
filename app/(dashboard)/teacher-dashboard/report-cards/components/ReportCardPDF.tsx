"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { reportCardExamColumnTitles } from "../report-card-preview-builder";
import type { ReportCardPreviewData } from "../report-card-preview-types";
import { gradingScaleDescription } from "@/lib/tanzania-grades";
import { drawPdfSchoolMottoCentered } from "./report-card-pdf-motto";
import { formatCurrency } from "@/lib/currency";
import {
  formatCoordinatorMessage,
  formatDateRange,
  formatFeeBalanceReminder,
  formatItemsForPdf,
  formatAttendance,
} from "@/lib/reportFormatter";

const STAMP_MAX_MM = 26; // ~100px at 96dpi

function addReportCardStamp(
  doc: jsPDF,
  dataUrl: string,
  xRight: number,
  yTop: number
): void {
  const ip = (doc as unknown as {
    getImageProperties: (d: string) => { width: number; height: number; fileType?: string };
  }).getImageProperties(dataUrl);
  const ar = ip.width / ip.height;
  let w = STAMP_MAX_MM;
  let h = w / ar;
  if (h > STAMP_MAX_MM) {
    h = STAMP_MAX_MM;
    w = h * ar;
  }
  const x = xRight - w;
  const raw = (ip.fileType || "PNG").toUpperCase();
  const format =
    raw === "JPG" || raw === "JPEG" ? "JPEG" : raw === "WEBP" ? "WEBP" : "PNG";
  doc.addImage(dataUrl, format, x, yTop, w, h);
}

/**
 * Load stamp from public URL for jsPDF (avoids tainting canvas; works with CORS public buckets).
 */
export async function reportCardStampDataUrl(
  publicUrl: string | null | undefined
): Promise<string | null> {
  const u = (publicUrl ?? "").trim();
  if (!u) return null;
  try {
    const r = await fetch(u, { mode: "cors", cache: "no-store" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(
          typeof reader.result === "string" && reader.result.length > 0
            ? reader.result
            : null
        );
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildPdf(
  doc: jsPDF,
  data: ReportCardPreviewData,
  margin: number,
  stampDataUrl: string | null
) {
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const examHead = reportCardExamColumnTitles(data.term);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.schoolName, pageW / 2, y, { align: "center" });
  y += 8;
  y = drawPdfSchoolMottoCentered(doc, pageW / 2, y, data.schoolMotto, "helvetica");
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
  doc.text(
    `${data.teacherIsCoordinator ? "Class Coordinator" : "Class teacher"}: ${data.teacherName}`,
    margin,
    y
  );
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
    `Average = (Exam 1 + Exam 2) / 2 when both scores are entered. Grading: ${gradingScaleDescription(data.summary?.schoolLevel)}.`,
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

  const usableW = pageW - margin * 2;

  if (data.schoolCalendar) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("School Calendar", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const calText = formatDateRange(
      data.schoolCalendar.closingDateLabel,
      data.schoolCalendar.openingDateLabel
    );
    const calLines = doc.splitTextToSize(calText, usableW);
    doc.text(calLines, margin, y);
    y += calLines.length * 4 + 4;
  }

  if (data.feeStatement) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Fee Statement", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const fs = data.feeStatement;
    doc.text(
      `Total fees this term: ${formatCurrency(fs.totalFees, fs.currencyCode)}`,
      margin,
      y
    );
    y += 4;
    doc.text(
      `Amount paid: ${formatCurrency(fs.amountPaid, fs.currencyCode)}`,
      margin,
      y
    );
    y += 4;
    doc.text(
      `Balance due: ${formatCurrency(fs.balanceDue, fs.currencyCode)}`,
      margin,
      y
    );
    y += 4;
    if (fs.balanceDue > 0) {
      doc.setTextColor(160, 90, 0);
      const warn = doc.splitTextToSize(
        formatFeeBalanceReminder(fs.balanceDue, fs.currencyCode),
        usableW
      );
      doc.text(warn, margin, y);
      y += warn.length * 4 + 2;
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(4, 120, 87);
      doc.text("Fee balance: Paid in full. Thank you!", margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
    }
    y += 4;
  }

  if (data.coordinatorMessage) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Coordinator's Message", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const msgFormatted = formatCoordinatorMessage(data.coordinatorMessage);
    const msgLines = doc.splitTextToSize(msgFormatted, usableW);
    doc.text(msgLines, margin, y);
    y += msgLines.length * 4 + 4;
  }

  if (data.requiredNextTermItems && data.requiredNextTermItems.length > 0) {
    const itemsFormatted = formatItemsForPdf(data.requiredNextTermItems);
    if (itemsFormatted) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Items for Next Term", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const itemLines = doc.splitTextToSize(itemsFormatted, usableW);
      doc.text(itemLines, margin, y);
      y += itemLines.length * 4 + 4;
    }
  }

  if (data.summary?.sentence) {
    const usable = usableW;
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

  const presentDays = data.attendance.present + data.attendance.late;
  const attendanceSentence = formatAttendance(
    presentDays,
    data.attendance.absent
  );
  if (attendanceSentence) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Attendance (${data.attendance.daysInTermLabel})`,
      margin,
      y
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const attendanceLines = doc.splitTextToSize(attendanceSentence, usableW);
    doc.text(attendanceLines, margin, y);
    y += attendanceLines.length * 4 + 4;
  }

  const sigBlockStartY = y;
  const pageW2 = doc.internal.pageSize.getWidth();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const line1 = `${data.teacherIsCoordinator ? "Class Coordinator" : "Class teacher"}: ___________________________`;
  const line2 = "Head teacher: ___________________________";
  const line3 = "Parent / guardian: ___________________________";
  doc.text(line1, margin, y);
  y += 10;
  doc.text(line2, margin, y);
  y += 10;
  doc.text(line3, margin, y);
  if (stampDataUrl) {
    try {
      const stampY = Math.max(margin, sigBlockStartY - 2);
      addReportCardStamp(
        doc,
        stampDataUrl,
        pageW2 - margin,
        stampY
      );
    } catch {
      /* keep signatures if image fails */
    }
  }
}

export async function downloadReportCardPdf(
  data: ReportCardPreviewData,
  filenameSafe: string
) {
  const stampDataUrl = await reportCardStampDataUrl(data.schoolStampUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  buildPdf(doc, data, margin, stampDataUrl);
  doc.save(`report-card-${filenameSafe}.pdf`);
}

export async function downloadBulkReportCardsPdf(
  items: ReportCardPreviewData[],
  filenameSafe: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const cache = new Map<string, string | null>();
  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage();
    const d = items[i]!;
    const key = d.schoolStampUrl?.trim() || "";
    if (!cache.has(key)) {
      cache.set(key, await reportCardStampDataUrl(d.schoolStampUrl));
    }
    buildPdf(doc, d, margin, cache.get(key) ?? null);
  }
  doc.save(`report-cards-${filenameSafe}.pdf`);
}
