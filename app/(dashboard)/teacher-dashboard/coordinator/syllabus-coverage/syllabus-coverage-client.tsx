"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, FileStack, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { BulkSyllabusImportModal } from "@/components/syllabus-coverage/bulk-syllabus-import-modal";
import { CoordinatorTopicList } from "@/components/syllabus-coverage/coordinator-topic-list";
import {
  SyllabusSummaryCards,
  TeacherCoverageOverviewSection,
} from "@/components/syllabus-coverage/syllabus-coverage-ui";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import type {
  SyllabusClassOption,
  SyllabusCoverageOverviewRow,
  SyllabusCoverageSummary,
  SyllabusSubjectOption,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";
import {
  bulkImportSyllabusAction,
  deleteSyllabusSubtopicAction,
  deleteSyllabusTopicAction,
  loadCoordinatorSyllabusClassesAction,
  loadCoordinatorSyllabusSubjectsAction,
  loadCoordinatorSyllabusWorkspaceAction,
  saveSyllabusSubtopicAction,
  saveSyllabusTopicAction,
} from "./actions";

function yearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [];
  for (let y = current - 2; y <= current + 1; y += 1) years.push(String(y));
  return years;
}

type SyllabusDeleteTarget =
  | { kind: "topic"; topicId: string; title: string }
  | {
      kind: "subtopic";
      topicId: string;
      subtopicId: string;
      title: string;
    };

