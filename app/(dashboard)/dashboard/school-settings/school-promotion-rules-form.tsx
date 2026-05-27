"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSchoolPromotionRules } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save promotion rules"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export interface ClassPromotionOverrideRow {
  classId: string;
  className: string;
  minAverageGrade: number;
}

export interface SchoolPromotionRulesFormProps {
  canEdit: boolean;
  defaultMinGrade: number | null;
  classOverrides: ClassPromotionOverrideRow[];
}

export function SchoolPromotionRulesForm({
  canEdit,
  defaultMinGrade,
  classOverrides,
}: SchoolPromotionRulesFormProps) {
  const [state, formAction] = useActionState(
    updateSchoolPromotionRules,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Promotion rules saved.
        </div>
      ) : null}

      <fieldset className="space-y-4" disabled={!canEdit}>
        <div>
          <label
            htmlFor="default-min-average-grade"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Default minimum average grade (%)
          </label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Students whose average exam score for the year is at or above this
            value are pre-selected to promote. Leave empty to use manual
            promotion only (until a class sets its own rule).
          </p>
          <input
            id="default-min-average-grade"
            name="default_min_average_grade"
            type="number"
            min={0}
            max={100}
            step={0.1}
            defaultValue={defaultMinGrade ?? ""}
            placeholder="e.g. 50"
            className="mt-2 block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        {classOverrides.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Classes with custom rules
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Edit these from Classes → Edit class.
            </p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-zinc-800 dark:border-zinc-700">
              {classOverrides.map((row) => (
                <li
                  key={row.classId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800 dark:text-zinc-200">
                    {row.className}
                  </span>
                  <span className="text-slate-600 dark:text-zinc-400">
                    {row.minAverageGrade}% minimum
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </fieldset>

      {canEdit ? <SubmitButton /> : null}
    </form>
  );
}
