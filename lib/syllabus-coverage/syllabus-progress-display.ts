import type { SyllabusSubtopicStatus } from "@/lib/syllabus-coverage/types";

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Human-friendly relative day label (Today, Yesterday, N days ago, or short date). */
export function formatSyllabusRelativeDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffDays = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Subtle activity line for teacher subtopic rows. */
export function formatSyllabusSubtopicActivityLabel(
  status: SyllabusSubtopicStatus,
  updatedAt: string | null,
  completedAt: string | null
): string | null {
  if (status === "not_started" && !updatedAt) return null;

  const timestamp =
    status === "completed" ? completedAt ?? updatedAt : updatedAt;
  if (!timestamp) return null;

  const relative = formatSyllabusRelativeDay(timestamp);
  if (status === "completed") {
    return `Completed ${relative}`;
  }
  return `Updated ${relative}`;
}

export function formatTopicProgressLabel(
  coveragePercent: number,
  completedSubtopics: number,
  totalSubtopics: number
): string {
  const percentLabel =
    coveragePercent === 100
      ? "100% Complete"
      : `${coveragePercent}% Complete`;
  return `${percentLabel} • ${completedSubtopics}/${totalSubtopics} completed`;
}

export function formatStickyProgressLabel(
  coveragePercent: number,
  completedSubtopics: number,
  totalSubtopics: number
): string {
  return `Coverage ${coveragePercent}% • ${completedSubtopics}/${totalSubtopics} Completed`;
}