export function CoordinatorSyllabusCoverageClient() {
  const [classes, setClasses] = useState<SyllabusClassOption[]>([]);
  const [subjects, setSubjects] = useState<SyllabusSubjectOption[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear()));
  const [className, setClassName] = useState("");
  const [topics, setTopics] = useState<SyllabusTopicRow[]>([]);
  const [summary, setSummary] = useState<SyllabusCoverageSummary>({
    totalTopics: 0,
    totalSubtopics: 0,
    completedSubtopics: 0,
    coveragePercent: 0,
  });
  const [overview, setOverview] = useState<SyllabusCoverageOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newSubtopicByTopic, setNewSubtopicByTopic] = useState<
    Record<string, string>
  >({});
  const [deleteTarget, setDeleteTarget] = useState<SyllabusDeleteTarget | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedSubject = useMemo(
    () => subjects.find((s) => (s.subjectId ?? "") === subjectId) ?? null,
    [subjects, subjectId]
  );

  const loadWorkspace = useCallback(async () => {
    if (!classId || !subjectId) return;
    setWorkspaceLoading(true);
    const res = await loadCoordinatorSyllabusWorkspaceAction({
      classId,
      subjectId: subjectId || null,
      academicYear,
    });
    setWorkspaceLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setClassName(res.className);
    setTopics(res.topics);
    setSummary(res.summary);
    setOverview(res.overview);
  }, [classId, subjectId, academicYear]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await loadCoordinatorSyllabusClassesAction();
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setClasses(res.classes);
      if (res.classes[0]) setClassId(res.classes[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      const res = await loadCoordinatorSyllabusSubjectsAction(classId);
      if (!res.ok) {
        toast.error(res.error);
        setSubjects([]);
        return;
      }
      setSubjects(res.subjects);
      if (res.subjects[0]?.subjectId) {
        setSubjectId(res.subjects[0].subjectId);
      } else {
        setSubjectId("");
      }
    })();
  }, [classId]);

  useEffect(() => {
    if (!classId || !subjectId) return;
    void loadWorkspace();
  }, [classId, subjectId, academicYear, loadWorkspace]);

  async function handleAddTopic() {
    if (!classId || !subjectId || !selectedSubject) return;
    const title = newTopicTitle.trim();
    if (!title) {
      toast.error("Enter a topic title.");
      return;
    }
    setSaving(true);
    const res = await saveSyllabusTopicAction({
      classId,
      subjectId: selectedSubject.subjectId,
      subjectName: selectedSubject.name,
      academicYear,
      title,
      sortOrder: topics.length,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewTopicTitle("");
    toast.success("Topic added.");
    await loadWorkspace();
  }

  async function handleBulkImport(text: string) {
    if (!classId || !subjectId || !selectedSubject) {
      return { ok: false, message: "Select a class and subject first." };
    }
    setImporting(true);
    const res = await bulkImportSyllabusAction({
      classId,
      subjectId: selectedSubject.subjectId,
      subjectName: selectedSubject.name,
      academicYear,
      text,
    });
    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return { ok: false, message: res.error };
    }
    toast.success(res.message);
    await loadWorkspace();
    return { ok: true, message: res.message };
  }

  async function handleSaveTopicEdit(
    topicId: string,
    title: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!classId || !selectedSubject) {
      return { ok: false, error: "Select a class and subject first." };
    }
    const topic = topics.find((t) => t.id === topicId);
    const res = await saveSyllabusTopicAction({
      classId,
      subjectId: selectedSubject.subjectId,
      subjectName: selectedSubject.name,
      academicYear,
      topicId,
      title,
      sortOrder: topic?.sortOrder,
    });
    if (!res.ok) return { ok: false, error: res.error };
    toast.success("Topic updated.");
    await loadWorkspace();
    return { ok: true };
  }

  async function handleSaveSubtopicEdit(
    topicId: string,
    subtopicId: string,
    title: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!classId) {
      return { ok: false, error: "Select a class first." };
    }
    const topic = topics.find((t) => t.id === topicId);
    const sub = topic?.subtopics.find((s) => s.id === subtopicId);
    const res = await saveSyllabusSubtopicAction({
      classId,
      topicId,
      subtopicId,
      title,
      sortOrder: sub?.sortOrder,
    });
    if (!res.ok) return { ok: false, error: res.error };
    toast.success("Subtopic updated.");
    await loadWorkspace();
    return { ok: true };
  }

  async function handleAddSubtopic(topicId: string) {
    if (!classId) return;
    const title = (newSubtopicByTopic[topicId] ?? "").trim();
    if (!title) {
      toast.error("Enter a subtopic title.");
      return;
    }
    setSaving(true);
    const topic = topics.find((t) => t.id === topicId);
    const res = await saveSyllabusSubtopicAction({
      classId,
      topicId,
      title,
      sortOrder: topic?.subtopics.length ?? 0,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewSubtopicByTopic((prev) => ({ ...prev, [topicId]: "" }));
    toast.success("Subtopic added.");
    await loadWorkspace();
  }

  function requestDeleteTopic(topicId: string, title: string) {
    setDeleteError(null);
    setDeleteTarget({ kind: "topic", topicId, title });
  }

  function requestDeleteSubtopic(
    topicId: string,
    subtopicId: string,
    title: string
  ) {
    setDeleteError(null);
    setDeleteTarget({ kind: "subtopic", topicId, subtopicId, title });
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || !classId) return;
    setDeleting(true);
    setDeleteError(null);

    const res =
      deleteTarget.kind === "topic"
        ? await deleteSyllabusTopicAction({
            classId,
            topicId: deleteTarget.topicId,
          })
        : await deleteSyllabusSubtopicAction({
            classId,
            topicId: deleteTarget.topicId,
            subtopicId: deleteTarget.subtopicId,
          });

    setDeleting(false);

    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }

    setDeleteTarget(null);
    setDeleteError(null);
    toast.success(
      deleteTarget.kind === "topic" ? "Topic deleted." : "Subtopic deleted."
    );
    await loadWorkspace();
  }

  if (loading) {
    return <AsyncLoadingShell message="Loading syllabus coverage…" />;
  }

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-zinc-600 dark:bg-zinc-900">
        <BookOpen className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
          You are not assigned as a class coordinator. Syllabus structure is
          managed by coordinators for their classes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Syllabus Coverage
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Create topics and subtopics for your coordinated class. Subject
          teachers update teaching progress.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900">
        <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Class / form
          </span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Academic year
          </span>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Subject
          </span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            disabled={subjects.length === 0}
          >
            {subjects.map((s) => (
              <option key={s.subjectId ?? s.name} value={s.subjectId ?? ""}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {workspaceLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading coverage…
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            {className}
            {selectedSubject ? ` · ${selectedSubject.name}` : ""} · {academicYear}
          </p>

          <SyllabusSummaryCards summary={summary} />

          {overview.length > 0 ? (
            <TeacherCoverageOverviewSection rows={overview} />
          ) : null}

          <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:min-w-[12rem] sm:flex-1">
                <span className="font-medium">New topic</span>
                <input
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. Algebra foundations"
                  className="rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleAddTopic()}
                  disabled={saving || importing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:w-auto sm:py-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add topic
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  disabled={saving || importing || !selectedSubject}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-950/50 sm:w-auto sm:py-2"
                >
                  <FileStack className="h-4 w-4" aria-hidden />
                  Bulk add syllabus
                </button>
              </div>
            </div>

            <CoordinatorTopicList
              workspaceKey={`${classId}|${subjectId}|${academicYear}`}
              topics={topics}
              saving={saving || deleting}
              newSubtopicByTopic={newSubtopicByTopic}
              onNewSubtopicChange={(topicId, value) =>
                setNewSubtopicByTopic((prev) => ({ ...prev, [topicId]: value }))
              }
              onAddSubtopic={(topicId) => void handleAddSubtopic(topicId)}
              onDeleteTopic={requestDeleteTopic}
              onDeleteSubtopic={requestDeleteSubtopic}
              onSaveTopicEdit={handleSaveTopicEdit}
              onSaveSubtopicEdit={handleSaveSubtopicEdit}
            />
          </section>
        </>
      )}

      <BulkSyllabusImportModal
        open={bulkModalOpen}
        onClose={() => !importing && setBulkModalOpen(false)}
        onImport={handleBulkImport}
        importing={importing}
        subjectName={selectedSubject?.name ?? null}
      />

      <ConfirmDeleteModal
        open={deleteTarget != null}
        onClose={closeDeleteModal}
        onConfirm={() => void confirmDelete()}
        title={
          deleteTarget?.kind === "subtopic"
            ? "Delete subtopic?"
            : "Delete topic?"
        }
        message={
          deleteTarget?.kind === "subtopic"
            ? "This subtopic will be removed from the syllabus. This action cannot be undone."
            : "This will delete the topic and all its subtopics. This action cannot be undone."
        }
        confirmLabel={
          deleteTarget?.kind === "subtopic" ? "Delete subtopic" : "Delete topic"
        }
        itemName={deleteTarget?.title}
        error={deleteError}
        isDeleting={deleting}
        showWarningIcon
      />

    </div>
  );
}
