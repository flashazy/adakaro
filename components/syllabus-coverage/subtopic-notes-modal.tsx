"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, StickyNote, X } from "lucide-react";
import { formatNoteUpdatedLabel } from "@/lib/syllabus-coverage/syllabus-activity";
import { cn } from "@/lib/utils";

const NOTE_MAX = 1000;

export interface SubtopicNotesModalProps {
  open: boolean;
  subtopicTitle: string;
  initialNote: string;
  noteUpdatedAt: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
}

export function SubtopicNotesModal({
  open,
  subtopicTitle,
  initialNote,
  noteUpdatedAt,
  saving,
  onClose,
  onSave,
}: SubtopicNotesModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(initialNote);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDraft(initialNote);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open, initialNote]);

  if (!open || !mounted) return null;

  const remaining = NOTE_MAX - draft.length;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[220] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !saving && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900",
          "transition-all duration-200",
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 sm:translate-y-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Teacher notes
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">
              {subtopicTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={draft}
          onChange={(e) =>
            setDraft(e.target.value.slice(0, NOTE_MAX))
          }
          disabled={saving}
          rows={5}
          placeholder="Observations, challenges, revision reminders…"
          className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-500">
          {noteUpdatedAt ? (
            <span>{formatNoteUpdatedLabel(noteUpdatedAt)}</span>
          ) : (
            <span>No note saved yet</span>
          )}
          <span className={cn(remaining < 50 && "text-amber-600")}>
            {remaining} characters left
          </span>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-2 text-sm font-medium text-violet-800 disabled:opacity-50 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave(draft.trim())}
            disabled={saving || !draft.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save note"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SubtopicNotesButton({
  hasNote,
  onClick,
  disabled,
}: {
  hasNote: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-200",
        hasNote
          ? "text-school-primary hover:bg-violet-50 dark:text-school-primary dark:hover:bg-violet-950/30"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
        disabled && "opacity-50"
      )}
      aria-label={hasNote ? "Edit notes" : "Add notes"}
    >
      <StickyNote className="h-3.5 w-3.5" aria-hidden />
      Notes
    </button>
  );
}
