"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  updateFeeType,
  deleteFeeType,
  type FeeTypeActionState,
} from "./actions";

interface FeeTypeData {
  id: string;
  name: string;
  description: string | null;
  is_recurring: boolean;
}

interface FeeTypeRowProps {
  feeType: FeeTypeData;
}

function FeeTypeDescription({
  description,
  className,
}: {
  description: string | null;
  className?: string;
}) {
  if (description) {
    return (
      <p className={cn("text-xs leading-snug text-slate-500 dark:text-zinc-400", className)}>
        {description}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-[11px] italic leading-snug text-slate-400 dark:text-zinc-500",
        className
      )}
    >
      No description
    </p>
  );
}

function FeeTypeStatusBadge({ isRecurring }: { isRecurring: boolean }) {
  if (isRecurring) {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        Recurring
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
      One-time
    </span>
  );
}

const mobileCardClass =
  "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition-all duration-150 hover:shadow-md active:scale-[1.01] active:shadow-md motion-reduce:transform-none dark:border-zinc-700/80 dark:bg-zinc-900 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:hover:shadow-none sm:active:scale-100";

const editButtonClass =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border border-school-primary bg-white px-3 text-sm font-semibold text-school-primary transition-all duration-150 hover:bg-[rgb(var(--school-primary-rgb)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/30 active:scale-[0.99] active:bg-[rgb(var(--school-primary-rgb)/0.12)] dark:border-school-primary dark:bg-zinc-900 dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.12)] sm:h-auto sm:w-auto sm:min-h-0 sm:px-3 sm:py-1.5 sm:font-medium";

const deleteButtonClass =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-all duration-150 hover:border-red-200 hover:text-red-600 hover:bg-red-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/60 active:scale-[0.99] active:border-red-200 active:bg-red-50 active:text-red-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400 dark:active:bg-red-950/40 sm:h-auto sm:w-auto sm:min-h-0 sm:border-red-200 sm:px-3 sm:py-1.5 sm:text-red-600";

export function FeeTypeRow({ feeType }: FeeTypeRowProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const result: FeeTypeActionState = await updateFeeType(
        feeType.id,
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
      const result = await deleteFeeType(feeType.id);
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  }

  if (editing) {
    return (
      <form
        action={handleUpdate}
        className={cn(mobileCardClass, "sm:px-6 sm:py-4")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            name="name"
            defaultValue={feeType.name}
            required
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <input
            name="description"
            defaultValue={feeType.description ?? ""}
            placeholder="Description"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
            <input
              name="is_recurring"
              type="checkbox"
              defaultChecked={feeType.is_recurring}
              className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800"
            />
            Recurring
          </label>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-school-primary px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:brightness-105 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-1.5"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:min-h-0 sm:w-auto sm:py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </form>
    );
  }

  return (
    <div
      className={cn(
        "relative sm:transition-all sm:duration-150 sm:hover:bg-slate-50/70 dark:sm:hover:bg-zinc-800/25",
        mobileCardClass
      )}
    >
      {/* Mobile card */}
      <div className="flex flex-col sm:hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-slate-900 dark:text-white">
            {feeType.name}
          </p>
          <FeeTypeStatusBadge isRecurring={feeType.is_recurring} />
        </div>
        <div className="mt-0.5">
          <FeeTypeDescription description={feeType.description} />
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          <button type="button" onClick={() => setEditing(true)} className={editButtonClass}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className={deleteButtonClass}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Desktop table row */}
      <div className="hidden px-6 py-4 sm:grid sm:grid-cols-[1fr_1fr_80px_auto] sm:items-center sm:gap-4">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {feeType.name}
        </p>
        <FeeTypeDescription
          description={feeType.description}
          className="text-sm not-italic"
        />
        <div>
          <FeeTypeStatusBadge isRecurring={feeType.is_recurring} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600 sm:col-span-full dark:text-red-400">
          {error}
        </p>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Delete &ldquo;{feeType.name}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              This action cannot be undone. Fee structures using this type must
              be updated first.
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
      ) : null}
    </div>
  );
}
