"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { updateClass, type ClassActionState } from "./actions";
import type { Class } from "@/types/supabase";
import type { SchoolTeacherOption } from "@/lib/class-teacher";

interface EditClassModalProps {
  cls: Class | null;
  parentOptions: { id: string; name: string }[];
  teacherOptions: SchoolTeacherOption[];
  onClose: () => void;
}

export function EditClassModal({
  cls,
  parentOptions,
  teacherOptions,
  onClose,
}: EditClassModalProps) {
  const open = cls != null;
  const [description, setDescription] = useState("");
  const [parentClassId, setParentClassId] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!cls) return;
    setDescription(cls.description ?? "");
    setParentClassId(cls.parent_class_id ?? "");
    setClassTeacherId(cls.class_teacher_id ?? "");
    setTeacherSearch("");
    setError(null);
  }, [cls]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isPending, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selectedTeacherName = useMemo(() => {
    if (!classTeacherId) return null;
    const t = teacherOptions.find((o) => o.id === classTeacherId);
    return t?.full_name ?? null;
  }, [classTeacherId, teacherOptions]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teacherOptions;
    return teacherOptions.filter((t) =>
      t.full_name.toLowerCase().includes(q)
    );
  }, [teacherOptions, teacherSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cls) return;
    const fd = new FormData();
    fd.set("name", cls.name);
    fd.set("description", description);
    fd.set("parent_class_id", parentClassId);
    fd.set("class_teacher_id", classTeacherId);
    startTransition(async () => {
      const result: ClassActionState = await updateClass(cls.id, fd);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        onClose();
      }
    });
  }

  if (!cls) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-class-modal-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="flex h-[100dvh] w-full max-w-none flex-col border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:h-auto sm:max-h-[min(90dvh,40rem)] sm:max-w-lg sm:rounded-2xl sm:border"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
          <div className="min-w-0">
            <h2
              id="edit-class-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Edit class
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-400">
              Update description, parent class, and class teacher.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !isPending && onClose()}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.35)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            ) : null}

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Class name
              </label>
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white">
                {cls.name}
              </p>
            </div>

            <div>
              <label
                htmlFor="edit-class-description"
                className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
              >
                Description
              </label>
              <textarea
                id="edit-class-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description"
                className="mt-1 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>

            {parentOptions.length > 0 ? (
              <div>
                <label
                  htmlFor="edit-class-parent"
                  className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
                >
                  Parent class
                </label>
                <select
                  id="edit-class-parent"
                  value={parentClassId}
                  onChange={(e) => setParentClassId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">— Top-level class —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="edit-class-teacher-search"
                className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
              >
                Class teacher
              </label>
              <input
                id="edit-class-teacher-search"
                type="search"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Search teachers…"
                autoComplete="off"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
              {selectedTeacherName ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                  Selected:{" "}
                  <span className="font-medium text-slate-800 dark:text-zinc-200">
                    {selectedTeacherName}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  None selected
                </p>
              )}
              <div
                className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700"
                role="listbox"
                aria-label="Teachers"
              >
                <button
                  type="button"
                  onClick={() => {
                    setClassTeacherId("");
                    setTeacherSearch("");
                  }}
                  className={`flex w-full items-center border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors dark:border-zinc-800 ${
                    !classTeacherId
                      ? "bg-[rgb(var(--school-primary-rgb)/0.12)] font-medium text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.2)]"
                      : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  None
                </button>
                {filteredTeachers.length === 0 ? (
                  <p className="px-3 py-3 text-center text-sm text-slate-500 dark:text-zinc-400">
                    No teachers match your search.
                  </p>
                ) : (
                  filteredTeachers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setClassTeacherId(t.id);
                        setTeacherSearch("");
                      }}
                      className={`flex w-full items-center border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 dark:border-zinc-800 ${
                        classTeacherId === t.id
                          ? "bg-[rgb(var(--school-primary-rgb)/0.12)] font-medium text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.2)]"
                          : "text-slate-800 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {t.full_name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
            <button
              type="button"
              onClick={() => !isPending && onClose()}
              className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-105 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
