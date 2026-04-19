/**
 * Tanzanian grade calculations.
 *
 * Two grading tiers run side-by-side:
 *  - secondary (default — preserves legacy behaviour): max 100 marks per
 *    subject, A=75–100, B=65–74, C=45–64, D=30–44, F=0–29.
 *  - primary: max 50 marks per subject, A=82–100% (41–50), B=62–80% (31–40),
 *    C=42–60% (21–30), D=22–40% (11–20), E=0–20% (0–10).
 *
 * Functions accept a `schoolLevel` argument that defaults to "secondary" so
 * call sites that pre-date primary-tier support keep their existing behaviour.
 */

import type { SchoolLevel } from "@/lib/school-level";

/** Default max score per subject, by school tier. */
export const PRIMARY_MAX_SCORE = 50;
export const SECONDARY_MAX_SCORE = 100;

/** Failing grade letter to display in stats / distributions, by school tier. */
export const FAIL_GRADE_LETTER: Record<SchoolLevel, "E" | "F"> = {
  primary: "E",
  secondary: "F",
};

/** Default max score for a new gradebook assignment at the given school tier. */
export function getMaxScore(schoolLevel: string | null | undefined): number {
  return schoolLevel === "primary" ? PRIMARY_MAX_SCORE : SECONDARY_MAX_SCORE;
}

/** Letter grade keys used by the grade-distribution UI, in display order. */
export function gradeDistributionKeys(
  schoolLevel: string | null | undefined
): readonly ("A" | "B" | "C" | "D" | "E" | "F")[] {
  return schoolLevel === "primary"
    ? (["A", "B", "C", "D", "E"] as const)
    : (["A", "B", "C", "D", "F"] as const);
}

/** Human readable grading band sentence, e.g. for help text under a table. */
export function gradingScaleDescription(
  schoolLevel: string | null | undefined
): string {
  return schoolLevel === "primary"
    ? "A 82–100% (41–50) · B 62–80% (31–40) · C 42–60% (21–30) · D 22–40% (11–20) · E 0–20% (0–10)"
    : "A 75–100% · B 65–74% · C 45–64% · D 30–44% · F 0–29%";
}

/** Minimum percentage that counts as "passing" for the given tier. */
export function passingThresholdPercent(
  schoolLevel: string | null | undefined
): number {
  return schoolLevel === "primary" ? 22 : 30;
}

/** Percentage (0–100) from raw score and max. */
export function tanzaniaPercentFromScore(
  score: number,
  max: number
): number | null {
  if (max <= 0 || !Number.isFinite(score)) return null;
  return Math.round((score / max) * 1000) / 10;
}

/**
 * Tanzania letter grade from percentage. Defaults to secondary-tier bands
 * (A=75–100, …, F=0–29) so legacy callers keep their existing behaviour.
 * Pass `schoolLevel = "primary"` to use the primary tier (A–E, max 50 marks).
 */
export function tanzaniaLetterGrade(
  percent: number | null,
  schoolLevel: string | null | undefined = "secondary"
): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  if (schoolLevel === "primary") {
    if (percent >= 82) return "A";
    if (percent >= 62) return "B";
    if (percent >= 42) return "C";
    if (percent >= 22) return "D";
    return "E";
  }
  if (percent >= 75) return "A";
  if (percent >= 65) return "B";
  if (percent >= 45) return "C";
  if (percent >= 30) return "D";
  return "F";
}

/**
 * Helper that computes both the percentage and letter grade for a raw score.
 * The max score defaults to the school tier's max (50 / 100); pass an explicit
 * `max` to use a per-assignment override.
 */
export function getGradeFromScore(
  score: number,
  schoolLevel: string | null | undefined,
  max?: number
): { grade: string; percentage: number | null } {
  const maxScore = max ?? getMaxScore(schoolLevel);
  const percentage = tanzaniaPercentFromScore(score, maxScore);
  return {
    grade: tanzaniaLetterGrade(percentage, schoolLevel),
    percentage,
  };
}

export function tanzaniaGradeBadgeClass(letter: string): string {
  switch (letter) {
    case "A":
      return "text-emerald-700 dark:text-emerald-400 font-semibold";
    case "B":
      return "text-blue-700 dark:text-blue-400 font-semibold";
    case "C":
      return "text-amber-600 dark:text-amber-400 font-semibold";
    case "D":
      return "text-orange-600 dark:text-orange-400 font-semibold";
    // E (primary failing band) and F (secondary failing band) share styling
    // so the colour cue stays consistent across tiers.
    case "E":
    case "F":
      return "text-red-600 dark:text-red-400 font-semibold";
    default:
      return "text-slate-500 dark:text-zinc-400";
  }
}
