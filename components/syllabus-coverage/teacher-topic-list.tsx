"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import {
  SyllabusProgressBar,
  SyllabusTopicProgressMeta,
  SyllabusTopicStatusBadge,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { SyllabusTopicPagination } from "@/components/syllabus-coverage/syllabus-topic-pagination";
import {
  SubtopicNotesButton,
  SubtopicNotesModal,
} from "@/components/syllabus-coverage/subtopic-notes-modal";
import {
  deriveTopicStatus,
  SYLLABUS_STATUS_LABELS,
  topicStatusAccentClass,
} from "@/lib/syllabus-coverage/coverage-stats";
import { formatSyllabusSubtopicActivityLabel } from "@/lib/syllabus-coverage/syllabus-progress-display";
import {
  filterAndSortTeacherTopics,
  type TeacherTopicSortOption,
  type TeacherTopicStatusFilter,
} from "@/lib/syllabus-coverage/teacher-topic-filters";
import type {
  SyllabusSubtopicStatus,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";
import { cn } from "@/lib/utils";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50] as const;

interface NotesTarget {
  subtopicId: string;
  subtopicTitle: string;
  note: string;
  noteUpdatedAt: string | null;
}

interface TeacherTopicListProps {
  workspaceKey: string;
  topics: SyllabusTopicRow[];
  selectedSubtopics: Set<string>;
  saving: boolean;
  noteSaving: boolean;
  onToggleSubtopic: (subtopicId: string) => void;
  onStatusChange: (subtopicId: string, status: SyllabusSubtopicStatus) => void;
  onSaveNote: (subtopicId: string, note: string) => Promise<{ ok: boolean; error?: string }>;
}

