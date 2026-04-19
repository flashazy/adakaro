import { tanzaniaLetterGrade } from "@/lib/tanzania-grades";

/**
 * Tanzania letter grade from a 0–100 percentage.
 *
 * Defaults to the secondary grading scale (A=75–100, B=65–74, C=45–64,
 * D=30–44, F=0–29) so legacy call sites keep their behaviour. Pass
 * `schoolLevel = "primary"` to use the primary scale (A–E, max 50 marks):
 * A=82–100%, B=62–80%, C=42–60%, D=22–40%, E=0–20%.
 */
export function letterGradeFromPercent(
  pct: number | null,
  schoolLevel: string | null | undefined = "secondary"
): string {
  return tanzaniaLetterGrade(pct, schoolLevel);
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
