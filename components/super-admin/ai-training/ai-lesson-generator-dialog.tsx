"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saInput,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { GenerationProgress } from "@/components/super-admin/ai-training/generation-progress";
import { LessonReviewPanel } from "@/components/super-admin/ai-training/lesson-review-panel";
import type { CurriculumModuleRow } from "@/lib/ai-training/knowledge-curriculum";
import type {
  GeneratedLessonDraft,
  GenerationStep,
  LessonGenerationResult,
} from "@/lib/ai-training/lesson-generator";
import { GENERATION_STEP_LABELS } from "@/lib/ai-training/lesson-generator";
import type { GenerationMode } from "@/lib/ai-training/lesson-generation-prompt";
import { cn } from "@/lib/utils";

type DialogStep = "configure" | "generating" | "review";

interface AILessonGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  modules: CurriculumModuleRow[];
  initialModuleId?: string | null;
  onSavedToQueue: (count: number) => void;
}

const MODES: { id: GenerationMode; label: string }[] = [
  { id: "10", label: "Generate 10 lessons" },
  { id: "20", label: "Generate 20 lessons" },
  { id: "50", label: "Generate 50 lessons" },
  { id: "fill_remaining", label: "Fill Remaining Lessons" },
];

function buildInitialSteps(): GenerationStep[] {
  return (Object.keys(GENERATION_STEP_LABELS) as Array<keyof typeof GENERATION_STEP_LABELS>).map(
    (id) => ({
      id,
      label: GENERATION_STEP_LABELS[id],
      complete: false,
    })
  );
}

