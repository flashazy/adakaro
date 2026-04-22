/**
 * Server- and client-safe number formatting for marks / report card cells.
 * (No "use client" — safe for RSC, server actions, and shared compute modules.)
 */
import { getMaxScore } from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";

export type GradeDisplayFormat = "percentage" | "marks" | "both";

export const DEFAULT_GRADE_DISPLAY_FORMAT: GradeDisplayFormat = "percentage";

const VALID_VALUES: readonly GradeDisplayFormat[] = [
  "percentage",
  "marks",
  "both",
] as const;

export function isGradeDisplayFormat(
  value: unknown
): value is GradeDisplayFormat {
  return (
    typeof value === "string" &&
    (VALID_VALUES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                              Number formatting                             */
/* -------------------------------------------------------------------------- */

function trimTrailingZero(n: number): string {
  // Up to 1 decimal, but drop ".0" so integers look clean ("41" not "41.0").
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercentLabel(percent: number | null): string {
  if (percent == null || !Number.isFinite(percent)) return "—";
  return `${trimTrailingZero(percent)}%`;
}

function formatMarksLabel(score: number | null, maxScore: number): string {
  if (score == null || !Number.isFinite(score) || maxScore <= 0) return "—";
  return `${trimTrailingZero(score)}/${trimTrailingZero(maxScore)}`;
}

/**
 * Render a single Marks-page cell value (matrix or single-assignment table).
 * The letter grade is appended in parentheses when supplied. Examples with
 * letter "A":
 *   percentage → "82% (A)"
 *   marks      → "41/50 (A)"
 *   both       → "41/50 - 82% (A)"
 */
export function formatMarksCellLabel(params: {
  score: number | null;
  maxScore: number;
  percent: number | null;
  letter?: string | null;
  format: GradeDisplayFormat;
}): string {
  const { score, maxScore, percent, letter, format } = params;
  const noScore =
    score == null ||
    !Number.isFinite(score) ||
    percent == null ||
    !Number.isFinite(percent);
  if (noScore) return "—";

  const pctLabel = formatPercentLabel(percent);
  const marksLabel = formatMarksLabel(score, maxScore);
  const tail = letter && letter !== "—" ? ` (${letter})` : "";

  switch (format) {
    case "marks":
      return `${marksLabel}${tail}`;
    case "both":
      return `${marksLabel} - ${pctLabel}${tail}`;
    case "percentage":
    default:
      return `${pctLabel}${tail}`;
  }
}

/**
 * Render a single Report-Cards subject cell value. No letter grade appended
 * (the report card has its own dedicated "Grade" column). Examples:
 *   percentage → "82%"
 *   marks      → "41/50"
 *   both       → "41/50 (82%)"
 */
export function formatReportCardCellLabel(params: {
  percent: number | null;
  format: GradeDisplayFormat;
  schoolLevel: SchoolLevel | null | undefined;
}): string {
  const { percent, format, schoolLevel } = params;
  if (percent == null || !Number.isFinite(percent)) return "—";

  const max = getMaxScore(schoolLevel ?? "secondary");
  const pctLabel = formatPercentLabel(percent);
  const synthesizedScore = (percent / 100) * max;
  const marksLabel = formatMarksLabel(synthesizedScore, max);

  switch (format) {
    case "marks":
      return marksLabel;
    case "both":
      return `${marksLabel} (${pctLabel})`;
    case "percentage":
    default:
      return pctLabel;
  }
}
