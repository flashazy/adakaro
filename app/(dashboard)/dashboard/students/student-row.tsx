"use client";

import { Fragment, useState, useTransition } from "react";
import { deleteStudent, type StudentActionState } from "./actions";

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
  gender: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

function genderAbbrev(g: string | null | undefined): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return "—";
}

interface StudentRowProps {
  student: StudentData;
  classes: ClassOption[];
  editingId: string | null;
  editValues: Partial<StudentData>;
  onInlineEdit: (student: StudentData) => void;
  onInlineChange: (field: string, value: string) => void;
  onInlineSave: () => void;
  onInlineCancel: () => void;
}

const inlineCls =
  "h-9 w-full rounded-md border border-gray-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

export function StudentRow({
  student,
  classes,
  editingId,
  editValues,
  onInlineEdit,
  onInlineChange,
  onInlineSave,
  onInlineCancel,
}: StudentRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInline = editingId === student.id;

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

  return (
    <Fragment>
      <tr className="hidden lg:table-row">
        <td className="w-[120px] px-4 py-3 align-middle">
          {isInline ? (
            <input
              type="text"
              value={editValues.admission_number ?? ""}
              onChange={(e) =>
                onInlineChange("admission_number", e.target.value)
              }
              className={inlineCls}
            />
          ) : (
            <span className="truncate font-mono text-sm text-gray-700 dark:text-zinc-300">
              {student.admission_number || "—"}
            </span>
          )}
        </td>
        <td className="w-[220px] px-4 py-3 align-middle">
          {isInline ? (
            <input
              type="text"
              value={editValues.full_name ?? ""}
              onChange={(e) => onInlineChange("full_name", e.target.value)}
              className={inlineCls}
            />
          ) : (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {student.full_name}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                ADM: {student.admission_number || "—"}
              </span>
            </div>
          )}
        </td>
        <td className="w-[120px] px-4 py-3 align-middle">
          {isInline ? (
            <select
              value={editValues.class_id ?? student.class_id}
              onChange={(e) => onInlineChange("class_id", e.target.value)}
              className={inlineCls}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-gray-700 dark:text-zinc-300">
              {student.class?.name || "—"}
            </span>
          )}
        </td>
        <td className="w-[80px] px-4 py-3 align-middle">
          {isInline ? (
            <select
              value={editValues.gender ?? ""}
              onChange={(e) => onInlineChange("gender", e.target.value)}
              className={inlineCls}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          ) : (
            <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-zinc-300">
              {genderAbbrev(student.gender)}
            </span>
          )}
        </td>
        <td className="w-[280px] px-4 py-3 align-middle">
          {isInline ? (
            <div className="flex min-w-0 flex-col gap-1">
              <input
                type="text"
                value={editValues.parent_name ?? ""}
                onChange={(e) => onInlineChange("parent_name", e.target.value)}
                className={inlineCls}
                placeholder="Parent name"
              />
              <input
                type="email"
                value={editValues.parent_email ?? ""}
                onChange={(e) => onInlineChange("parent_email", e.target.value)}
                className={inlineCls}
                placeholder="Email"
              />
              <input
                type="tel"
                value={editValues.parent_phone ?? ""}
                onChange={(e) => onInlineChange("parent_phone", e.target.value)}
                className={inlineCls}
                placeholder="Phone"
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {parentName}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                {parentEmail || "—"}
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {parentPhone || "—"}
              </span>
            </div>
          )}
        </td>
        <td className="w-[120px] px-4 py-3 align-middle">
          <div className="flex flex-wrap gap-2">
            {isInline ? (
              <>
                <button
                  type="button"
                  onClick={onInlineCancel}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onInlineSave}
                  className="rounded-md bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-500"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onInlineEdit(student)}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-9 rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      <tr className="lg:hidden">
        <td
          colSpan={6}
          className="border-b border-slate-200 px-4 py-3 align-middle dark:border-zinc-800"
        >
          {isInline ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editValues.full_name ?? ""}
                onChange={(e) => onInlineChange("full_name", e.target.value)}
                className={inlineCls}
                placeholder="Full name"
              />
              <input
                type="text"
                value={editValues.admission_number ?? ""}
                onChange={(e) =>
                  onInlineChange("admission_number", e.target.value)
                }
                className={inlineCls}
                placeholder="Admission #"
              />
              <select
                value={editValues.class_id ?? student.class_id}
                onChange={(e) => onInlineChange("class_id", e.target.value)}
                className={inlineCls}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={editValues.gender ?? ""}
                onChange={(e) => onInlineChange("gender", e.target.value)}
                className={inlineCls}
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input
                type="text"
                value={editValues.parent_name ?? ""}
                onChange={(e) => onInlineChange("parent_name", e.target.value)}
                className={inlineCls}
                placeholder="Parent name"
              />
              <input
                type="email"
                value={editValues.parent_email ?? ""}
                onChange={(e) => onInlineChange("parent_email", e.target.value)}
                className={inlineCls}
                placeholder="Parent email"
              />
              <input
                type="tel"
                value={editValues.parent_phone ?? ""}
                onChange={(e) => onInlineChange("parent_phone", e.target.value)}
                className={inlineCls}
                placeholder="Parent phone"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={onInlineCancel}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onInlineSave}
                  className="rounded-md bg-blue-600 px-2 py-1 text-sm text-white"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {student.full_name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      ADM: {student.admission_number || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {student.class?.name || "—"}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-zinc-400">
                    {genderAbbrev(student.gender)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {parentName}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {parentEmail || "—"}
                </span>
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {parentPhone || "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onInlineEdit(student)}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-9 rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </td>
      </tr>

      {error && (
        <tr>
          <td
            colSpan={6}
            className="border-b border-slate-200 bg-red-50/50 px-4 py-2 dark:border-zinc-800 dark:bg-red-950/20"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </td>
        </tr>
      )}

      {showDeleteConfirm && (
        <tr>
          <td colSpan={6} className="p-0">
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
          </td>
        </tr>
      )}
    </Fragment>
  );
}
