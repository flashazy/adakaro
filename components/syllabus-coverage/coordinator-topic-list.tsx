"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  SyllabusInlineEdit,
  SyllabusProgressBar,
  SyllabusTopicStatusBadge,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { SyllabusTopicPagination } from "@/components/syllabus-coverage/syllabus-topic-pagination";
import {
  coverageTextClass,
  deriveTopicStatus,
} from "@/lib/syllabus-coverage/coverage-stats";
import type { SyllabusTopicRow } from "@/lib/syllabus-coverage/types";
import { cn } from "@/lib/utils";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20] as const;

function topicMatchesSearch(topic: SyllabusTopicRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (topic.title.toLowerCase().includes(q)) return true;
  return topic.subtopics.some((s) => s.title.toLowerCase().includes(q));
}

interface CoordinatorTopicListProps {
  /** Changes when class/subject/year changes — resets accordion + pagination. */
  workspaceKey: string;
  topics: SyllabusTopicRow[];
  saving: boolean;
  newSubtopicByTopic: Record<string, string>;
  onNewSubtopicChange: (topicId: string, value: string) => void;
  onAddSubtopic: (topicId: string) => void;
  onDeleteTopic: (topicId: string, title: string) => void;
  onDeleteSubtopic: (
    topicId: string,
    subtopicId: string,
    title: string
  ) => void;
  onSaveTopicEdit: (
    topicId: string,
    title: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onSaveSubtopicEdit: (
    topicId: string,
    subtopicId: string,
    title: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function CoordinatorTopicList({
  workspaceKey,
  topics,
  saving,
  newSubtopicByTopic,
  onNewSubtopicChange,
  onAddSubtopic,
  onDeleteTopic,
  onDeleteSubtopic,
  onSaveTopicEdit,
  onSaveSubtopicEdit,
}: CoordinatorTopicListProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingSubtopicKey, setEditingSubtopicKey] = useState<string | null>(
    null
  );
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const actionsDisabled = saving || editSaving;

  const filteredTopics = useMemo(
    () => topics.filter((t) => topicMatchesSearch(t, search)),
    [topics, search]
  );

  const pageCount = Math.max(1, Math.ceil(filteredTopics.length / rowsPerPage));

  useEffect(() => {
    setSearch("");
    setPage(0);
    setRowsPerPage(5);
    setExpandedIds(new Set());
    setEditingTopicId(null);
    setEditingSubtopicKey(null);
    setEditDraft("");
    setEditError(null);
    setEditSaving(false);
  }, [workspaceKey]);

  useEffect(() => {
    if (topics.length === 0) return;
    setExpandedIds((prev) => {
      if (prev.size > 0) {
        const valid = [...prev].filter((id) =>
          topics.some((t) => t.id === id)
        );
        if (valid.length > 0) return new Set(valid);
      }
      return new Set([topics[0]!.id]);
    });
  }, [topics]);

  useEffect(() => {
    setPage(0);
  }, [search, rowsPerPage]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const paginatedTopics = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredTopics.slice(start, start + rowsPerPage);
  }, [filteredTopics, page, rowsPerPage]);

  function toggleTopic(topicId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filteredTopics.map((t) => t.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function cancelEdit() {
    setEditingTopicId(null);
    setEditingSubtopicKey(null);
    setEditDraft("");
    setEditError(null);
  }

  function startTopicEdit(topic: SyllabusTopicRow) {
    setEditingSubtopicKey(null);
    setEditingTopicId(topic.id);
    setEditDraft(topic.title);
    setEditError(null);
    setExpandedIds((prev) => new Set(prev).add(topic.id));
  }

  function startSubtopicEdit(
    topicId: string,
    subtopicId: string,
    title: string
  ) {
    setEditingTopicId(null);
    setEditingSubtopicKey(`${topicId}:${subtopicId}`);
    setEditDraft(title);
    setEditError(null);
    setExpandedIds((prev) => new Set(prev).add(topicId));
  }

  async function saveTopicEdit(topicId: string) {
    setEditSaving(true);
    setEditError(null);
    const res = await onSaveTopicEdit(topicId, editDraft);
    setEditSaving(false);
    if (!res.ok) {
      setEditError(res.error ?? "Could not update topic.");
      return;
    }
    cancelEdit();
  }

  async function saveSubtopicEdit(topicId: string, subtopicId: string) {
    setEditSaving(true);
    setEditError(null);
    const res = await onSaveSubtopicEdit(topicId, subtopicId, editDraft);
    setEditSaving(false);
    if (!res.ok) {
      setEditError(res.error ?? "Could not update subtopic.");
      return;
    }
    cancelEdit();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
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
          <button
            type="button"
            onClick={expandAll}
            disabled={paginatedTopics.length === 0}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={paginatedTopics.length === 0}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Collapse all
          </button>
        </div>
      </div>

      {filteredTopics.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {search.trim()
            ? "No topics match your search."
            : "No topics yet. Add your first topic above."}
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

          <div className="space-y-2">
            {paginatedTopics.map((topic) => {
              const expanded = expandedIds.has(topic.id);
              const isEditingTopic = editingTopicId === topic.id;
              const topicStatus = deriveTopicStatus(
                topic.subtopics.map((s) => s.status)
              );
              return (
                <article
                  key={topic.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900"
                >
                  <div className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      disabled={isEditingTopic}
                      className="shrink-0 self-start px-3 py-3 text-slate-400 transition-colors hover:bg-slate-50/80 disabled:opacity-50 dark:hover:bg-zinc-800/40 md:self-center"
                      aria-expanded={expanded}
                      aria-label={expanded ? "Collapse topic" : "Expand topic"}
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                    {isEditingTopic ? (
                      <div className="min-w-0 flex-1 px-1 py-3 pr-3">
                        <SyllabusInlineEdit
                          value={editDraft}
                          onChange={setEditDraft}
                          onSave={() => void saveTopicEdit(topic.id)}
                          onCancel={cancelEdit}
                          saving={editSaving}
                          error={editError}
                          inputClassName="font-semibold uppercase"
                        />
                      </div>
                    ) : (
                      <div className="flex min-w-0 flex-1 flex-col py-2 pr-2 md:flex-row md:items-center md:justify-between md:gap-6 md:py-3 md:pr-4">
                        <button
                          type="button"
                          onClick={() => toggleTopic(topic.id)}
                          className="w-full px-1 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 md:min-w-0 md:flex-1"
                        >
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {topic.title}
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                            {topic.totalSubtopics} subtopic
                            {topic.totalSubtopics === 1 ? "" : "s"} ·{" "}
                            {topic.completedSubtopics} completed ·{" "}
                            <span
                              className={coverageTextClass(
                                topic.coveragePercent
                              )}
                            >
                              {topic.coveragePercent}%
                            </span>
                          </p>
                          <SyllabusProgressBar
                            percent={topic.coveragePercent}
                            className="mt-2 max-w-xs"
                          />
                        </button>
                        <div className="mt-2 flex items-center gap-1 px-1 md:mt-0 md:shrink-0 md:items-center md:gap-2 md:self-center md:px-0">
                          <SyllabusTopicStatusBadge status={topicStatus} />
                          <button
                            type="button"
                            onClick={() => startTopicEdit(topic)}
                            disabled={actionsDisabled}
                            className="rounded-lg px-2.5 py-2 text-slate-500 hover:bg-slate-50 hover:text-school-primary disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-violet-300"
                            aria-label={`Edit topic ${topic.title}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteTopic(topic.id, topic.title)
                            }
                            disabled={actionsDisabled}
                            className="rounded-lg px-2.5 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            aria-label={`Delete topic ${topic.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-100 px-4 py-3 dark:border-zinc-800">
                      {topic.subtopics.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                          No subtopics yet.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {topic.subtopics.map((sub) => {
                            const subEditKey = `${topic.id}:${sub.id}`;
                            const isEditingSub =
                              editingSubtopicKey === subEditKey;
                            return (
                              <li
                                key={sub.id}
                                className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800/60"
                              >
                                {isEditingSub ? (
                                  <SyllabusInlineEdit
                                    value={editDraft}
                                    onChange={setEditDraft}
                                    onSave={() =>
                                      void saveSubtopicEdit(topic.id, sub.id)
                                    }
                                    onCancel={cancelEdit}
                                    saving={editSaving}
                                    error={editError}
                                  />
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 flex-1">
                                      {sub.title}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          startSubtopicEdit(
                                            topic.id,
                                            sub.id,
                                            sub.title
                                          )
                                        }
                                        disabled={actionsDisabled}
                                        className="inline-flex items-center gap-1 px-1.5 py-1 text-xs text-slate-500 hover:text-school-primary disabled:opacity-50 dark:text-zinc-400 dark:hover:text-violet-300"
                                        aria-label={`Edit subtopic ${sub.title}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDeleteSubtopic(
                                            topic.id,
                                            sub.id,
                                            sub.title
                                          )
                                        }
                                        disabled={actionsDisabled}
                                        className="px-1.5 py-1 text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <input
                          value={newSubtopicByTopic[topic.id] ?? ""}
                          onChange={(e) =>
                            onNewSubtopicChange(topic.id, e.target.value)
                          }
                          placeholder="New subtopic title"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 sm:min-w-[12rem] sm:flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => onAddSubtopic(topic.id)}
                          disabled={actionsDisabled}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-zinc-600 dark:hover:bg-zinc-800 sm:w-auto sm:py-2"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Add subtopic
                        </button>
                      </div>
                    </div>
                  ) : null}
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
    </div>
  );
}
