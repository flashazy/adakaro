"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateSchoolAcademicSettings } from "./actions";
import type {
  SchoolSettingsState,
  TermStructureValue,
} from "./school-settings-shared";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save academic settings"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export interface SchoolAcademicSettingsFormProps {
  canEdit: boolean;
  initial: {
    currentAcademicYear: string | null;
    termStructure: TermStructureValue;
    term1Start: string | null;
    term1End: string | null;
    term2Start: string | null;
    term2End: string | null;
    term3Start: string | null;
    term3End: string | null;
  };
}

export function SchoolAcademicSettingsForm({
  canEdit,
  initial,
}: SchoolAcademicSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateSchoolAcademicSettings,
    initialState
  );
  const [termStructure, setTermStructure] = useState<TermStructureValue>(
    initial.termStructure
  );
  const threeTerms = termStructure === "3_terms";

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Academic settings saved.
        </div>
      ) : null}

      <fieldset className="space-y-4" disabled={!canEdit}>
        <div>
          <label
            htmlFor="current-academic-year"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Current academic year
          </label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Label shown across reports (e.g. 2025/2026).
          </p>
          <input
            id="current-academic-year"
            name="current_academic_year"
            type="text"
            placeholder="e.g. 2025/2026"
            defaultValue={initial.currentAcademicYear ?? ""}
            className="mt-1.5 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Term structure
          </span>
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="radio"
                name="term_structure"
                value="2_terms"
                checked={termStructure === "2_terms"}
                onChange={() => setTermStructure("2_terms")}
                className="h-4 w-4 accent-school-primary"
              />
              2 terms per year
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="radio"
                name="term_structure"
                value="3_terms"
                checked={termStructure === "3_terms"}
                onChange={() => setTermStructure("3_terms")}
                className="h-4 w-4 accent-school-primary"
              />
              3 terms per year
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Term 1
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="term-1-start"
                className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
              >
                Start date
              </label>
              <input
                id="term-1-start"
                name="term_1_start"
                type="date"
                defaultValue={dateInputValue(initial.term1Start)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="term-1-end"
                className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
              >
                End date
              </label>
              <input
                id="term-1-end"
                name="term_1_end"
                type="date"
                defaultValue={dateInputValue(initial.term1End)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Term 2
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="term-2-start"
                className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
              >
                Start date
              </label>
              <input
                id="term-2-start"
                name="term_2_start"
                type="date"
                defaultValue={dateInputValue(initial.term2Start)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="term-2-end"
                className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
              >
                End date
              </label>
              <input
                id="term-2-end"
                name="term_2_end"
                type="date"
                defaultValue={dateInputValue(initial.term2End)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {threeTerms ? (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Term 3
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="term-3-start"
                  className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
                >
                  Start date
                </label>
                <input
                  id="term-3-start"
                  name="term_3_start"
                  type="date"
                  defaultValue={dateInputValue(initial.term3Start)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="term-3-end"
                  className="block text-xs font-medium text-slate-600 dark:text-zinc-400"
                >
                  End date
                </label>
                <input
                  id="term-3-end"
                  name="term_3_end"
                  type="date"
                  defaultValue={dateInputValue(initial.term3End)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>

      {canEdit ? (
        <SubmitButton />
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Only a school admin can edit academic settings.
        </p>
      )}
    </form>
  );
}