export function TeacherTopicList({
  workspaceKey,
  topics,
  selectedSubtopics,
  saving,
  noteSaving,
  onToggleSubtopic,
  onStatusChange,
  onSaveNote,
}: TeacherTopicListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<TeacherTopicStatusFilter>("all");
  const [sortBy, setSortBy] = useState<TeacherTopicSortOption>("default");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandInitializedFor, setExpandInitializedFor] = useState("");
  const [notesTarget, setNotesTarget] = useState<NotesTarget | null>(null);

  const filteredTopics = useMemo(
    () =>
      filterAndSortTeacherTopics(topics, {
        search,
        statusFilter,
        sortBy,
      }),
    [topics, search, statusFilter, sortBy]
  );

  const pageCount = Math.max(1, Math.ceil(filteredTopics.length / rowsPerPage));

  const paginatedTopics = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredTopics.slice(start, start + rowsPerPage);
  }, [filteredTopics, page, rowsPerPage]);

  useEffect(() => {
    setSearch("");
    setStatusFilter("all");
    setSortBy("default");
    setPage(0);
    setRowsPerPage(5);
    setExpandedIds(new Set());
    setExpandInitializedFor("");
    setNotesTarget(null);
  }, [workspaceKey]);

  useEffect(() => {
    if (workspaceKey === expandInitializedFor) return;
    if (topics.length === 0) {
      setExpandedIds(new Set());
      setExpandInitializedFor(workspaceKey);
      return;
    }
    if (topics.length <= 5) {
      setExpandedIds(new Set(topics.map((t) => t.id)));
    } else {
      setExpandedIds(new Set());
    }
    setExpandInitializedFor(workspaceKey);
  }, [workspaceKey, topics, expandInitializedFor]);

  useEffect(() => {
    setExpandedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = [...prev].filter((id) => topics.some((t) => t.id === id));
      return valid.length === prev.size ? prev : new Set(valid);
    });
  }, [topics]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, sortBy, rowsPerPage]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  function toggleTopic(topicId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  function expandAllFiltered() {
    setExpandedIds(new Set(filteredTopics.map((t) => t.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  async function handleSaveNote(note: string) {
    if (!notesTarget) return;
    const res = await onSaveNote(notesTarget.subtopicId, note);
    if (res.ok) setNotesTarget(null);
  }

  const actionsDisabled = saving || noteSaving;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics or subtopics…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs sm:min-w-[9rem] sm:flex-none">
              <span className="font-medium text-slate-600 dark:text-zinc-400">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as TeacherTopicStatusFilter)
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="all">All</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Completed</option>
              </select>
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs sm:min-w-[9rem] sm:flex-none">
              <span className="font-medium text-slate-600 dark:text-zinc-400">
                Sort by
              </span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as TeacherTopicSortOption)
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="default">Default</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="completed_first">Completed First</option>
                <option value="pending_first">Pending First</option>
                <option value="progress">Progress %</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandAllFiltered}
            disabled={filteredTopics.length === 0}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={filteredTopics.length === 0}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Collapse all
          </button>
        </div>
      </div>

      {filteredTopics.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {search.trim() || statusFilter !== "all"
            ? "No topics or subtopics match your search."
            : "No topics yet."}
        </p>
      ) : (
        <>
          <SyllabusTopicPagination
            total={filteredTopics.length}
            page={page}
            pageSize={rowsPerPage}
            onPageChange={setPage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />

          <div className="space-y-3">
            {paginatedTopics.map((topic) => {
              const expanded = expandedIds.has(topic.id);
              const topicStatus = deriveTopicStatus(
                topic.subtopics.map((s) => s.status)
              );

              return (
                <article
                  key={topic.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900",
                    "transition-all duration-200 ease-out",
                    "md:hover:-translate-y-px md:hover:shadow-md",
                    topicStatusAccentClass(topicStatus)
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleTopic(topic.id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                    aria-expanded={expanded}
                  >
                    <ChevronRight
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                        expanded && "rotate-90"
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {topic.title}
                        </h3>
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

                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <ul className="space-y-2 border-t border-slate-100 px-4 py-3 dark:border-zinc-800">
                        {topic.subtopics.map((sub) => {
                          const isCompleted = sub.status === "completed";
                          const activityLabel =
                            formatSyllabusSubtopicActivityLabel(
                              sub.status,
                              sub.updatedAt,
                              sub.completedAt
                            );

                          return (
                            <li
                              key={sub.id}
                              className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm transition-colors duration-200 sm:flex-row sm:flex-wrap sm:items-center dark:bg-zinc-800/60"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                {!isCompleted ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedSubtopics.has(sub.id)}
                                    onChange={() => onToggleSubtopic(sub.id)}
                                    disabled={actionsDisabled}
                                    aria-label={`Select ${sub.title}`}
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary disabled:opacity-50"
                                  />
                                ) : (
                                  <span
                                    className="mt-0.5 inline-block h-4 w-4 shrink-0"
                                    aria-hidden
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="block text-slate-900 dark:text-zinc-100">
                                    {sub.title}
                                  </span>
                                  {activityLabel ? (
                                    <span className="mt-0.5 block text-[11px] font-normal tracking-wide text-slate-500 dark:text-zinc-500">
                                      {activityLabel}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                                <SubtopicNotesButton
                                  hasNote={Boolean(sub.note?.trim())}
                                  disabled={actionsDisabled}
                                  onClick={() =>
                                    setNotesTarget({
                                      subtopicId: sub.id,
                                      subtopicTitle: sub.title,
                                      note: sub.note ?? "",
                                      noteUpdatedAt: sub.noteUpdatedAt,
                                    })
                                  }
                                />
                                <select
                                  value={sub.status}
                                  onChange={(e) =>
                                    onStatusChange(
                                      sub.id,
                                      e.target.value as SyllabusSubtopicStatus
                                    )
                                  }
                                  disabled={actionsDisabled}
                                  className="min-w-[7.5rem] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs transition-colors duration-200 sm:flex-none dark:border-zinc-600 dark:bg-zinc-950"
                                >
                                  {(
                                    Object.keys(
                                      SYLLABUS_STATUS_LABELS
                                    ) as SyllabusSubtopicStatus[]
                                  ).map((status) => (
                                    <option key={status} value={status}>
                                      {SYLLABUS_STATUS_LABELS[status]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <SyllabusTopicPagination
            total={filteredTopics.length}
            page={page}
            pageSize={rowsPerPage}
            onPageChange={setPage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />
        </>
      )}

      <SubtopicNotesModal
        open={notesTarget != null}
        subtopicTitle={notesTarget?.subtopicTitle ?? ""}
        initialNote={notesTarget?.note ?? ""}
        noteUpdatedAt={notesTarget?.noteUpdatedAt ?? null}
        saving={noteSaving}
        onClose={() => !noteSaving && setNotesTarget(null)}
        onSave={handleSaveNote}
      />
    </div>
  );
}
