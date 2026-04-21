"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateSchoolBranding } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";
import { DEFAULT_SCHOOL_PRIMARY_HEX } from "@/lib/school-primary-color";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save branding"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export interface SchoolBrandingFormProps {
  canEdit: boolean;
  initial: {
    motto: string | null;
    primaryColor: string | null;
  };
}

export function SchoolBrandingForm({ canEdit, initial }: SchoolBrandingFormProps) {
  const [state, formAction] = useActionState(updateSchoolBranding, initialState);
  const defaultHex = (initial.primaryColor ?? "#4f46e5").trim();
  const [hex, setHex] = useState(
    /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(defaultHex)
      ? defaultHex
      : "#4f46e5"
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
          Branding saved.
        </div>
      ) : null}

      <fieldset className="space-y-4" disabled={!canEdit}>
        <div>
          <label
            htmlFor="school-motto"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Motto / tagline
          </label>
          <input
            id="school-motto"
            name="motto"
            type="text"
            placeholder="Optional short phrase"
            defaultValue={initial.motto ?? ""}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="school-primary-color"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Primary color
          </label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Hex color for school accent (default matches Adakaro indigo).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="school-primary-color-picker"
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              disabled={!canEdit}
              className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed dark:border-zinc-600"
              aria-label="Pick primary color"
            />
            <input
              id="school-primary-color"
              name="primary_color"
              type="text"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder={DEFAULT_SCHOOL_PRIMARY_HEX}
              disabled={!canEdit}
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setHex(DEFAULT_SCHOOL_PRIMARY_HEX)}
              disabled={!canEdit}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Reset to default
            </button>
          </div>
        </div>
      </fieldset>

      {canEdit ? (
        <SubmitButton />
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Only a school admin can edit branding.
        </p>
      )}
    </form>
  );
}
