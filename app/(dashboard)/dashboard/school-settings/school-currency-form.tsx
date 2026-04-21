"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SchoolCurrencySelect } from "@/components/SchoolCurrencySelect";
import { updateSchoolCurrency } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save currency"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export function SchoolCurrencyForm({
  currentCurrency,
}: {
  currentCurrency: string;
}) {
  const [state, formAction] = useActionState(updateSchoolCurrency, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Currency saved. Amounts across the admin dashboard now use this
          currency. Parents will see it after they refresh.
        </div>
      ) : null}

      <div>
        <label
          htmlFor="school-currency"
          className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
        >
          School currency
        </label>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          All fee amounts and balances are shown in this currency. Enter fees in
          this currency (no automatic conversion).
        </p>
        <SchoolCurrencySelect
          id="school-currency"
          defaultValue={currentCurrency}
          required
          className="mt-2 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
