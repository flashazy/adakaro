/**
 * School-level vocabulary used by report-card calculations.
 *
 * Tanzanian schools fall into two tiers and the rules differ:
 *   - "primary"   → every subject counts; rank by overall average %
 *   - "secondary" → only the best 7 subject averages count; rank by total marks
 *
 * Keep this file dependency-free so it can be imported by client components,
 * server actions, and shared helpers without dragging in `server-only` code.
 */

export type SchoolLevel = "primary" | "secondary";

export const SCHOOL_LEVEL_VALUES: readonly SchoolLevel[] = [
  "primary",
  "secondary",
] as const;

export const DEFAULT_SCHOOL_LEVEL: SchoolLevel = "primary";

/** Number of subjects that count toward total marks for secondary schools. */
export const SECONDARY_BEST_SUBJECT_COUNT = 7;

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  primary: "Primary",
  secondary: "Secondary",
};

export const SCHOOL_LEVEL_DESCRIPTIONS: Record<SchoolLevel, string> = {
  primary: "All subjects count. Ranking uses each student's average %.",
  secondary: `Best ${SECONDARY_BEST_SUBJECT_COUNT} subjects count. Ranking uses total marks.`,
};

export function isSchoolLevel(value: unknown): value is SchoolLevel {
  return value === "primary" || value === "secondary";
}

export function normalizeSchoolLevel(value: unknown): SchoolLevel {
  return isSchoolLevel(value) ? value : DEFAULT_SCHOOL_LEVEL;
}
