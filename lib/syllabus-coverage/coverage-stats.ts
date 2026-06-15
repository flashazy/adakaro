import type {
  SyllabusCoverageSummary,
  SyllabusSubtopicStatus,
} from "@/lib/syllabus-coverage/types";

export type CoverageColorState = "high" | "medium" | "low" | "neutral";

export type SyllabusTopicStatus = "not_started" | "in_progress" | "complete";

/** Actual syllabus coverage: round(completed ÷ total × 100). See ADMIN_COVERAGE_CALCULATIONS.md. */
export function coveragePercent(
  completed: number,
  total: number
): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** 0% gray, 1–49% amber, 50–79% blue, 80–100% green. */
export function coverageColorState(percent: number): CoverageColorState {
  if (percent >= 80) return "high";
  if (percent >= 50) return "medium";
  if (percent > 0) return "low";
  return "neutral";
}

export function coverageBarClass(percent: number): string {
  const state = coverageColorState(percent);
  switch (state) {
    case "high":
      return "bg-emerald-500";
    case "medium":
      return "bg-blue-500";
    case "low":
      return "bg-amber-500";
    default:
      return "bg-slate-300 dark:bg-zinc-600";
  }
}

export function coverageTextClass(percent: number): string {
  const state = coverageColorState(percent);
  switch (state) {
    case "high":
      return "text-emerald-700 dark:text-emerald-400";
    case "medium":
      return "text-blue-700 dark:text-blue-400";
    case "low":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-slate-500 dark:text-zinc-400";
  }
}

export function deriveTopicStatus(
  subtopicStatuses: SyllabusSubtopicStatus[]
): SyllabusTopicStatus {
  if (subtopicStatuses.length === 0) return "not_started";
  if (subtopicStatuses.every((s) => s === "completed")) return "complete";
  if (subtopicStatuses.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}

export function topicStatusBadgeClass(status: SyllabusTopicStatus): string {
  switch (status) {
    case "complete":
      return "bg-emerald-600 text-white";
    case "in_progress":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function topicStatusLabel(status: SyllabusTopicStatus): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

/** Left accent border for teacher topic cards (4px subtle status line). */
export function topicStatusAccentClass(status: SyllabusTopicStatus): string {
  switch (status) {
    case "complete":
      return "border-l-[5px] border-l-emerald-500";
    case "in_progress":
      return "border-l-[5px] border-l-amber-500";
    default:
      return "border-l-[5px] border-l-slate-300 dark:border-l-zinc-600";
  }
}

export function buildCoverageSummary(
  subtopicStatuses: SyllabusSubtopicStatus[],
  topicCount: number
): SyllabusCoverageSummary {
  const totalSubtopics = subtopicStatuses.length;
  const completedSubtopics = subtopicStatuses.filter(
    (s) => s === "completed"
  ).length;
  return {
    totalTopics: topicCount,
    totalSubtopics,
    completedSubtopics,
    coveragePercent: coveragePercent(completedSubtopics, totalSubtopics),
  };
}

export function isTopicComplete(
  subtopicStatuses: SyllabusSubtopicStatus[]
): boolean {
  if (subtopicStatuses.length === 0) return false;
  return subtopicStatuses.every((s) => s === "completed");
}

export const SYLLABUS_STATUS_LABELS: Record<SyllabusSubtopicStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};
