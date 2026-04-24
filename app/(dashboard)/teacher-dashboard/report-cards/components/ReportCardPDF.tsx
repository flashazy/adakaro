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

/** Stamp box on PDF (mm); aspect ratio preserved; kept modest so HT signature stays readable. */
const MAX_STAMP_WIDTH_MM = 28;
const MAX_STAMP_HEIGHT_MM = 17;
/** Written signatures (coordinator + head teacher); fit within each footer column. */
const HT_SIG_MAX_W_MM = 58;
const HT_SIG_MAX_H_MM = 19;
/** Distance from tallest signature bottom to rule (shared line for both columns). */
const HT_SIG_GAP_TO_LINE_MM = -1.45;
/** y offset from "Head teacher" label baseline to signature tops. */
const HT_LABEL_TO_IMG_TOP_MM = 1.2;
/**
 * Head Teacher signature only: shift draw origin down (~8px ≈ 2.1mm) so ink sits closer
 * to the rule without changing the coordinator column or on-screen preview.
 */
const PDF_HT_SIG_TOP_NUDGE_MM = 2.1;

type JspdfWithGState = jsPDF & {
  GState?: new (p: { opacity: number }) => unknown;
  setGState?: (g: unknown) => void;
  saveGraphicsState?: () => void;
  restoreGraphicsState?: () => void;
};

/**
 * Scales stamp to fit inside {@link MAX_STAMP_WIDTH_MM} × {@link MAX_STAMP_HEIGHT_MM} (mm),
 * same logic as drawn in {@link addReportCardStamp}. Returns null if image dimensions are invalid.
 */
function reportCardStampSizeMm(
  doc: jsPDF,
  dataUrl: string
): { w: number; h: number } | null {
  const d = doc as JspdfWithGState;
  const ip = d.getImageProperties(dataUrl);
  const imgWidth = ip.width;
  const imgHeight = ip.height;
  if (!imgWidth || !imgHeight) {
    return null;
  }
  const ratio = Math.min(
    MAX_STAMP_WIDTH_MM / imgWidth,
    MAX_STAMP_HEIGHT_MM / imgHeight
  );
  return { w: imgWidth * ratio, h: imgHeight * ratio };
}

/**
 * School stamp: centered horizontally at `xStampCenter`, vertically centered on `lineY`
 * (signature rule). Optional opacity (0.75–0.85) when jsPDF GState is available.
 */
function addReportCardStamp(
  doc: jsPDF,
  dataUrl: string,
  xStampCenter: number,
  lineY: number,
  opts?: { opacity?: number }
): void {
  const d = doc as JspdfWithGState;
  const size = reportCardStampSizeMm(doc, dataUrl);
  if (!size) return;
  const { w, h } = size;
  const ip = d.getImageProperties(dataUrl);
  const x = xStampCenter - w / 2;
  const yTop = lineY - h / 2;
  const raw = (ip.fileType || "PNG").toUpperCase();
  const format =
    raw === "JPG" || raw === "JPEG" ? "JPEG" : raw === "WEBP" ? "WEBP" : "PNG";
  const op = opts?.opacity;
  if (
    op != null &&
    op < 1 &&
    typeof d.saveGraphicsState === "function" &&
    d.GState &&
    typeof d.setGState === "function" &&
    typeof d.restoreGraphicsState === "function"
  ) {
    d.saveGraphicsState();
    d.setGState(new d.GState({ opacity: op }));
    d.addImage(dataUrl, format, x, yTop, w, h, undefined, undefined, -4);
    d.restoreGraphicsState();
  } else {
    d.addImage(dataUrl, format, x, yTop, w, h, undefined, undefined, -4);
  }
}

