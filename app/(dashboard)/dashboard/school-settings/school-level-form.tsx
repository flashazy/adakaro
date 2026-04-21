"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  SCHOOL_LEVEL_DESCRIPTIONS,
  SCHOOL_LEVEL_LABELS,
  SCHOOL_LEVEL_VALUES,
  type SchoolLevel,
} from "@/lib/school-level";
import { updateSchoolLevel } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save school level"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export function SchoolLevelForm({
  currentLevel,
  canEdit,
}: {
  currentLevel: SchoolLevel;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(updateSchoolLevel, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          School level updated. New report cards will use this calculation.
        </div>
      ) : null}

      <fieldset className="space-y-3" disabled={!canEdit}>
        <legend className="sr-only">School level</legend>
        {SCHOOL_LEVEL_VALUES.map((value) => {
          const id = `school-level-${value}`;
          const checked = value === currentLevel;
          return (
            <label
              key={value}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                checked
                  ? "border-school-primary bg-[rgb(var(--school-primary-rgb)/0.12)] dark:border-[rgb(var(--school-primary-rgb)/0.38)] dark:bg-[rgb(var(--school-primary-rgb)/0.14)]"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
              } ${canEdit ? "" : "cursor-not-allowed opacity-70"}`}
            >
              <input
                id={id}
                type="radio"
                name="school_level"
                value={value}
                defaultChecked={checked}
                className="mt-1 h-4 w-4 cursor-pointer accent-school-primary disabled:cursor-not-allowed"
                required
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {SCHOOL_LEVEL_LABELS[value]}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
                  {SCHOOL_LEVEL_DESCRIPTIONS[value]}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {canEdit ? (
        <SubmitButton disabled={false} />
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Only a school admin can change the school level.
        </p>
      )}
    </form>
  );
}
