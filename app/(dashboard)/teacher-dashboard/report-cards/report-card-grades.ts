/** Tanzania scale for report cards: A=75–100, B=65–74, C=45–64, D=30–44, F=0–29 */
export function letterGradeFromPercent(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  if (pct >= 75) return "A";
  if (pct >= 65) return "B";
  if (pct >= 45) return "C";
  if (pct >= 30) return "D";
  return "F";
}
