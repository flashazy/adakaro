"use client";

import { useState, useTransition } from "react";
import {
  updateStudent,
  deleteStudent,
  type StudentActionState,
} from "./actions";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: ClassOption | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

interface StudentRowProps {
  student: StudentData;
  classes: ClassOption[];
}

export function StudentRow({ student, classes }: StudentRowProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const result: StudentActionState = await updateStudent(
        student.id,
        formData
      );
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
      const result = await deleteStudent(student.id);
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  }

  const parentName = student.parent_name || "—";
  const parentEmail = student.parent_email || "";
  const parentPhone = student.parent_phone || "";

  if (editing) {
    return (
      <form action={handleUpdate} className="px-6 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Name
            </label>
            <input
              name="full_name"
              defaultValue={student.full_name}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Adm #
            </label>
            <input
              name="admission_number"
              defaultValue={student.admission_number ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Class
            </label>
            <select
              name="class_id"
              defaultValue={student.class_id}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Parent name
            </label>
            <input
              name="parent_name"
              defaultValue={student.parent_name ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Parent email
            </label>
            <input
              name="parent_email"
              type="email"
              defaultValue={student.parent_email ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Parent phone
            </label>
            <input
              name="parent_phone"
              type="tel"
              defaultValue={student.parent_phone ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
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
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="relative px-6 py-4">
      {/* Desktop row */}
      <div className="hidden lg:grid lg:grid-cols-[100px_1fr_1fr_1fr_auto] lg:items-center lg:gap-4">
        <p className="truncate text-sm font-mono text-slate-600 dark:text-zinc-400">
          {student.admission_number || "—"}
        </p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {student.full_name}
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          {student.class?.name || "—"}
        </p>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-900 dark:text-white">
            {parentName}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
            {parentEmail}
            {parentPhone ? ` · ${parentPhone}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
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
      </div>

      {/* Mobile card */}
      <div className="space-y-2 lg:hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {student.full_name}
            </p>
            {student.admission_number && (
              <p className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                {student.admission_number}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {student.class?.name || "—"}
          </span>
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          <p>
            Parent: {parentName}
            {parentEmail ? ` · ${parentEmail}` : ""}
          </p>
          {parentPhone && <p>Phone: {parentPhone}</p>}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Delete &ldquo;{student.full_name}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              This will permanently remove the student record. Any associated
              payments must be removed first.
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
