"use client";

import { useState, useTransition } from "react";
import { updateClass, deleteClass, type ClassActionState } from "./actions";
import type { Class } from "@/types/supabase";

interface ClassRowProps {
  cls: Class;
  /** Other top-level classes available as a parent. Excludes `cls` itself. */
  parentOptions?: { id: string; name: string }[];
  /** Indent + style this row as a child stream under a parent class. */
  isStream?: boolean;
  /** Number of children attached to this class (for the badge). */
  streamCount?: number;
}

export function ClassRow({
  cls,
  parentOptions = [],
  isStream = false,
  streamCount = 0,
}: ClassRowProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const result: ClassActionState = await updateClass(cls.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        setError(null);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClass(cls.id);
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  }

  if (editing) {
    return (
      <form action={handleUpdate} className="px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            name="name"
            defaultValue={cls.name}
            required
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <input
            name="description"
            defaultValue={cls.description ?? ""}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="Description"
          />
          {parentOptions.length > 0 && (
            <select
              name="parent_class_id"
              defaultValue={cls.parent_class_id ?? ""}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">— Top-level class —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {parentOptions.length === 0 && (
            <input type="hidden" name="parent_class_id" value="" />
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-school-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:brightness-105 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div
      className={`relative px-6 py-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4 ${
        isStream
          ? "border-l-2 border-[rgb(var(--school-primary-rgb)/0.25)] bg-slate-50/60 pl-10 dark:border-[rgb(var(--school-primary-rgb)/0.35)] dark:bg-zinc-800/40"
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
      <p className="mt-1 text-sm text-slate-500 sm:mt-0 dark:text-zinc-400">
        {streamCount > 0 && !isStream
          ? cls.description?.trim() ||
            `(${streamCount} stream${streamCount === 1 ? "" : "s"})`
          : cls.description?.trim()
            ? cls.description
            : "—"}
      </p>

      <div className="mt-3 flex gap-2 sm:mt-0">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      </div>

      {error && (
        <p className="col-span-full mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Delete confirmation modal */}
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
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
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
