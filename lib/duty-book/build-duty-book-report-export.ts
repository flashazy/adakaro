import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { csvEscape } from "@/lib/analytics";
import { formatDateTimeStable } from "@/lib/school-timezone";
import {
  DUTY_BOOK_EVENT_TYPE_LABELS,
  type DutyBookReportPayload,
} from "./duty-book-report-types";

/** Append duty book report section to an attendance CSV export. */
export function appendDutyBookReportToCsv(
  lines: string[],
  reportPayload: DutyBookReportPayload
): void {
  const report = reportPayload.report;
  lines.push("");
  lines.push("Duty Book Report");

  if (!report) {
    lines.push("status,No report recorded for this date");
    return;
  }

  const events = [...report.events].sort((a, b) => a.time.localeCompare(b.time));
  lines.push("");
  lines.push("Events");
  if (events.length === 0) {
    lines.push("note,No events recorded");
  } else {
    lines.push("time,type,description,recorded_by");
    for (const ev of events) {
      const recordedBy =
        ev.recordedByName?.trim() ||
        (ev.recordedById ? "Unknown" : "Unknown");
      lines.push(
        [
          csvEscape(ev.time),
          csvEscape(DUTY_BOOK_EVENT_TYPE_LABELS[ev.type]),
          csvEscape(ev.description),
          csvEscape(recordedBy),
        ].join(",")
      );
    }
  }

  lines.push("");
  lines.push("Remarks (teacher on duty)");
  const remarksBy =
    report.remarksLastModifiedByName?.trim() ||
    (report.remarksLastModifiedById ? "Unknown" : "");
  if (remarksBy) {
    lines.push(`last updated by,${csvEscape(remarksBy)}`);
  }
  lines.push(csvEscape(report.remarks?.trim() || "—"));

  lines.push("");
  lines.push("Head teacher comment");
  lines.push(csvEscape(report.headTeacherComment?.trim() || "—"));

  lines.push("");
  lines.push("Head teacher signature");
  if (report.signedAt) {
    const signer =
      reportPayload.signer?.fullName ||
      report.headTeacherSignature?.trim() ||
      "Head teacher";
    lines.push(`signed by,${csvEscape(signer)}`);
    lines.push(`signed at,${csvEscape(formatDateTimeStable(report.signedAt))}`);
  } else {
    lines.push("status,Not signed");
  }
}

export function appendDutyBookReportToPdf(
  doc: jsPDF,
  startY: number,
  reportPayload: DutyBookReportPayload
): number {
  let y = startY + 12;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxW = pageW - margin * 2;

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 14;
  }

  doc.setFontSize(14);
  doc.text("Duty Book Report", margin, y);
  y += 8;
  doc.setFontSize(9);

  const report = reportPayload.report;
  if (!report) {
    doc.text("No report recorded for this date.", margin, y);
    return y + 6;
  }

  const events = [...report.events].sort((a, b) => a.time.localeCompare(b.time));

  doc.setFont("helvetica", "bold");
  doc.text("Events", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  if (events.length === 0) {
    doc.text("No events recorded for this day.", margin, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Time", "Type", "Description", "Recorded by"]],
      body: events.map((ev) => [
        ev.time,
        DUTY_BOOK_EVENT_TYPE_LABELS[ev.type],
        ev.description,
        ev.recordedByName?.trim() ||
          (ev.recordedById ? "Unknown" : "Unknown"),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [100, 116, 139] },
      margin: { left: margin, right: margin },
    });
    y =
      (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      y + 20;
    y += 6;
  }

  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Remarks (teacher on duty)", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const remarksBy =
    report.remarksLastModifiedByName?.trim() ||
    (report.remarksLastModifiedById ? "Unknown" : "");
  if (remarksBy) {
    doc.text(`Last updated by ${remarksBy}`, margin, y);
    y += 5;
  }
  const remarks = report.remarks?.trim() || "—";
  const remarksLines = doc.splitTextToSize(remarks, maxW);
  doc.text(remarksLines, margin, y);
  y += remarksLines.length * 4.5 + 6;

  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Head teacher comment", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const htComment = report.headTeacherComment?.trim() || "—";
  const commentLines = doc.splitTextToSize(htComment, maxW);
  doc.text(commentLines, margin, y);
  y += commentLines.length * 4.5 + 6;

  doc.setFont("helvetica", "bold");
  doc.text("Head teacher signature", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  if (report.signedAt) {
    const signer =
      reportPayload.signer?.fullName ||
      report.headTeacherSignature?.trim() ||
      "Head teacher";
    doc.text(
      `Signed by ${signer} on ${formatDateTimeStable(report.signedAt)}`,
      margin,
      y
    );
    y += 6;
  } else {
    doc.text("Not signed", margin, y);
    y += 6;
  }

  return y;
}
