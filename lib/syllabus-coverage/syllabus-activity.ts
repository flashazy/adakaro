import { SYLLABUS_STATUS_LABELS } from "@/lib/syllabus-coverage/coverage-stats";
import type {
  SyllabusSubtopicStatus,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";

export interface SyllabusActivityItem {
  id: string;
  subtopicTitle: string;
  topicTitle: string;
  status: SyllabusSubtopicStatus;
  updatedAt: string;
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Relative or absolute last-activity label for the header. */
export function formatSyllabusLastActivity(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Updated just now";
  if (diffMins < 60) {
    return `Updated ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24 && startOfLocalDay(date) === startOfLocalDay(now)) {
    const time = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `Last updated: Today at ${time}`;
  }

  const diffDays = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000
  );
  if (diffDays === 1) {
    const time = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `Last updated: Yesterday at ${time}`;
  }

  const shortDate = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Last updated: ${shortDate} at ${time}`;
}

export function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffDays = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatActivityAction(
  subtopicTitle: string,
  status: SyllabusSubtopicStatus
): string {
  if (status === "completed") {
    return `${subtopicTitle} marked Completed`;
  }
  if (status === "in_progress") {
    return `${subtopicTitle} changed to In Progress`;
  }
  return `${subtopicTitle} set to Not Started`;
}

export function buildRecentActivity(
  topics: SyllabusTopicRow[],
  limit = 10
): SyllabusActivityItem[] {
  const items: SyllabusActivityItem[] = [];

  for (const topic of topics) {
    for (const sub of topic.subtopics) {
      if (!sub.updatedAt) continue;
      items.push({
        id: sub.id,
        subtopicTitle: sub.title,
        topicTitle: topic.title,
        status: sub.status,
        updatedAt: sub.updatedAt,
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
}

export function deriveLastActivityAt(topics: SyllabusTopicRow[]): string | null {
  let latest: string | null = null;

  for (const topic of topics) {
    for (const sub of topic.subtopics) {
      for (const ts of [sub.updatedAt, sub.noteUpdatedAt]) {
        if (!ts) continue;
        if (!latest || new Date(ts).getTime() > new Date(latest).getTime()) {
          latest = ts;
        }
      }
    }
  }

  return latest;
}

export function formatNoteUpdatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffDays = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000
  );

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (diffDays === 0) return `Last note updated: Today ${time}`;
  if (diffDays === 1) return "Last note updated: Yesterday";

  const shortDate = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Last note updated: ${shortDate}`;
}
