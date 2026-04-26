"use client";

import { useState, useTransition } from "react";
import { deleteClass, type ClassActionState } from "./actions";
import type { Class } from "@/types/supabase";

const DESC_TABLE_MAX = 72;

interface ClassRowProps {
  cls: Class;
  /** Resolved display name for the current class teacher, if any. */
  classTeacherLabel?: string | null;
  /** Indent + style this row as a child stream under a parent class. */
  isStream?: boolean;
  /** Number of children attached to this class (for the badge). */
  streamCount?: number;
  onEdit: (cls: Class) => void;
}

function truncateForTable(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function ClassRow({
  cls,
  classTeacherLabel = null,
  isStream = false,
  streamCount = 0,
  onEdit,
}: ClassRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const descriptionCell = (() => {
    if (streamCount > 0 && !isStream) {
      return (
        cls.description?.trim() ||
        `(${streamCount} stream${streamCount === 1 ? "" : "s"})`
      );
    }
    if (cls.description?.trim()) {
      return truncateForTable(cls.description, DESC_TABLE_MAX);
    }
    return "—";
  })();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClass(cls.id);
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  }

  return (
    <div
      className={`relative px-4 py-4 sm:grid sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-6 ${
        isStream
          ? "border-l-2 border-[rgb(var(--school-primary-rgb)/0.25)] bg-slate-50/60 pl-6 sm:pl-10 dark:border-[rgb(var(--school-primary-rgb)/0.35)] dark:bg-zinc-800/40"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isStream && (
          <span
            aria-hidden
            className="text-xs font-medium text-school-primary dark:text-school-primary"
          >
            ↳
          </span>
        )}
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {cls.name}
        </p>
      </div>
      <p
        className="mt-2 line-clamp-2 text-sm text-slate-500 sm:mt-0 dark:text-zinc-400"
        title={
          cls.description?.trim() && !(streamCount > 0 && !isStream)
            ? cls.description
            : undefined
        }
      >
        {descriptionCell}
      </p>

      <p className="mt-2 text-sm text-slate-700 sm:mt-0 dark:text-zinc-300">
        {cls.class_teacher_id
          ? classTeacherLabel?.trim() || "—"
          : "—"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
        <button
          type="button"
          onClick={() => onEdit(cls)}
          className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="min-h-[44px] rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      </div>

      {error && (
        <p className="col-span-full mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Delete &ldquo;{cls.name}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              This action cannot be undone. Any students in this class must be
              moved first.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