export function AILessonGeneratorDialog({
  open,
  onClose,
  modules,
  initialModuleId,
  onSavedToQueue,
}: AILessonGeneratorDialogProps) {
  const [step, setStep] = useState<DialogStep>("configure");
  const [moduleId, setModuleId] = useState<string>("");
  const [mode, setMode] = useState<GenerationMode>("10");
  const [result, setResult] = useState<LessonGenerationResult | null>(null);
  const [lessons, setLessons] = useState<GeneratedLessonDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueSuccess, setQueueSuccess] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<GenerationStep[]>(buildInitialSteps);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(12);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewLesson, setPreviewLesson] = useState<GeneratedLessonDraft | null>(null);
  const [editLesson, setEditLesson] = useState<GeneratedLessonDraft | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<GeneratedLessonDraft | null>(null);
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === moduleId) ?? null,
    [modules, moduleId]
  );

  useEffect(() => {
    if (open && initialModuleId) {
      setModuleId(initialModuleId);
    }
  }, [open, initialModuleId]);

  useEffect(() => {
    if (!open) {
      setStep("configure");
      setResult(null);
      setLessons([]);
      setError(null);
      setProgressSteps(buildInitialSteps());
      setActiveStepIndex(0);
      setGeneratedCount(0);
      setSelectedIds(new Set());
      setPreviewLesson(null);
      setEditLesson(null);
      setDuplicateReport(null);
      setQueueSuccess(null);
    }
  }, [open]);

  const animateProgress = useCallback(async () => {
    const steps = buildInitialSteps();
    setProgressSteps(steps);
    setActiveStepIndex(0);
    setGeneratedCount(0);
    setEstimatedSeconds(14);

    for (let i = 0; i < steps.length; i++) {
      setActiveStepIndex(i);
      setEstimatedSeconds(Math.max(1, 14 - i * 1.2));
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
      setProgressSteps((prev) =>
        prev.map((s, idx) => (idx <= i ? { ...s, complete: true } : s))
      );
      if (i > 4) {
        setGeneratedCount((c) => c + 1);
      }
    }
  }, []);

  const runGeneration = async (regenerateQuestions?: string[]) => {
    if (!moduleId) return;
    setStep("generating");
    setError(null);

    const progressPromise = animateProgress();

    try {
      const res = await fetch("/api/super-admin/ai-training/generate-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, mode, regenerateQuestions }),
      });
      const data = (await res.json()) as LessonGenerationResult & { error?: string };
      await progressPromise;

      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setResult(data);
      setLessons(data.lessons);
      setGeneratedCount(data.lessons.length);
      setProgressSteps(data.steps);
      setActiveStepIndex(data.steps.length - 1);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("configure");
    }
  };

  const updateLesson = (id: string, patch: Partial<GeneratedLessonDraft>) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  const saveLessonsToApprovalQueue = async (toSave: GeneratedLessonDraft[]) => {
    const res = await fetch("/api/super-admin/ai-training/approval-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessons: toSave,
        sourceMetadata: {
          moduleId,
          mode,
          provider: result?.provider,
        },
      }),
    });
    const data = (await res.json()) as { error?: string; count?: number; message?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to save to approval queue");
    return data;
  };

  const handleSaveToQueue = async (lesson: GeneratedLessonDraft) => {
    setApproving(true);
    try {
      const data = await saveLessonsToApprovalQueue([lesson]);
      updateLesson(lesson.id, { reviewStatus: "approved" });
      setQueueSuccess(
        data.message ??
          "Lessons saved to Approval Queue. Review and publish them when ready."
      );
      onSavedToQueue(data.count ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save to queue failed");
    } finally {
      setApproving(false);
    }
  };

  const handleSaveManyToQueue = async (ids: string[]) => {
    setApproving(true);
    let count = 0;
    try {
      const toSave = ids
        .map((id) => lessons.find((l) => l.id === id))
        .filter((l): l is GeneratedLessonDraft => Boolean(l && l.reviewStatus === "draft"));
      if (!toSave.length) return;
      const data = await saveLessonsToApprovalQueue(toSave);
      for (const lesson of toSave) {
        updateLesson(lesson.id, { reviewStatus: "approved" });
        count++;
      }
      setQueueSuccess(
        data.message ??
          "Lessons saved to Approval Queue. Review and publish them when ready."
      );
      if (count > 0) onSavedToQueue(data.count ?? count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk save failed");
    } finally {
      setApproving(false);
    }
  };

  const handleRegenerate = async (lesson: GeneratedLessonDraft) => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/generate-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          mode: "10",
          regenerateQuestions: [lesson.question],
        }),
      });
      const data = (await res.json()) as LessonGenerationResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      const replacement = data.lessons[0];
      if (replacement) {
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lesson.id
              ? { ...replacement, id: lesson.id, reviewStatus: "draft" as const }
              : l
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExportDrafts = () => {
    const payload = lessons.filter((l) => l.reviewStatus === "draft");
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adakaro-lesson-drafts-${moduleId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-100">
                <Sparkles className="h-4 w-4" />
                AI Lesson Generator
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {step === "configure"
                  ? "Generate curriculum lessons"
                  : step === "generating"
                    ? "Generating drafts…"
                    : "Review generated lessons"}
              </h2>
              <p className="mt-1 text-sm text-indigo-100/90">
                Drafts only — saved to Approval Queue, not published until you publish from the queue.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/80 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {queueSuccess ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {queueSuccess}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {step === "configure" ? (
            <div className="mx-auto max-w-xl space-y-8">
              <div>
                <label className="text-sm font-semibold text-slate-700">Module</label>
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className={cn(saInput, "mt-2 w-full")}
                >
                  <option value="">Select a module…</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedModule ? (
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Stat label="Current" value={selectedModule.completedLessons} />
                  <Stat label="Target" value={selectedModule.targetLessons} />
                  <Stat label="Remaining" value={selectedModule.remainingLessons} />
                </div>
              ) : null}

              <div>
                <p className="text-sm font-semibold text-slate-700">Generation mode</p>
                <div className="mt-3 space-y-2">
                  {MODES.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                        mode === m.id
                          ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={m.id}
                        checked={mode === m.id}
                        onChange={() => setMode(m.id)}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-800">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === "generating" ? (
            <GenerationProgress
              steps={progressSteps}
              activeStepIndex={activeStepIndex}
              generatedCount={generatedCount}
              estimatedSecondsRemaining={Math.round(estimatedSeconds)}
            />
          ) : null}

          {step === "review" && result ? (
            <LessonReviewPanel
              analysis={result.analysis}
              suggestions={result.suggestions}
              lessons={lessons}
              selectedIds={selectedIds}
              onToggleSelect={(id, sel) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (sel) next.add(id);
                  else next.delete(id);
                  return next;
                });
              }}
              onSelectAll={() =>
                setSelectedIds(
                  new Set(lessons.filter((l) => l.reviewStatus === "draft").map((l) => l.id))
                )
              }
              onClearSelection={() => setSelectedIds(new Set())}
              onPreview={setPreviewLesson}
              onEdit={setEditLesson}
              onRegenerate={(l) => void handleRegenerate(l)}
              onApprove={(l) => void handleSaveToQueue(l)}
              onDiscard={(l) => updateLesson(l.id, { reviewStatus: "discarded" })}
              onDuplicateReport={setDuplicateReport}
              onApproveAll={() =>
                void handleSaveManyToQueue(
                  lessons.filter((l) => l.reviewStatus === "draft").map((l) => l.id)
                )
              }
              onApproveSelected={() => void handleSaveManyToQueue([...selectedIds])}
              onDiscardSelected={() => {
                for (const id of selectedIds) {
                  updateLesson(id, { reviewStatus: "discarded" });
                }
                setSelectedIds(new Set());
              }}
              onRegenerateSelected={() => {
                const first = lessons.find((l) => selectedIds.has(l.id));
                if (first) void handleRegenerate(first);
              }}
              onExportDrafts={handleExportDrafts}
              regenerating={regenerating}
              approving={approving}
            />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          {step === "configure" ? (
            <>
              <button type="button" className={saBtnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={saBtnPrimary}
                disabled={!moduleId}
                onClick={() => void runGeneration()}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start Generation
              </button>
            </>
          ) : step === "review" ? (
            <>
              <button
                type="button"
                className={saBtnSecondary}
                onClick={() => setStep("configure")}
              >
                Generate More
              </button>
              <button
                type="button"
                className={saBtnPrimary}
                disabled={approving || !lessons.some((l) => l.reviewStatus === "draft")}
                onClick={() =>
                  void handleSaveManyToQueue(
                    lessons.filter((l) => l.reviewStatus === "draft").map((l) => l.id)
                  )
                }
              >
                {approving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Save to Approval Queue
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait…
            </p>
          )}
        </div>
      </div>

      {previewLesson ? (
        <LessonPreviewDrawer lesson={previewLesson} onClose={() => setPreviewLesson(null)} />
      ) : null}

      {editLesson ? (
        <LessonEditDrawer
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
          onSave={(patch) => {
            updateLesson(editLesson.id, patch);
            setEditLesson(null);
          }}
        />
      ) : null}

      {duplicateReport ? (
        <DuplicateReportModal
          lesson={duplicateReport}
          onClose={() => setDuplicateReport(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function LessonPreviewDrawer({
  lesson,
  onClose,
}: {
  lesson: GeneratedLessonDraft;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Lesson Preview</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm">
          <Field label="Question" value={lesson.question} />
          <Field label="Answer" value={lesson.answer} pre />
          <TagList label="Keywords" items={lesson.keywords} />
          <TagList label="Synonyms" items={lesson.synonyms} />
          <TagList label="Search phrases" items={lesson.search_phrases} />
          <TagList label="Alternative wording" items={lesson.alternative_wording} />
          <TagList label="Related terms" items={lesson.related_terms} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Intent" value={lesson.intentLabel} />
            <Field label="Priority" value={lesson.priority} />
            <Field label="Module" value={lesson.curriculumModule} />
            <Field label="Grade" value={lesson.overallGrade} />
            <Field label="Confidence" value={`${lesson.estimatedConfidence}%`} />
            <Field label="Coverage contribution" value={String(lesson.coverageContribution)} />
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Quality scores</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <span>Knowledge: {lesson.scores.knowledgeScore}</span>
              <span>Writing: {lesson.scores.writingScore}</span>
              <span>Retrieval: {lesson.scores.retrievalScore}</span>
              <span>Intent: {lesson.scores.intentScore}</span>
              <span>Coverage: {lesson.scores.coverageScore}</span>
              <span>Dup risk: {lesson.scores.duplicateRiskPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonEditDrawer({
  lesson,
  onClose,
  onSave,
}: {
  lesson: GeneratedLessonDraft;
  onClose: () => void;
  onSave: (patch: Partial<GeneratedLessonDraft>) => void;
}) {
  const [question, setQuestion] = useState(lesson.question);
  const [answer, setAnswer] = useState(lesson.answer);
  const [priority, setPriority] = useState(lesson.priority);

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Edit Draft</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <label className="text-sm font-medium text-slate-700">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={cn(saInput, "mt-1 w-full")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={12}
              className={cn(saInput, "mt-1 w-full font-mono text-sm")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as GeneratedLessonDraft["priority"])}
              className={cn(saInput, "mt-1 w-full")}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button type="button" className={saBtnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={saBtnPrimary}
            onClick={() => onSave({ question, answer, priority })}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DuplicateReportModal({
  lesson,
  onClose,
}: {
  lesson: GeneratedLessonDraft;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h3 className="font-semibold text-slate-900">Duplicate Report</h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong>Risk level:</strong> {lesson.duplicateRisk}
            </p>
            {lesson.duplicateReason ? (
              <p className="mt-1 text-sm text-slate-600">
                <strong>Reason:</strong> {lesson.duplicateReason}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-slate-500">
              Similarity score: {lesson.scores.duplicateRiskPercent}%
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className={saBtnPrimary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      {pre ? (
        <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
          {value}
        </pre>
      ) : (
        <p className="mt-1 text-slate-800">{value}</p>
      )}
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
