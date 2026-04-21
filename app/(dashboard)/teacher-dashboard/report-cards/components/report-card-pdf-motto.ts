import type jsPDF from "jspdf";

/**
 * Renders school motto under the school name on PDFs. Returns the baseline Y
 * for the next line (after motto + margin), or `y` when there is no motto.
 */
export function drawPdfSchoolMottoCentered(
  doc: jsPDF,
  pageCenterX: number,
  y: number,
  motto: string | null | undefined,
  font: "helvetica" | "times"
): number {
  const t = (motto ?? "").trim();
  if (!t) return y;
  const safe = t.replace(/"/g, "\u2019");
  doc.setFontSize(9);
  doc.setFont(font, "italic");
  doc.setTextColor(0, 0, 0);
  doc.text(`"${safe}"`, pageCenterX, y, { align: "center" });
  doc.setFont(font, "normal");
  return y + 6;
}
