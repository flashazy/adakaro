/**
 * Tanzania-style lesson plan PDF (Times layout, demographics table, signature).
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
  totalPupils: number;
  totalBoys: number;
  totalGirls: number;
  presentCount: number;
  mainCompetence: string;
  specificCompetence: string;
  mainActivities: string;
  specificActivities: string;
  teachingResources: string;
  referencesContent: string;
  teachingLearningProcess: TeachingLearningProcess;
  remarks: string;
}

const MARGIN = 14;
const MAX_Y = 275;
const PAGE_TOP = 20;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    doc.addPage();
    return PAGE_TOP;
  }
  return y;
}

function section(doc: jsPDF, title: string, body: string, y: number): number {
  let yy = ensureSpace(doc, y, 14);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(title, MARGIN, yy);
  yy += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const text = body?.trim() || "—";
  const lines = doc.splitTextToSize(text, 180);
  for (let i = 0; i < lines.length; i++) {
    yy = ensureSpace(doc, yy, 6);
    doc.text(lines[i], MARGIN, yy);
    yy += 5;
  }
  return yy + 4;
}

function teachingLearningProcessPdfTable(
  doc: jsPDF,
  y: number,
  tlp: TeachingLearningProcess
): number {
  let yy = ensureSpace(doc, y, 16);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("Teaching and Learning Process", MARGIN, yy);
  yy += 6;

  const body = TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
    const s = tlp[key];
    const time = s?.time;
    const timeCell =
      time === null || time === undefined ? "—" : String(time);
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
    styles: { font: "times", fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 18 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
    },
  });

  const docWithTable = doc as unknown as {
    lastAutoTable: { finalY: number };
  };
  return docWithTable.lastAutoTable.finalY + 10;
}

/** Builds PDF bytes for download/print. */
export function buildLessonPlanPdf(input: LessonPlanPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("LESSON PLAN", pageW / 2, 18, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  let y = 28;
  doc.text(
    `School: ${input.schoolName?.trim() || "_______________________________"}`,
    MARGIN,
    y
  );
  y += 8;

  y = ensureSpace(doc, y, 40);
  doc.setFont("times", "bold");
  doc.text("Basic information", MARGIN, y);
  y += 6;
  doc.setFont("times", "normal");
  doc.text(`Subject: ${input.subjectName}`, MARGIN, y);
  y += 5;
  doc.text(`Class: ${input.className}`, MARGIN, y);
  y += 5;
  doc.text(`Date: ${input.lessonDateDisplay}`, MARGIN, y);
  y += 5;
  doc.text(`Period: ${input.periodLabel}`, MARGIN, y);
  y += 5;
  doc.text(`Time / Duration: ${input.durationMinutes} minutes`, MARGIN, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Total pupils", "Boys", "Girls", "Present"]],
    body: [
      [
        String(input.totalPupils),
        String(input.totalBoys),
        String(input.totalGirls),
        String(input.presentCount),
      ],
    ],
    styles: { font: "times", fontSize: 10 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
  });

  const docWithTable = doc as unknown as {
    lastAutoTable: { finalY: number };
  };
  y = docWithTable.lastAutoTable.finalY + 10;

  y = section(doc, "Main Competence", input.mainCompetence, y);
  y = section(doc, "Specific Competence", input.specificCompetence, y);
  y = section(doc, "Main Activities", input.mainActivities, y);
  y = section(doc, "Specific Activities", input.specificActivities, y);
  y = section(
    doc,
    "Teaching and Learning Resources",
    input.teachingResources,
    y
  );
  y = teachingLearningProcessPdfTable(doc, y, input.teachingLearningProcess);
  y = section(doc, "References", input.referencesContent, y);
  y = section(doc, "Remarks / Evaluation", input.remarks, y);

  y = ensureSpace(doc, y, 20);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Teacher's signature / name: ___________________________", MARGIN, y);
  y += 8;
  doc.text(`Date: _______________     Teacher: ${input.teacherName}`, MARGIN, y);

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf as ArrayBuffer);
}
