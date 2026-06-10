"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, CheckSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import { TeacherTopicList } from "@/components/syllabus-coverage/teacher-topic-list";
import {
  SyllabusLastActivityBanner,
  TeacherActivityFeed,
} from "@/components/syllabus-coverage/teacher-activity-feed";
import {
  SyllabusStickyProgressSummary,
  SyllabusSubjectCompletionModal,
  SyllabusTeacherEmptyState,
  TeacherSyllabusSummaryCards,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { celebrateSyllabusMilestones } from "@/lib/syllabus-coverage/syllabus-milestones";
import { deriveLastActivityAt } from "@/lib/syllabus-coverage/syllabus-activity";
import type {
  SyllabusCoverageSummary,
  SyllabusSubtopicStatus,
  SyllabusTopicRow,
  TeacherSyllabusAssignment,
} from "@/lib/syllabus-coverage/types";
import {
  bulkCompleteSubtopicsAction,
  loadTeacherSyllabusAssignmentsAction,
  loadTeacherSyllabusWorkspaceAction,
  saveSubtopicNoteAction,
  updateSubtopicProgressAction,
} from "./actions";

function findSubtopicContext(
  topics: SyllabusTopicRow[],
  subtopicId: string
): { topic: SyllabusTopicRow; subtopic: SyllabusTopicRow["subtopics"][0] } | null {
  for (const topic of topics) {
    const subtopic = topic.subtopics.find((s) => s.id === subtopicId);
    if (subtopic) return { topic, subtopic };
  }
  return null;
}

function isLastIncompleteSubtopic(
  topic: SyllabusTopicRow,
  subtopicId: string
): boolean {
  const incomplete = topic.subtopics.filter((s) => s.status !== "completed");
  return incomplete.length === 1 && incomplete[0]?.id === subtopicId;
}

export function TeacherSyllabusCoverageClient() {
  const [assignments, setAssignments] = useState<TeacherSyllabusAssignment[]>(
    []
  );
  const [assignmentKey, setAssignmentKey] = useState("");
  const [topics, setTopics] = useState<SyllabusTopicRow[]>([]);
  const [className, setClassName] = useState("");
  const [summary, setSummary] = useState<SyllabusCoverageSummary>({
    totalTopics: 0,
    totalSubtopics: 0,
    completedSubtopics: 0,
    coveragePercent: 0,
  });
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [subjectCompletionOpen, setSubjectCompletionOpen] = useState(false);
  const [stickySummaryVisible, setStickySummaryVisible] = useState(false);
  const summarySentinelRef = useRef<HTMLDivElement>(null);

  const selectedAssignment = useMemo(() => {
    const [classId, subjectId, academicYear] = assignmentKey.split("|");
    return (
      assignments.find(
        (a) =>
          a.classId === classId &&
          (a.subjectId ?? "") === (subjectId ?? "") &&
          a.academicYear === academicYear
      ) ?? null
    );
  }, [assignments, assignmentKey]);

  const workspaceKey = selectedAssignment
    ? `${selectedAssignment.classId}|${selectedAssignment.subjectId ?? ""}|${selectedAssignment.academicYear}`
    : "";

  const loadWorkspace = useCallback(async () => {
    if (!selectedAssignment) return;
    setWorkspaceLoading(true);
    const res = await loadTeacherSyllabusWorkspaceAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      academicYear: selectedAssignment.academicYear,
    });
    setWorkspaceLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setClassName(res.className);
    setTopics(res.topics);
    setSummary(res.summary);
    setSelectedSubtopics(new Set());
  }, [selectedAssignment]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await loadTeacherSyllabusAssignmentsAction();
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAssignments(res.assignments);
      if (res.assignments[0]) {
        const a = res.assignments[0];
        setAssignmentKey(
          `${a.classId}|${a.subjectId ?? ""}|${a.academicYear}`
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedAssignment) return;
    void loadWorkspace();
  }, [selectedAssignment, loadWorkspace]);

  useEffect(() => {
    const sentinel = summarySentinelRef.current;
    if (!sentinel || topics.length === 0) {
      setStickySummaryVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStickySummaryVisible(entry ? !entry.isIntersecting : false);
      },
      { root: null, rootMargin: "-8px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [topics.length, workspaceKey, workspaceLoading]);

  function toggleSubtopic(id: string) {
    const ctx = findSubtopicContext(topics, id);
    if (ctx?.subtopic.status === "completed") return;

    setSelectedSubtopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function celebrateProgress(params: {
    topicTitle?: string;
    prevCoveragePercent: number;
    newSummary: SyllabusCoverageSummary;
  }) {
    if (params.topicTitle) {
      toast.success("🎉 Topic Completed!", {
        description: `You have completed all subtopics under ${params.topicTitle}.`,
      });
    }

    if (selectedAssignment && workspaceKey) {
      celebrateSyllabusMilestones({
        workspaceKey,
        subjectName: selectedAssignment.subjectName,
        prevCoveragePercent: params.prevCoveragePercent,
        newCoveragePercent: params.newSummary.coveragePercent,
        totalSubtopics: params.newSummary.totalSubtopics,
      });
    }

    if (
      params.newSummary.coveragePercent >= 100 &&
      params.newSummary.totalSubtopics > 0 &&
      params.prevCoveragePercent < 100
    ) {
      setSubjectCompletionOpen(true);
    }
  }

  function scrollToProgressSummary() {
    document
      .getElementById("syllabus-summary")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleStatusChange(
    subtopicId: string,
    status: SyllabusSubtopicStatus
  ) {
    if (!selectedAssignment) return;

    const ctx = findSubtopicContext(topics, subtopicId);
    const prevCoveragePercent = summary.coveragePercent;
    const topicCompleting =
      status === "completed" &&
      ctx != null &&
      !ctx.topic.isTopicComplete &&
      isLastIncompleteSubtopic(ctx.topic, subtopicId);

    setSaving(true);
    const res = await updateSubtopicProgressAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      subtopicId,
      status,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const reload = await loadTeacherSyllabusWorkspaceAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      academicYear: selectedAssignment.academicYear,
    });
    if (!reload.ok) {
      toast.error(reload.error);
      return;
    }

    setClassName(reload.className);
    setTopics(reload.topics);
    setSummary(reload.summary);
    setSelectedSubtopics(new Set());

    celebrateProgress({
      topicTitle: topicCompleting ? ctx?.topic.title : undefined,
      prevCoveragePercent,
      newSummary: reload.summary,
    });
  }

  async function handleBulkComplete() {
    if (!selectedAssignment || selectedSubtopics.size === 0) return;

    const eligibleIds = [...selectedSubtopics].filter((id) => {
      const ctx = findSubtopicContext(topics, id);
      return ctx?.subtopic.status !== "completed";
    });
    if (eligibleIds.length === 0) return;

    const prevCoveragePercent = summary.coveragePercent;
    const topicWasComplete = new Map(
      topics.map((t) => [t.id, t.isTopicComplete])
    );

    setSaving(true);
    const res = await bulkCompleteSubtopicsAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      subtopicIds: eligibleIds,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const reload = await loadTeacherSyllabusWorkspaceAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      academicYear: selectedAssignment.academicYear,
    });
    if (!reload.ok) {
      toast.error(reload.error);
      return;
    }

    setClassName(reload.className);
    setTopics(reload.topics);
    setSummary(reload.summary);
    setSelectedSubtopics(new Set());

    toast.success(`Marked ${res.updated} subtopic(s) as completed.`);

    for (const topic of reload.topics) {
      if (topicWasComplete.get(topic.id) || !topic.isTopicComplete) continue;
      const touched = topic.subtopics.some((s) => eligibleIds.includes(s.id));
      if (touched) {
        toast.success("🎉 Topic Completed!", {
          description: `You have completed all subtopics under ${topic.title}.`,
        });
      }
    }

    celebrateProgress({
      prevCoveragePercent,
      newSummary: reload.summary,
    });
  }

  const selectableCount = useMemo(() => {
    let count = 0;
    for (const id of selectedSubtopics) {
      const ctx = findSubtopicContext(topics, id);
      if (ctx?.subtopic.status !== "completed") count += 1;
    }
    return count;
  }, [selectedSubtopics, topics]);

  const completedTopics = useMemo(
    () => topics.filter((t) => t.isTopicComplete).length,
    [topics]
  );

  const lastActivityAt = useMemo(() => deriveLastActivityAt(topics), [topics]);

  async function handleSaveNote(
    subtopicId: string,
    note: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!selectedAssignment) {
      return { ok: false, error: "Select a class and subject first." };
    }
    setNoteSaving(true);
    const res = await saveSubtopicNoteAction({
      classId: selectedAssignment.classId,
      subjectId: selectedAssignment.subjectId,
      subtopicId,
      note,
    });
    setNoteSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return { ok: false, error: res.error };
    }
    toast.success("Note saved.");
    await loadWorkspace();
    return { ok: true };
  }

  if (loading) {
    return <AsyncLoadingShell message="Loading syllabus coverage…" />;
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-zinc-600 dark:bg-zinc-900">
        <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
          No teaching assignments found. Syllabus progress appears when you are
          assigned to teach a class and subject.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Syllabus Coverage
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Update teaching progress for topics your coordinator has set up.
        </p>
      </header>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-zinc-300">
          Class & subject
        </span>
        <select
          value={assignmentKey}
          onChange={(e) => setAssignmentKey(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
        >
          {assignments.map((a) => {
            const key = `${a.classId}|${a.subjectId ?? ""}|${a.academicYear}`;
            return (
              <option key={key} value={key}>
                {a.className} · {a.subjectName} · {a.academicYear}
              </option>
            );
          })}
        </select>
      </label>

      {workspaceLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading topics…
        </div>
      ) : (
        <>
          {selectedAssignment ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                {className} · {selectedAssignment.subjectName} ·{" "}
                {selectedAssignment.academicYear}
              </p>
              <SyllabusLastActivityBanner lastActivityAt={lastActivityAt} />
            </div>
          ) : null}

          <div ref={summarySentinelRef}>
            <TeacherSyllabusSummaryCards
              summary={summary}
              completedTopics={completedTopics}
            />
          </div>

          {topics.length > 0 ? (
            <SyllabusStickyProgressSummary
              summary={summary}
              visible={stickySummaryVisible}
            />
          ) : null}

          {selectableCount > 0 ? (
            <button
              type="button"
              onClick={() => void handleBulkComplete()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <CheckSquare className="h-4 w-4" aria-hidden />
              Mark {selectableCount} selected as completed
            </button>
          ) : null}

          {topics.length === 0 ? (
            <SyllabusTeacherEmptyState />
          ) : (
            <TeacherTopicList
              workspaceKey={workspaceKey}
              topics={topics}
              selectedSubtopics={selectedSubtopics}
              saving={saving}
              noteSaving={noteSaving}
              onToggleSubtopic={toggleSubtopic}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
              onSaveNote={handleSaveNote}
            />
          )}

          {topics.length > 0 ? <TeacherActivityFeed topics={topics} /> : null}
        </>
      )}

      {selectedAssignment ? (
        <SyllabusSubjectCompletionModal
          open={subjectCompletionOpen}
          onClose={() => setSubjectCompletionOpen(false)}
          onViewProgress={scrollToProgressSummary}
          subjectName={selectedAssignment.subjectName}
          className={className}
        />
      ) : null}
    </div>
  );
}
