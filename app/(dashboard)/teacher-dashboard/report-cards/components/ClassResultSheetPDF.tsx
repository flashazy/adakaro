"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { gradingScaleDescription } from "@/lib/tanzania-grades";
import { normalizeSchoolLevel } from "@/lib/school-level";
import {
  type ClassResultSheetPdfInput,
  getNectaSecondaryDivisionAndMain,
  getPrimaryGradeSummaryAndMain,
} from "@/lib/class-result-sheet-noticeboard-tables";
import { drawPdfSchoolMottoCentered } from "./report-card-pdf-motto";

export type { ClassResultSheetPdfInput } from "@/lib/class-result-sheet-noticeboard-tables";

const NECTA_PAGE_BG: [number, number, number] = [214, 234, 253];
const NECTA_CELL_FILL: [number, number, number] = [255, 251, 245];
const NECTA_PURPLE: [number, number, number] = [88, 28, 135];

function drawNectaPageBackground(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...NECTA_PAGE_BG);
  doc.rect(0, 0, w, h, "F");
}

function buildNectaSecondaryPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  const {
    schoolName,
    schoolMotto,
    className,
    term,
    academicYear,
    coordinatorName,
  } = input;

  const { divHead, divBody, mainHead, mainBody } = getNectaSecondaryDivisionAndMain(
    input.reportCards
  );

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const examTitle = `${className.trim().toUpperCase()} TERMINAL RESULTS - ${term.toUpperCase()} ${academicYear}`;

  drawNectaPageBackground(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(schoolName, pageW / 2, 18, { align: "center" });
  let yHead = 18 + 8;
  yHead = drawPdfSchoolMottoCentered(doc, pageW / 2, yHead, schoolMotto, "times");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const yExam = yHead;
  doc.text(examTitle, pageW / 2, yExam, { align: "center" });
  const coord = (coordinatorName ?? "").trim();
  if (coord) {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Class coordinator: ${coord}`, pageW / 2, yExam + 7, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
  }

  let y = yExam + 14;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("DIVISION PERFORMANCE SUMMARY", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: divHead,
    body: divBody,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1.8,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastDivY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastDivY ?? y + 30) + 8;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("MAIN RESULTS", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const mainTableInnerWidth = pageW - margin * 2;
  const MAIN_COL_SN_MM = 8;
  const MAIN_COL_ADN_MM = 15;
  const MAIN_COL_NAME_MM = 35;
  const MAIN_COL_SEX_MM = 10;
  const MAIN_COL_AGGT_MM = 12;
  const MAIN_COL_DIV_MM = 12;
  const MAIN_COL_FIXED_SUM_MM =
    MAIN_COL_SN_MM +
    MAIN_COL_ADN_MM +
    MAIN_COL_NAME_MM +
    MAIN_COL_SEX_MM +
    MAIN_COL_AGGT_MM +
    MAIN_COL_DIV_MM;
  const MAIN_COL_DETAIL_MM = mainTableInnerWidth - MAIN_COL_FIXED_SUM_MM;

  autoTable(doc, {
    startY: y,
    head: mainHead,
    body: mainBody.length
      ? mainBody
      : [["—", "—", "—", "—", "—", "—", "No students"]],
    theme: "grid",
    tableWidth: mainTableInnerWidth,
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: MAIN_COL_SN_MM },
      1: { cellWidth: MAIN_COL_ADN_MM },
      2: { cellWidth: MAIN_COL_NAME_MM },
      3: { cellWidth: MAIN_COL_SEX_MM },
      4: { cellWidth: MAIN_COL_AGGT_MM },
      5: { cellWidth: MAIN_COL_DIV_MM },
      6: {
        cellWidth: MAIN_COL_DETAIL_MM,
        fontSize: 7,
        overflow: "linebreak",
      },
    },
    margin: { left: margin, right: margin },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastMainY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastMainY ?? y + 40) + 6;

  if (y > doc.internal.pageSize.getHeight() - 24) {
    doc.addPage();
    drawNectaPageBackground(doc);
    y = margin;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    "AGGT = sum of grade points from best 7 scored subjects (A=1 … F=5). DIV = Division from that aggregate. INC = incomplete (<7 scored). ABS = absent (0 scored).",
    margin,
    y
  );
  y += 4;
  doc.text(
    `Grading scale: ${gradingScaleDescription("secondary")}.`,
    margin,
    y
  );
  y += 4;
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    y
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`class-result-sheet-${filenameSafe}.pdf`);
}

function buildPrimaryClassResultSheetPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  const {
    schoolName,
    schoolMotto,
    className,
    term,
    academicYear,
    coordinatorName,
    schoolLevel,
  } = input;

  const { gradeSummaryHead, gradeSummaryBody, head, body } =
    getPrimaryGradeSummaryAndMain(input.reportCards);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const examTitle = `${className.trim().toUpperCase()} TERMINAL RESULTS - ${term.toUpperCase()} ${academicYear}`;

  drawNectaPageBackground(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(schoolName, pageW / 2, 18, { align: "center" });
  let yHead = 18 + 8;
  yHead = drawPdfSchoolMottoCentered(doc, pageW / 2, yHead, schoolMotto, "times");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const yExam = yHead;
  doc.text(examTitle, pageW / 2, yExam, { align: "center" });
  const coord = (coordinatorName ?? "").trim();
  if (coord) {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Class coordinator: ${coord}`, pageW / 2, yExam + 7, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
  }

  let y = yExam + 14;

  const primaryTableInnerWidth = pageW - margin * 2;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("OVERALL PASSING GRADES SUMMARY", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const GS_GENDER_MM = 32;
  const GS_GRADE_MM = (primaryTableInnerWidth - GS_GENDER_MM) / 5;

  autoTable(doc, {
    startY: y,
    head: gradeSummaryHead,
    body: gradeSummaryBody,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1.8,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
    },
    margin: { left: margin, right: margin },
    tableWidth: primaryTableInnerWidth,
    columnStyles: {
      0: { cellWidth: GS_GENDER_MM },
      1: { cellWidth: GS_GRADE_MM, halign: "center" },
      2: { cellWidth: GS_GRADE_MM, halign: "center" },
      3: { cellWidth: GS_GRADE_MM, halign: "center" },
      4: { cellWidth: GS_GRADE_MM, halign: "center" },
      5: { cellWidth: GS_GRADE_MM, halign: "center" },
    },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastPassingSummaryY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastPassingSummaryY ?? y + 28) + 8;

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NECTA_PURPLE);
  doc.text("MAIN RESULTS", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  const PR_COL_SN_MM = 8;
  const PR_COL_ADN_MM = 15;
  const PR_COL_NAME_MM = 35;
  const PR_COL_SEX_MM = 10;
  const PR_COL_SUBJECTS_MM =
    primaryTableInnerWidth -
    PR_COL_SN_MM -
    PR_COL_ADN_MM -
    PR_COL_NAME_MM -
    PR_COL_SEX_MM;

  autoTable(doc, {
    startY: y,
    head,
    body: body.length ? body : [["—", "—", "—", "—", "No students"]],
    theme: "grid",
    tableWidth: primaryTableInnerWidth,
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [30, 30, 30],
      lineWidth: 0.15,
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: NECTA_CELL_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
    },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: PR_COL_SN_MM },
      1: { cellWidth: PR_COL_ADN_MM },
      2: { cellWidth: PR_COL_NAME_MM },
      3: { cellWidth: PR_COL_SEX_MM },
      4: {
        cellWidth: PR_COL_SUBJECTS_MM,
        fontSize: 7,
        overflow: "linebreak",
      },
    },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      drawNectaPageBackground(doc);
    },
  });

  const lastY = (
    doc as unknown as { lastAutoTable?: { finalY: number } }
  ).lastAutoTable?.finalY;
  y = (lastY ?? y + 40) + 6;

  if (y > doc.internal.pageSize.getHeight() - 24) {
    doc.addPage();
    drawNectaPageBackground(doc);
    y = margin;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Grading scale: ${gradingScaleDescription(schoolLevel)}.`,
    margin,
    y
  );
  y += 4;
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    y
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`class-result-sheet-${filenameSafe}.pdf`);
}

export function downloadClassResultSheetPdf(
  input: ClassResultSheetPdfInput,
  filenameSafe: string
) {
  const level = normalizeSchoolLevel(input.schoolLevel);
  if (level === "secondary") {
    buildNectaSecondaryPdf(input, filenameSafe);
  } else {
    buildPrimaryClassResultSheetPdf(input, filenameSafe);
  }
}
