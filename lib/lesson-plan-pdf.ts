/**
 * Tanzania government–style lesson plan PDF (Times, A4, full grid tables).
 * Used by the export API route and server actions.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  TEACHING_LEARNING_PROCESS_STAGES,
  type TeachingLearningProcess,
} from "@/lib/teaching-learning-process";

export interface LessonPlanPdfInput {
  schoolName: string | null;
  teacherName: string;
  subjectName: string;
  className: string;
  lessonDateDisplay: string;
  periodLabel: string;
  durationMinutes: number;
  /** Class roster (registered). */
  registeredGirls: number;
  registeredBoys: number;
  registeredTotal: number;
  /** Attendance on lesson date (present + late). */
  presentGirls: number;
  presentBoys: number;
  presentTotal: number;
  mainCompetence: string;
  specificCompetence: string;
  mainActivities: string;
  specificActivities: string;
  teachingResources: string;
  referencesContent: string;
  teachingLearningProcess: TeachingLearningProcess;
  remarks: string;
}

/** A4 print margins (mm). */
const MARGIN = 18;
const PAGE_TOP = 20;
const PAGE_BOTTOM = 282;

const TABLE_LINE = {
  lineColor: [0, 0, 0] as [number, number, number],
  lineWidth: 0.15,
};

function contentWidth(pageW: number): number {
  return pageW - 2 * MARGIN;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return PAGE_TOP;
  }
  return y;
}

function drawHeader(doc: jsPDF, pageW: number, schoolName: string): number {
  const cx = pageW / 2;
  const school = schoolName?.trim() || "_______________________________";

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(school, cx, 22, { align: "center" });

  doc.setFontSize(12);
  const title = "TEACHER'S LESSON PLAN";
  const titleY = 31;
  doc.text(title, cx, titleY, { align: "center" });
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.35);
  doc.line(cx - tw / 2, titleY + 1.2, cx + tw / 2, titleY + 1.2);

  return 40;
}

/** `Label: content` on one line; wraps with hanging indent; underlines content only. */
function section(
  doc: jsPDF,
  pageW: number,
  title: string,
  body: string,
  y: number,
  gapAfterLabelMm = 0
): number {
  const text = body?.trim() || "—";
  let yy = ensureSpace(doc, y, 10);

  doc.setFontSize(10);
  doc.setFont("times", "bold");
  const labelW = doc.getTextWidth(title);
  doc.setFont("times", "normal");
  const colon = ": ";
  const colonW = doc.getTextWidth(colon);
  const contentX = MARGIN + labelW + gapAfterLabelMm + colonW;
  const lineWidth = pageW - MARGIN - contentX;
  const contentLines = doc.splitTextToSize(text, lineWidth);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  doc.setFont("times", "bold");
  doc.text(title, MARGIN, yy);
  doc.setFont("times", "normal");
  doc.text(colon, MARGIN + labelW + gapAfterLabelMm, yy);

  const first = contentLines[0] ?? "";
  doc.text(first, contentX, yy);
  let lineW = doc.getTextWidth(first);
  doc.line(contentX, yy + 0.9, contentX + lineW, yy + 0.9);
  yy += 5;

  for (let i = 1; i < contentLines.length; i++) {
    yy = ensureSpace(doc, yy, 6);
    const line = contentLines[i];
    doc.text(line, contentX, yy);
    lineW = doc.getTextWidth(line);
    doc.line(contentX, yy + 0.9, contentX + lineW, yy + 0.9);
    yy += 5;
  }

  return yy + 5;
}

