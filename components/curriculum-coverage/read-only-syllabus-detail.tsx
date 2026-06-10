"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  TeacherSyllabusSummaryCards,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { TeacherActivityFeed } from "@/components/syllabus-coverage/teacher-activity-feed";
import {
  deriveTopicStatus,
  SYLLABUS_STATUS_LABELS,
  topicStatusAccentClass,
} from "@/lib/syllabus-coverage/coverage-stats";
import { formatSyllabusSubtopicActivityLabel } from "@/lib/syllabus-coverage/syllabus-progress-display";
import {
  SyllabusProgressBar,
  SyllabusTopicProgressMeta,
  SyllabusTopicStatusBadge,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import type {
  SyllabusCoverageSummary,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";
import { cn } from "@/lib/utils";
import { CurriculumStaleBadge } from "@/components/curriculum-coverage/curriculum-coverage-ui";
import { daysSinceUpdate } from "@/lib/curriculum-coverage/stale";

interface ReadOnlySyllabusDetailProps {
  className: string;
  subjectName: string;
  teacherName: string;
  academicYear: string;
  topics: SyllabusTopicRow[];
  summary: SyllabusCoverageSummary;
}

export function ReadOnlySyllabusDetail({
  className: classLabel,
  subjectName,
  teacherName,
  academicYear,
  topics,
  summary,
}: ReadOnlySyllabusDetailProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (topics.length <= 5) return new Set(topics.map((t) => t.id));
    return new Set();
  });

  const completedTopics = topics.filter((t) => t.isTopicComplete).length;

  let lastUpdateAt: string | null = null;
  for (const topic of topics) {
    for (const sub of topic.subtopics) {
      if (
        sub.updatedAt &&
        (!lastUpdateAt ||
          new Date(sub.updatedAt).getTime() > new Date(lastUpdateAt).getTime())
      ) {
        lastUpdateAt = sub.updatedAt;
      }
    }
  }
  const staleDays = daysSinceUpdate(lastUpdateAt);

  function toggleTopic(topicId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Read-only view
        </p>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Curriculum Coverage Details
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          {classLabel} · {subjectName} · {academicYear} · {teacherName}
        </p>
        <CurriculumStaleBadge staleDays={staleDays} className="mt-1" />
      </header>

      <TeacherSyllabusSummaryCards
        summary={summary}
        completedTopics={completedTopics}
      />

      {topics.length === 0 ? (
        <p className="text-sm text-slate-500">
          No syllabus topics have been created for this subject yet.
        </p>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => {
            const expanded = expandedIds.has(topic.id);
            const topicStatus = deriveTopicStatus(
              topic.subtopics.map((s) => s.status)
            );
            return (
              <article
                key={topic.id}
                className={cn(
                  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900",
                  topicStatusAccentClass(topicStatus)
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                >
                  <ChevronRight
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200",
                      expanded && "rotate-90"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{topic.title}</h3>
                      <SyllabusTopicStatusBadge status={topicStatus} />
                    </div>
                    <SyllabusTopicProgressMeta
                      coveragePercent={topic.coveragePercent}
                      completedSubtopics={topic.completedSubtopics}
                      totalSubtopics={topic.totalSubtopics}
                      className="mt-1"
                    />
                    <SyllabusProgressBar
                      percent={topic.coveragePercent}
                      className="mt-2 max-w-md"
                    />
                  </div>
                </button>
                {expanded ? (
                  <ul className="space-y-2 border-t border-slate-100 px-4 py-3 dark:border-zinc-800">
                    {topic.subtopics.map((sub) => {
                      const activity = formatSyllabusSubtopicActivityLabel(
                        sub.status,
                        sub.updatedAt,
                        sub.completedAt
                      );
                      return (
                        <li
                          key={sub.id}
                          className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-zinc-800/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900 dark:text-zinc-100">
                                {sub.title}
                              </p>
                              {activity ? (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {activity}
                                </p>
                              ) : null}
                              {sub.note?.trim() ? (
                                <p className="mt-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-xs italic text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                                  Note: {sub.note}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {SYLLABUS_STATUS_LABELS[sub.status]}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <TeacherActivityFeed topics={topics} initialLimit={10} />
    </div>
  );
}
