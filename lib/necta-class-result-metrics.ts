/**
 * NECTA-style division bucketing for secondary result sheets — shared between
 * client PDFs and server-side academic performance reports.
 */

import type { CoordinatorReportCardItem } from "@/app/(dashboard)/teacher-dashboard/coordinator/types";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import { calculateDivision } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-builder";
import { tanzaniaLetterGrade } from "@/lib/tanzania-grades";
import { SECONDARY_BEST_SUBJECT_COUNT } from "@/lib/school-level";

function normalizeSecondaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDEF".includes(c)) return c;
  return null;
}

function effectiveSecondaryGradeForNecta(
  s: ReportCardPreviewData["subjects"][number]
): string | null {
  const g = normalizeSecondaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return tanzaniaLetterGrade(s.averagePercentRaw, "secondary");
  }
  return null;
}

function subjectHasScoreForNectaPresence(
  s: ReportCardPreviewData["subjects"][number]
): boolean {
  if (s.hasMajorExamScore !== true) return false;
  return effectiveSecondaryGradeForNecta(s) != null;
}

function scoredSubjectsForNecta(
  preview: ReportCardPreviewData
): ReportCardPreviewData["subjects"] {
  return preview.subjects.filter((s) => subjectHasScoreForNectaPresence(s));
}

function divisionColumnKey(
  label: string | null | undefined
): "I" | "II" | "III" | "IV" | "0" {
  const l = (label ?? "0").trim();
  if (l === "I") return "I";
  if (l === "II") return "II";
  if (l === "III") return "III";
  if (l === "IV") return "IV";
  return "0";
}

export type NectaDivisionBucketKey =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "0"
  | "INC"
  | "ABS";

function nectaAggtAndDiv(preview: ReportCardPreviewData): {
  aggt: string;
  div: string;
} {
  const scored = scoredSubjectsForNecta(preview);
  const n = scored.length;
  if (n === 0) {
    return { aggt: "-", div: "ABS" };
  }
  if (n < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const withGrade = scored
    .map((s) => ({
      avg: s.averagePercentRaw ?? 0,
      grade: effectiveSecondaryGradeForNecta(s),
    }))
    .filter((p): p is { avg: number; grade: string } => p.grade != null);
  if (withGrade.length < SECONDARY_BEST_SUBJECT_COUNT) {
    return { aggt: "-", div: "INC" };
  }
  const best7 = [...withGrade]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, SECONDARY_BEST_SUBJECT_COUNT);
  const calc = calculateDivision(best7.map((p) => p.grade));
  if (!calc) {
    return { aggt: "-", div: "INC" };
  }
  return {
    aggt: String(Math.round(calc.totalPoints)),
    div: calc.division,
  };
}

/**
 * One row per student — same bucketing as the class result sheet division summary.
 */
export function nectaDivisionBucketForReportCard(
  r: CoordinatorReportCardItem
): NectaDivisionBucketKey {
  const { div } = nectaAggtAndDiv(r.preview);
  if (div === "ABS" || div === "INC") return div;
  return divisionColumnKey(div);
}

/** Tanzania / NECTA overall pass: Divisions I–IV. Fail: 0, INC, ABS. */
export function isNectaDivisionOverallPass(
  bucket: NectaDivisionBucketKey
): boolean {
  return (
    bucket === "I" ||
    bucket === "II" ||
    bucket === "III" ||
    bucket === "IV"
  );
}
