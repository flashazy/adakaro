"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateFeeStructure,
  deleteFeeStructure,
  type FeeStructureActionState,
} from "./actions";
import { formatCurrency as formatMoney } from "@/lib/currency";
import {
  blockInvalidKeyDownAmount,
  HINT_ONLY_NUMBERS,
  hasInvalidAmountInput,
  isValidNumericAmountInput,
  onlyNumericAmount,
} from "@/lib/validation";
import { FeeStructureTargetPicker } from "./fee-structure-target-picker";

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

function formatAmountDisplay(value: string): string {
  const clean = onlyNumericAmount(value);
  if (!clean) return "";

  const dotIndex = clean.indexOf(".");
  const intPart = dotIndex === -1 ? clean : clean.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? undefined : clean.slice(dotIndex + 1);
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decPart === undefined) return formattedInt;
  return `${formattedInt}.${decPart}`;
}

const editFieldClass =
  "w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:min-h-0 sm:py-1.5 sm:shadow-none sm:focus:ring-1 sm:focus:ring-school-primary";

const editDateFieldClass =
  "w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer sm:min-h-0 sm:py-1.5 sm:shadow-none sm:focus:ring-1 sm:focus:ring-school-primary";

const editLabelClass =
  "mb-1.5 block text-xs font-medium text-slate-500 dark:text-zinc-400";

function FeeStructureAmount({
  amount,
  currencyCode,
}: {
  amount: number;
  currencyCode: string;
}) {
  const isLargeAmount = amount >= 100_000;

  return (
    <p
      className={cn(
        "text-base tabular-nums leading-tight",
        isLargeAmount
          ? "font-semibold text-slate-900 dark:text-white"
          : "font-medium text-slate-600 dark:text-zinc-400"
      )}
    >
      {formatMoney(amount, currencyCode)}
    </p>
  );
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
  const [amountCharHint, setAmountCharHint] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState(() =>
    formatAmountDisplay(String(structure.amount))
  );
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setAmountDisplay(formatAmountDisplay(String(structure.amount)));
    setAmountCharHint(null);
    setEditing(true);
  }

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
        setAmountCharHint(null);
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
      <form
        className="px-3 py-3 sm:px-6 sm:py-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const raw = String(fd.get("amount") ?? "");
          const clean = onlyNumericAmount(raw);
          fd.set("amount", clean);
          if (!isValidNumericAmountInput(clean)) {
            setError(HINT_ONLY_NUMBERS);
            return;
          }
          setError(null);
          handleUpdate(fd);
        }}
      >
        <div className="mb-3.5 sm:hidden">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Edit Fee Structure
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Update fee amount, target and due date.
          </p>
        </div>

        <input type="hidden" name="target_type" value={targetType} />
        <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <div>
            <label className={editLabelClass}>Fee type</label>
            <select
              name="fee_type_id"
              defaultValue={structure.fee_type_id ?? ""}
              required
              className={editFieldClass}
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
            <label className={editLabelClass}>Amount ({currencyCode})</label>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountDisplay}
              required
              onChange={(e) => {
                const raw = e.currentTarget.value;
                const clean = onlyNumericAmount(raw);
                setAmountCharHint(
                  hasInvalidAmountInput(raw) ? HINT_ONLY_NUMBERS : null
                );
                setAmountDisplay(formatAmountDisplay(clean));
              }}
              onKeyDown={blockInvalidKeyDownAmount}
              className={cn(editFieldClass, "tabular-nums")}
            />
            {amountCharHint ? (
              <p
                className="mt-1 text-[10px] leading-tight text-red-500"
                role="alert"
              >
                {amountCharHint}
              </p>
            ) : null}
          </div>
          <div>
            <label className={editLabelClass}>Target</label>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setTargetType("class")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150",
                  targetType === "class"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90 dark:bg-zinc-600 dark:text-white dark:ring-zinc-500/60"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                Class
              </button>
              <button
                type="button"
                onClick={() => setTargetType("student")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150",
                  targetType === "student"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90 dark:bg-zinc-600 dark:text-white dark:ring-zinc-500/60"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                Student
              </button>
            </div>
            {targetType === "class" ? (
              <FeeStructureTargetPicker
                kind="class"
                name="class_id"
                options={classes}
                defaultValue={structure.class_id ?? ""}
                required
                className="mt-1.5"
              />
            ) : (
              <FeeStructureTargetPicker
                kind="student"
                name="student_id"
                options={students}
                defaultValue={structure.student_id ?? ""}
                required
                className="mt-1.5"
              />
            )}
          </div>
          <div>
            <label className={editLabelClass}>Due date</label>
            <input
              name="due_date"
              type="date"
              defaultValue={structure.due_date ?? ""}
              className={editDateFieldClass}
            />
          </div>
        </div>
        <div className="mt-3.5 flex flex-col gap-2 sm:mt-3 sm:flex-row">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:flex-none sm:px-3 sm:py-1.5 sm:font-medium sm:shadow-none"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
              setAmountCharHint(null);
            }}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:min-h-0 sm:flex-none sm:px-3 sm:py-1.5"
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
    <div className="relative px-3 py-3 sm:px-6 sm:py-4">
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
            onClick={startEditing}
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
      <div className="sm:hidden">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
              {feeTypeName}
            </p>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Amount
              </p>
              <FeeStructureAmount
                amount={Number(structure.amount)}
                currencyCode={currencyCode}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Target
            </p>
            <p className="text-xs text-slate-600 dark:text-zinc-400">{targetName}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
              Due
            </p>
            <p
              className={cn(
                "text-xs",
                structure.due_date
                  ? "text-slate-600 dark:text-zinc-400"
                  : "italic text-slate-400 dark:text-zinc-500"
              )}
            >
              {structure.due_date ?? "No due date provided"}
            </p>
          </div>
        </div>
        <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 dark:border-zinc-800">
          <button
            onClick={startEditing}
            className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
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
