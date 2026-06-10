"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import {
  buildRecentActivity,
  formatActivityAction,
  formatActivityDate,
  formatActivityTime,
  formatSyllabusLastActivity,
} from "@/lib/syllabus-coverage/syllabus-activity";
import type { SyllabusTopicRow } from "@/lib/syllabus-coverage/types";
import { cn } from "@/lib/utils";

interface TeacherActivityFeedProps {
  topics: SyllabusTopicRow[];
  initialLimit?: number;
}

function ActivityIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <CheckCircle2
        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    );
  }
  if (status === "in_progress") {
    return (
      <Clock
        className="h-4 w-4 shrink-0 text-school-primary dark:text-school-primary"
        aria-hidden
      />
    );
  }
  return (
    <Circle
      className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500"
      aria-hidden
    />
  );
}

export function TeacherActivityFeed({
  topics,
  initialLimit = 10,
}: TeacherActivityFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const allActivity = buildRecentActivity(topics, 100);
  const visible = showAll
    ? allActivity
    : allActivity.slice(0, initialLimit);
  const hasMore = allActivity.length > initialLimit;

  if (allActivity.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Recent activity
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Activity will appear here when you update subtopic progress.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        Recent activity
      </h3>
      <ul className="mt-3 space-y-2">
        {visible.map((item) => (
          <li
            key={`${item.id}-${item.updatedAt}`}
            className="flex items-start gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 text-sm transition-colors duration-200 dark:bg-zinc-800/50"
          >
            <ActivityIcon status={item.status} />
            <div className="min-w-0 flex-1">
              <p className="text-slate-800 dark:text-zinc-200">
                {formatActivityAction(item.subtopicTitle, item.status)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                {item.topicTitle} · {formatActivityDate(item.updatedAt)} ·{" "}
                {formatActivityTime(item.updatedAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            "mt-3 text-sm font-medium text-school-primary hover:underline dark:text-school-primary"
          )}
        >
          {showAll ? "Show less" : `View more (${allActivity.length - initialLimit} more)`}
        </button>
      ) : null}
    </section>
  );
}

export function SyllabusLastActivityBanner({
  lastActivityAt,
}: {
  lastActivityAt: string | null;
}) {
  if (!lastActivityAt) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5 dark:border-zinc-700/80 dark:bg-zinc-800/40">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Last activity
      </p>
      <p className="mt-0.5 text-sm text-slate-700 dark:text-zinc-300">
        {formatSyllabusLastActivity(lastActivityAt)}
      </p>
    </div>
  );
}
