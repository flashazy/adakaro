"use client";

import { useState, useTransition } from "react";
import {
  updateFeeStructure,
  deleteFeeStructure,
  type FeeStructureActionState,
} from "./actions";
import { formatCurrency as formatMoney } from "@/lib/currency";

interface Option {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
}

interface FeeStructureData {
  id: string;
  fee_type_id: string | null;
  class_id: string | null;
  student_id: string | null;
  amount: number;
  due_date: string | null;
  fee_type: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  student: { id: string; full_name: string } | null;
}

interface Props {
  structure: FeeStructureData;
  feeTypes: Option[];
  classes: Option[];
  students: StudentOption[];
  currencyCode: string;
}

export function FeeStructureRow({
  structure,
  feeTypes,
  classes,
  students,
  currencyCode,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [targetType, setTargetType] = useState<"class" | "student">(
    structure.student_id ? "student" : "class"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const result: FeeStructureActionState = await updateFeeStructure(
        structure.id,
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
      const result = await deleteFeeStructure(structure.id);
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  }

  const feeTypeName = structure.fee_type?.name ?? "—";
  const targetName = structure.student
    ? structure.student.full_name
    : structure.class?.name ?? "All classes";

  if (editing) {
    return (
      <form action={handleUpdate} className="px-6 py-4">
        <input type="hidden" name="target_type" value={targetType} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Fee type
            </label>
            <select
              name="fee_type_id"
              defaultValue={structure.fee_type_id ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Select</option>
              {feeTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Amount ({currencyCode})
            </label>
            <input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              defaultValue={structure.amount}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Target
            </label>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setTargetType("class")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  targetType === "class"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Class
              </button>
              <button
                type="button"
                onClick={() => setTargetType("student")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  targetType === "student"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Student
              </button>
            </div>
            {targetType === "class" ? (
              <select
                name="class_id"
                defaultValue={structure.class_id ?? ""}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="student_id"
                defaultValue={structure.student_id ?? ""}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.admission_number ? ` (${s.admission_number})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Due date
            </label>
            <input
              name="due_date"
              type="date"
              defaultValue={structure.due_date ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
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
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>
    );
  }

  return (
    <div className="relative px-6 py-4">
      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_100px_100px_auto] sm:items-center sm:gap-4">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {feeTypeName}
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          {targetName}
        </p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {formatMoney(Number(structure.amount), currencyCode)}
        </p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {structure.due_date ?? "—"}
        </p>
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

      {/* Mobile */}
      <div className="space-y-2 sm:hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {feeTypeName}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {targetName}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
            {formatMoney(Number(structure.amount), currencyCode)}
          </p>
        </div>
        {structure.due_date && (
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Due: {structure.due_date}
          </p>
        )}
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Delete this fee structure?
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              This cannot be undone. Existing payments referencing this
              structure must be removed first.
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
