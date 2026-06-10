import {
  deriveTopicStatus,
  type SyllabusTopicStatus,
} from "@/lib/syllabus-coverage/coverage-stats";
import type { SyllabusTopicRow } from "@/lib/syllabus-coverage/types";

export type TeacherTopicStatusFilter = "all" | SyllabusTopicStatus;

export type TeacherTopicSortOption =
  | "default"
  | "alphabetical"
  | "completed_first"
  | "pending_first"
  | "progress";

export function topicMatchesSearch(topic: SyllabusTopicRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (topic.title.toLowerCase().includes(q)) return true;
  return topic.subtopics.some((s) => s.title.toLowerCase().includes(q));
}

export function topicMatchesStatusFilter(
  topic: SyllabusTopicRow,
  filter: TeacherTopicStatusFilter
): boolean {
  if (filter === "all") return true;
  const status = deriveTopicStatus(topic.subtopics.map((s) => s.status));
  return status === filter;
}

export function sortTeacherTopics(
  topics: SyllabusTopicRow[],
  sortBy: TeacherTopicSortOption
): SyllabusTopicRow[] {
  const list = [...topics];
  switch (sortBy) {
    case "alphabetical":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "completed_first":
      return list.sort((a, b) => {
        const diff = Number(b.isTopicComplete) - Number(a.isTopicComplete);
        if (diff !== 0) return diff;
        return a.sortOrder - b.sortOrder;
      });
    case "pending_first":
      return list.sort((a, b) => {
        const diff = Number(a.isTopicComplete) - Number(b.isTopicComplete);
        if (diff !== 0) return diff;
        return a.sortOrder - b.sortOrder;
      });
    case "progress":
      return list.sort((a, b) => {
        const diff = b.coveragePercent - a.coveragePercent;
        if (diff !== 0) return diff;
        return a.sortOrder - b.sortOrder;
      });
    default:
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export function filterAndSortTeacherTopics(
  topics: SyllabusTopicRow[],
  params: {
    search: string;
    statusFilter: TeacherTopicStatusFilter;
    sortBy: TeacherTopicSortOption;
  }
): SyllabusTopicRow[] {
  const filtered = topics.filter(
    (t) =>
      topicMatchesSearch(t, params.search) &&
      topicMatchesStatusFilter(t, params.statusFilter)
  );
  return sortTeacherTopics(filtered, params.sortBy);
}