/** Same width/height (and format) as drawn HT signature; used to place the rule. */
function headTeacherSignatureSizeMm(
  doc: jsPDF,
  dataUrl: string
): { w: number; h: number; format: "PNG" | "JPEG" | "WEBP" } {
  const d = doc as JspdfWithGState;
  const ip = d.getImageProperties(dataUrl);
  const ar = ip.width / ip.height;
  let w = HT_SIG_MAX_W_MM;
  let h = w / ar;
  if (h > HT_SIG_MAX_H_MM) {
    h = HT_SIG_MAX_H_MM;
    w = h * ar;
  }
  if (w > HT_SIG_MAX_W_MM) {
    w = HT_SIG_MAX_W_MM;
    h = w / ar;
  }
  const raw = (ip.fileType || "PNG").toUpperCase();
  const format: "PNG" | "JPEG" | "WEBP" =
    raw === "JPG" || raw === "JPEG" ? "JPEG" : raw === "WEBP" ? "WEBP" : "PNG";
  return { w, h, format };
}

/**
 * Head Teacher written signature: horizontally centered in the column, above the
 * rule; max 58×19 mm (Class Coordinator uses the same caps). The school stamp is
 * offset slightly to the right of the column center; see {@link addReportCardStamp}.
 */
function addHeadTeacherSignaturePdf(
  doc: jsPDF,
  dataUrl: string,
  /** Horizontal center of the Head Teacher column (mm). */
  xCenter: number,
  yTop: number
): void {
  const d = doc as JspdfWithGState;
  const { w, h, format } = headTeacherSignatureSizeMm(doc, dataUrl);
  const x = xCenter - w / 2;
  d.addImage(dataUrl, format, x, yTop, w, h);
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

/** Consistent vertical gap (mm) between report sections in PDF output. */
const PDF_BLOCK_GAP = 5;

function buildPdf(
  doc: jsPDF,
  data: ReportCardPreviewData,
  margin: number,
  stampDataUrl: string | null,
  headTeacherSignatureDataUrl: string | null,
  coordinatorSignatureDataUrl: string | null
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
  y = (lastY ?? y + 40) + PDF_BLOCK_GAP;
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
  y += PDF_BLOCK_GAP;

  const usableW = pageW - margin * 2;

  if (data.schoolCalendar) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("School Calendar", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const calText = formatDateRange(
      data.schoolCalendar.closingDateLabel,
      data.schoolCalendar.openingDateLabel
    );
    const calLines = doc.splitTextToSize(calText, usableW);
    doc.text(calLines, margin, y);
    y += calLines.length * 4 + PDF_BLOCK_GAP;
  }

  if (data.feeStatement) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Fee Statement", margin, y);
    y += 4;
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
    y += PDF_BLOCK_GAP;
  }

  if (data.coordinatorMessage) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Coordinator's Message", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const msgFormatted = formatCoordinatorMessage(data.coordinatorMessage);
    const msgLines = doc.splitTextToSize(msgFormatted, usableW);
    doc.text(msgLines, margin, y);
    y += msgLines.length * 4 + PDF_BLOCK_GAP;
  }

  if (data.requiredNextTermItems && data.requiredNextTermItems.length > 0) {
    const itemsFormatted = formatItemsForPdf(data.requiredNextTermItems);
    if (itemsFormatted) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Items for Next Term", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const itemLines = doc.splitTextToSize(itemsFormatted, usableW);
      doc.text(itemLines, margin, y);
      y += itemLines.length * 4 + PDF_BLOCK_GAP;
    }
  }

  if (data.summary?.sentence) {
    const usable = usableW;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 4;
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
    y += noteLines.length * 4 + PDF_BLOCK_GAP;
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
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const attendanceLines = doc.splitTextToSize(attendanceSentence, usableW);
    doc.text(attendanceLines, margin, y);
    y += attendanceLines.length * 4 + PDF_BLOCK_GAP;
  }

  const pageW2 = doc.internal.pageSize.getWidth();
  const colGap = 3; // mm between the two signature columns
  const sigUsableW = pageW2 - 2 * margin;
  const halfW = (sigUsableW - colGap) / 2;
  const leftX = margin;
  const rightX = margin + halfW + colGap;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const leftLabel = data.teacherIsCoordinator
    ? "Class Coordinator"
    : "Class teacher";
  const yLabels2 = y;
  doc.text(leftLabel, leftX, yLabels2);
  doc.text("Head teacher", rightX, yLabels2);
  const leftColumnCenterX = leftX + halfW / 2;
  const headTeacherColumnCenterX = rightX + halfW / 2;
  const headTeacherStampCenterX = headTeacherColumnCenterX + halfW * 0.14;

  const sigPhotoTop = yLabels2 + HT_LABEL_TO_IMG_TOP_MM;
  let hCoord = 0;
  if (coordinatorSignatureDataUrl) {
    try {
      hCoord = headTeacherSignatureSizeMm(doc, coordinatorSignatureDataUrl).h;
      addHeadTeacherSignaturePdf(
        doc,
        coordinatorSignatureDataUrl,
        leftColumnCenterX,
        sigPhotoTop
      );
    } catch {
      hCoord = 0;
    }
  }

  let hHt = 0;
  if (headTeacherSignatureDataUrl) {
    try {
      hHt = headTeacherSignatureSizeMm(doc, headTeacherSignatureDataUrl).h;
      addHeadTeacherSignaturePdf(
        doc,
        headTeacherSignatureDataUrl,
        headTeacherColumnCenterX,
        sigPhotoTop + PDF_HT_SIG_TOP_NUDGE_MM
      );
    } catch {
      hHt = 0;
    }
  }

  const band = Math.max(hCoord, hHt);
  const lineY =
    band > 0 ? sigPhotoTop + band + HT_SIG_GAP_TO_LINE_MM : yLabels2 + 7;
  doc.setLineWidth(0.25);
  doc.setDrawColor(0, 0, 0);
  doc.line(leftX, lineY, leftX + halfW, lineY);
  doc.line(rightX, lineY, rightX + halfW, lineY);

  if (stampDataUrl) {
    try {
      addReportCardStamp(
        doc,
        stampDataUrl,
        headTeacherStampCenterX,
        lineY,
        { opacity: 0.82 }
      );
    } catch {
      /* keep signature lines if image fails */
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Signature", leftX, lineY + 3.5);
  doc.text("Signature", rightX, lineY + 3.5);
  doc.setTextColor(0, 0, 0);
  y = lineY + 5;
}

export async function downloadReportCardPdf(
  data: ReportCardPreviewData,
  filenameSafe: string
) {
  const [stampDataUrl, headTeacherSignatureDataUrl, coordinatorSignatureDataUrl] =
    await Promise.all([
      reportCardStampDataUrl(data.schoolStampUrl),
      reportCardStampDataUrl(data.headTeacherSignatureUrl),
      reportCardStampDataUrl(data.coordinatorSignatureUrl),
    ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  buildPdf(
    doc,
    data,
    margin,
    stampDataUrl,
    headTeacherSignatureDataUrl,
    coordinatorSignatureDataUrl
  );
  doc.save(`report-card-${filenameSafe}.pdf`);
}

type ReportCardPdfImageBundle = {
  stamp: string | null;
  headTeacherSignature: string | null;
  coordinatorSignature: string | null;
};

export async function downloadBulkReportCardsPdf(
  items: ReportCardPreviewData[],
  filenameSafe: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const cache = new Map<string, ReportCardPdfImageBundle>();
  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage();
    const d = items[i]!;
    const key = `${d.schoolStampUrl?.trim() || ""}|||${d.headTeacherSignatureUrl?.trim() || ""}|||${d.coordinatorSignatureUrl?.trim() || ""}`;
    if (!cache.has(key)) {
      const [stamp, headTeacherSignature, coordinatorSignature] =
        await Promise.all([
          reportCardStampDataUrl(d.schoolStampUrl),
          reportCardStampDataUrl(d.headTeacherSignatureUrl),
          reportCardStampDataUrl(d.coordinatorSignatureUrl),
        ]);
      cache.set(key, { stamp, headTeacherSignature, coordinatorSignature });
    }
    const bundle = cache.get(key)!;
    buildPdf(
      doc,
      d,
      margin,
      bundle.stamp,
      bundle.headTeacherSignature,
      bundle.coordinatorSignature
    );
  }
  doc.save(`report-cards-${filenameSafe}.pdf`);
}
