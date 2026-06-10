"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  coverageBarClass,
  coverageTextClass,
  topicStatusBadgeClass,
  topicStatusLabel,
  type SyllabusTopicStatus,
} from "@/lib/syllabus-coverage/coverage-stats";
import {
  formatStickyProgressLabel,
  formatTopicProgressLabel,
} from "@/lib/syllabus-coverage/syllabus-progress-display";
import type { SyllabusCoverageSummary } from "@/lib/syllabus-coverage/types";

const MICRO_TRANSITION = "transition-all duration-200 ease-out";

export function SyllabusSummaryCards({
  summary,
}: {
  summary: SyllabusCoverageSummary;
}) {
  const cards = [
    { label: "Total topics", value: summary.totalTopics },
    { label: "Total subtopics", value: summary.totalSubtopics },
    { label: "Completed subtopics", value: summary.completedSubtopics },
    {
      label: "Coverage",
      value: `${summary.coveragePercent}%`,
      highlight: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {card.label}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              card.highlight
                ? coverageTextClass(summary.coveragePercent)
                : "text-slate-900 dark:text-white"
            )}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Teacher flagship hero layout — coverage card with embedded progress bar. */
export function TeacherSyllabusSummaryCards({
  summary,
  completedTopics,
}: {
  summary: SyllabusCoverageSummary;
  completedTopics: number;
}) {
  const statCards = [
    { label: "Total topics", value: summary.totalTopics },
    { label: "Total subtopics", value: summary.totalSubtopics },
    { label: "Completed subtopics", value: summary.completedSubtopics },
  ];

  return (
    <div
      id="syllabus-summary"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div
        className={cn(
          "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1 lg:row-span-1 dark:border-zinc-700/80 dark:bg-zinc-900",
          summary.coveragePercent >= 100 &&
            "border-emerald-200/60 dark:border-emerald-900/40",
          summary.coveragePercent > 0 &&
            summary.coveragePercent < 100 &&
            "border-violet-200/50 dark:border-violet-900/30"
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Coverage
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold tabular-nums",
            MICRO_TRANSITION,
            coverageTextClass(summary.coveragePercent)
          )}
        >
          {summary.coveragePercent}%
        </p>
        <div className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-zinc-400">
          <p>
            <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
              {completedTopics}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
              {summary.totalTopics}
            </span>{" "}
            topic{summary.totalTopics === 1 ? "" : "s"} completed
          </p>
          <p>
            <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
              {summary.completedSubtopics}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-slate-800 dark:text-zinc-200">
              {summary.totalSubtopics}
            </span>{" "}
            subtopic{summary.totalSubtopics === 1 ? "" : "s"} completed
          </p>
        </div>
        <SyllabusProgressBar
          percent={summary.coveragePercent}
          className="mt-3"
          size="hero"
        />
      </div>

      {statCards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function SyllabusStickyProgressSummary({
  summary,
  visible,
}: {
  summary: SyllabusCoverageSummary;
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-1 border-b border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95",
        MICRO_TRANSITION,
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1 opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            coverageTextClass(summary.coveragePercent)
          )}
        >
          {formatStickyProgressLabel(
            summary.coveragePercent,
            summary.completedSubtopics,
            summary.totalSubtopics
          )}
        </p>
        <SyllabusProgressBar
          percent={summary.coveragePercent}
          className="sm:max-w-xs"
          size="compact"
        />
      </div>
    </div>
  );
}

interface SyllabusInlineEditProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error?: string | null;
  inputClassName?: string;
  autoFocus?: boolean;
}

/** Inline edit row for topic/subtopic titles (coordinator syllabus manager). */
export function SyllabusInlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  error = null,
  inputClassName,
  autoFocus = true,
}: SyllabusInlineEditProps) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) {
            e.preventDefault();
            onSave();
          }
          if (e.key === "Escape" && !saving) {
            e.preventDefault();
            onCancel();
          }
        }}
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100",
          inputClassName
        )}
      />
      {error ? (
        <p
          className="text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-950/50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-school-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function SyllabusTopicStatusBadge({
  status,
  className,
}: {
  status: SyllabusTopicStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        MICRO_TRANSITION,
        topicStatusBadgeClass(status),
        className
      )}
    >
      {topicStatusLabel(status)}
    </span>
  );
}

export function SyllabusTopicProgressMeta({
  coveragePercent,
  completedSubtopics,
  totalSubtopics,
  className,
}: {
  coveragePercent: number;
  completedSubtopics: number;
  totalSubtopics: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium",
        coverageTextClass(coveragePercent),
        className
      )}
    >
      {formatTopicProgressLabel(
        coveragePercent,
        completedSubtopics,
        totalSubtopics
      )}
    </p>
  );
}

export function SyllabusProgressBar({
  percent,
  className,
  size = "default",
}: {
  percent: number;
  className?: string;
  size?: "default" | "hero" | "compact";
}) {
  const width = Math.min(100, Math.max(0, percent));
  const trackHeight =
    size === "hero" ? "h-2.5" : size === "compact" ? "h-1.5" : "h-2";

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800",
        trackHeight,
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-200 ease-out",
          coverageBarClass(percent)
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function SyllabusTeacherEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-12 text-center shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-900/80">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50/80 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/40">
        <BookOpen
          className="h-7 w-7 text-school-primary dark:text-school-primary"
          aria-hidden
        />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
        No syllabus available yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
        Your coordinator has not created syllabus topics for this subject yet.
      </p>
    </div>
  );
}

interface SyllabusSubjectCompletionModalProps {
  open: boolean;
  onClose: () => void;
  onViewProgress?: () => void;
  subjectName: string;
  className: string;
}

export function SyllabusSubjectCompletionModal({
  open,
  onClose,
  onViewProgress,
  subjectName,
  className: classLabel,
}: SyllabusSubjectCompletionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="syllabus-completion-title"
      onClick={() => onClose()}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-xl transition-all duration-300 dark:border-emerald-900/50 dark:bg-zinc-900",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
          <h2
            id="syllabus-completion-title"
            className="mt-4 text-xl font-semibold text-slate-900 dark:text-white"
          >
            🎉 Syllabus Completed
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            You have successfully completed all topics and subtopics for{" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {subjectName}
            </span>
            {classLabel ? (
              <>
                {" "}
                (<span className="font-medium text-slate-900 dark:text-white">
                  {classLabel}
                </span>
                )
              </>
            ) : null}
            .
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
            Thank you for keeping your syllabus coverage up to date.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-700"
            >
              Continue
            </button>
            {onViewProgress ? (
              <button
                type="button"
                onClick={() => {
                  onViewProgress();
                  onClose();
                }}
                className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors duration-200 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
              >
                View Progress
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
