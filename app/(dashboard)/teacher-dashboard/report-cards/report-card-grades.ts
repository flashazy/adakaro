/** Tanzania scale for report cards: A=75–100, B=65–74, C=45–64, D=30–44, F=0–29 */
export function letterGradeFromPercent(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  if (pct >= 75) return "A";
  if (pct >= 65) return "B";
  if (pct >= 45) return "C";
  if (pct >= 30) return "D";
  return "F";
}

/** Final term score when both exam percentages are entered (0–100 each). */
export function computeReportCardTermAverage(
  exam1: number | null,
  exam2: number | null
): number | null {
  if (
    exam1 == null ||
    exam2 == null ||
    !Number.isFinite(exam1) ||
    !Number.isFinite(exam2)
  ) {
    return null;
  }
  return Math.round(((exam1 + exam2) / 2) * 10) / 10;
}