function basicInformationTable(doc: jsPDF, pageW: number, y: number, input: LessonPlanPdfInput): number {
  const w = contentWidth(pageW);
  const colW = w / 5;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Subject", "Class", "Period", "Time"]],
    body: [
      [
        input.lessonDateDisplay,
        input.subjectName,
        input.className,
        input.periodLabel,
        `${input.durationMinutes} minutes`,
      ],
    ],
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 10,
      cellPadding: 2,
      ...TABLE_LINE,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      ...TABLE_LINE,
    },
    columnStyles: {
      0: { cellWidth: colW, halign: "left" },
      1: { cellWidth: colW, halign: "left" },
      2: { cellWidth: colW, halign: "left" },
      3: { cellWidth: colW, halign: "left" },
      4: { cellWidth: colW, halign: "left" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const docWithTable = doc as unknown as { lastAutoTable: { finalY: number } };
  return docWithTable.lastAutoTable.finalY + 8;
}

function demographicsTable(doc: jsPDF, pageW: number, y: number, input: LessonPlanPdfInput): number {
  const w = contentWidth(pageW);
  const dataCol = w / 6;

  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: "Number of Pupils",
          colSpan: 6,
          styles: { halign: "center", fontStyle: "bold" },
        },
      ],
      [
        {
          content: "Registered",
          colSpan: 3,
          styles: { halign: "center", fontStyle: "bold" },
        },
        {
          content: "Present",
          colSpan: 3,
          styles: { halign: "center", fontStyle: "bold" },
        },
      ],
      [
        { content: "Girls", styles: { halign: "center", fontStyle: "bold" } },
        { content: "Boys", styles: { halign: "center", fontStyle: "bold" } },
        { content: "Total", styles: { halign: "center", fontStyle: "bold" } },
        { content: "Girls", styles: { halign: "center", fontStyle: "bold" } },
        { content: "Boys", styles: { halign: "center", fontStyle: "bold" } },
        { content: "Total", styles: { halign: "center", fontStyle: "bold" } },
      ],
    ],
    body: [
      [
        String(input.registeredGirls),
        String(input.registeredBoys),
        String(input.registeredTotal),
        String(input.presentGirls),
        String(input.presentBoys),
        String(input.presentTotal),
      ],
    ],
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 10,
      cellPadding: 2,
      ...TABLE_LINE,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      ...TABLE_LINE,
    },
    bodyStyles: {
      fontStyle: "normal",
    },
    columnStyles: {
      0: { cellWidth: dataCol, halign: "center" },
      1: { cellWidth: dataCol, halign: "center" },
      2: { cellWidth: dataCol, halign: "center" },
      3: { cellWidth: dataCol, halign: "center" },
      4: { cellWidth: dataCol, halign: "center" },
      5: { cellWidth: dataCol, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const docWithTable = doc as unknown as { lastAutoTable: { finalY: number } };
  return docWithTable.lastAutoTable.finalY + 10;
}

function teachingLearningProcessPdfTable(
  doc: jsPDF,
  pageW: number,
  y: number,
  tlp: TeachingLearningProcess
): number {
  let yy = ensureSpace(doc, y, 20);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("Teaching and Learning Process", pageW / 2, yy, { align: "center" });
  yy += 7;

  const w = contentWidth(pageW);
  const body = TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
    const s = tlp[key];
    const time = s?.time;
    const timeCell = time === null || time === undefined ? "—" : String(time);
    return [
      label,
      timeCell,
      (s?.teaching_activities ?? "").trim() || "—",
      (s?.learning_activities ?? "").trim() || "—",
      (s?.assessment_criteria ?? "").trim() || "—",
    ];
  });

  autoTable(doc, {
    startY: yy,
    head: [
      [
        "Stage",
        "Time (minutes)",
        "Teaching Activities",
        "Learning Activities",
        "Assessment Criteria",
      ],
    ],
    body,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 8,
      cellPadding: 1.8,
      valign: "top",
      ...TABLE_LINE,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
      ...TABLE_LINE,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 16 },
      2: { cellWidth: (w - 26 - 16) / 3 },
      3: { cellWidth: (w - 26 - 16) / 3 },
      4: { cellWidth: (w - 26 - 16) / 3 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const docWithTable = doc as unknown as { lastAutoTable: { finalY: number } };
  return docWithTable.lastAutoTable.finalY + 10;
}

function drawFooter(
  doc: jsPDF,
  y: number,
  lessonDateDisplay: string,
  teacherName: string
): void {
  y = ensureSpace(doc, y, 20);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Date: ${lessonDateDisplay}`, MARGIN, y);
  y += 8;
  doc.text(`Teacher's name: ${teacherName}`, MARGIN, y);
}

/** Builds PDF bytes for download/print. */
export function buildLessonPlanPdf(input: LessonPlanPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  let y = drawHeader(doc, pageW, input.schoolName ?? "");

  y = basicInformationTable(doc, pageW, y, input);
  y = demographicsTable(doc, pageW, y, input);

  y = section(doc, pageW, "Main Competence", input.mainCompetence, y);
  y = section(doc, pageW, "Specific Competence", input.specificCompetence, y);
  y = section(doc, pageW, "Main Activity", input.mainActivities, y);
  y = section(doc, pageW, "Specific Activities", input.specificActivities, y);
  y = section(
    doc,
    pageW,
    "Teaching and Learning Resources",
    input.teachingResources,
    y,
    1.4
  );
  y = section(doc, pageW, "References", input.referencesContent, y);
  y = teachingLearningProcessPdfTable(doc, pageW, y, input.teachingLearningProcess);
  y = section(doc, pageW, "Remarks", input.remarks, y);

  drawFooter(doc, y, input.lessonDateDisplay, input.teacherName);

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf as ArrayBuffer);
}
