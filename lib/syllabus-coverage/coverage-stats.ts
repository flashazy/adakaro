import type {
  SyllabusCoverageSummary,
  SyllabusSubtopicStatus,
} from "@/lib/syllabus-coverage/types";

export type CoverageColorState = "complete" | "progress" | "neutral";

export type SyllabusTopicStatus = "not_started" | "in_progress" | "complete";

export function coveragePercent(
  completed: number,
  total: number
): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** 0% neutral, 1–99% in progress (purple), 100% complete (green). */
export function coverageColorState(percent: number): CoverageColorState {
  if (percent >= 100) return "complete";
  if (percent > 0) return "progress";
  return "neutral";
}

export function coverageBarClass(percent: number): string {
  const state = coverageColorState(percent);
  switch (state) {
    case "complete":
      return "bg-emerald-500";
    case "progress":
      return "bg-school-primary";
    default:
      return "bg-slate-300 dark:bg-zinc-600";
  }
}

export function coverageTextClass(percent: number): string {
  const state = coverageColorState(percent);
  switch (state) {
    case "complete":
      return "text-emerald-700 dark:text-emerald-400";
    case "progress":
      return "text-school-primary dark:text-school-primary";
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
      return "bg-school-primary text-white";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function topicStatusLabel(status: SyllabusTopicStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
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
      return "border-l-[5px] border-l-school-primary";
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
