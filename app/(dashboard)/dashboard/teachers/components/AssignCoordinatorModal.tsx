"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type {
  CoordinatorClassOption,
  TeacherActionState,
} from "../types";

interface AssignCoordinatorModalProps {
  teacherUserId: string;
  teacherName: string;
  classOptions: CoordinatorClassOption[];
  initialClassIds: string[];
  onClose: () => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  flash: TeacherActionState | null;
}

function renderFlash(state: TeacherActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

export function AssignCoordinatorModal({
  teacherUserId,
  teacherName,
  classOptions,
  initialClassIds,
  onClose,
  formAction,
  pending,
  flash,
}: AssignCoordinatorModalProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialClassIds)
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classOptions;
    return classOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [classOptions, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-coordinator-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-subject-modal-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="assign-coordinator-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Assign as Coordinator
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              {teacherName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          {renderFlash(flash)}
          <input type="hidden" name="teacher_user_id" value={teacherUserId} />
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Select one or more classes for this Academic teacher to coordinate.
            Coordinators see an overview of their class, subjects taught, exam
            submission status, and student report cards.
          </p>

          {classOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
              No classes exist for your school yet. Create classes first, then
              come back here.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search classes…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-500 dark:text-zinc-400">
                    No classes match your search.
                  </p>
                ) : (
                  filtered.map((c) => {
                    const checked = selected.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                          checked
                            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/40"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="class_ids"
                          value={c.id}
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="font-medium text-slate-900 dark:text-white">
                          {c.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                {selected.size === 0
                  ? "No classes selected. Saving will remove the coordinator role entirely."
                  : `${selected.size} class${selected.size === 1 ? "" : "es"} selected.`}
              </p>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || classOptions.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save coordinator classes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
