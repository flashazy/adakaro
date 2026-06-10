import type { CurriculumCoverageStatus } from "@/lib/curriculum-coverage/types";

/** Expected progress threshold for executive KPIs (rule-based, no AI). */
export const EXPECTED_COVERAGE_PERCENT = 70;

export function deriveCurriculumCoverageStatus(
  coveragePercent: number,
  totalSubtopics: number
): CurriculumCoverageStatus {
  if (totalSubtopics <= 0) return "not_started";
  if (coveragePercent >= 100) return "completed";
  if (coveragePercent >= 70) return "on_track";
  if (coveragePercent >= 40) return "needs_attention";
  if (coveragePercent > 0) return "at_risk";
  return "not_started";
}

export function curriculumStatusLabel(status: CurriculumCoverageStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "on_track":
      return "On Track";
    case "needs_attention":
      return "Needs Attention";
    case "at_risk":
      return "At Risk";
    default:
      return "Not Started";
  }
}

export function curriculumStatusCompactLabel(
  status: CurriculumCoverageStatus
): string {
  switch (status) {
    case "completed":
      return "Complete";
    case "on_track":
      return "On Track";
    case "needs_attention":
      return "Attention";
    case "at_risk":
      return "At Risk";
    default:
      return "Not Started";
  }
}

export function curriculumStatusCompactEmoji(
  status: CurriculumCoverageStatus
): string {
  switch (status) {
    case "completed":
      return "✅";
    case "on_track":
      return "🟢";
    case "needs_attention":
      return "🟠";
    case "at_risk":
      return "🔴";
    default:
      return "⚪";
  }
}

export function curriculumStatusBadgeClass(
  status: CurriculumCoverageStatus
): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50";
    case "on_track":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50";
    case "needs_attention":
      return "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40";
    case "at_risk":
      return "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700";
  }
}

export function aggregateTeacherStatus(
  rows: { coveragePercent: number; totalSubtopics: number }[]
): CurriculumCoverageStatus {
  if (rows.length === 0) return "not_started";
  const avg =
    rows.reduce((s, r) => s + r.coveragePercent, 0) / Math.max(rows.length, 1);
  const hasSubtopics = rows.some((r) => r.totalSubtopics > 0);
  return deriveCurriculumCoverageStatus(Math.round(avg), hasSubtopics ? 1 : 0);
}
