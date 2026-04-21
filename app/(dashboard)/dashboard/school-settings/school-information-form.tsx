"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSchoolInformation } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save school information"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export interface SchoolInformationFormProps {
  canEdit: boolean;
  initial: {
    name: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    registrationNumber: string | null;
  };
}

export function SchoolInformationForm({
  canEdit,
  initial,
}: SchoolInformationFormProps) {
  const [state, formAction] = useActionState(
    updateSchoolInformation,
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
          School information saved.
        </div>
      ) : null}

      <fieldset className="space-y-4" disabled={!canEdit}>
        <div>
          <label
            htmlFor="school-name"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            School name
          </label>
          <input
            id="school-name"
            name="name"
            type="text"
            required
            defaultValue={initial.name}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="school-address"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Street address
          </label>
          <input
            id="school-address"
            name="address"
            type="text"
            defaultValue={initial.address ?? ""}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="school-city"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              City
            </label>
            <input
              id="school-city"
              name="city"
              type="text"
              defaultValue={initial.city ?? ""}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="school-postal"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Postal code
            </label>
            <input
              id="school-postal"
              name="postal_code"
              type="text"
              defaultValue={initial.postalCode ?? ""}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="school-phone"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Phone
            </label>
            <input
              id="school-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={initial.phone ?? ""}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="school-email"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              School email
            </label>
            <input
              id="school-email"
              name="school_email"
              type="email"
              autoComplete="email"
              defaultValue={initial.email ?? ""}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="school-reg"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Registration number
          </label>
          <input
            id="school-reg"
            name="registration_number"
            type="text"
            defaultValue={initial.registrationNumber ?? ""}
            className="mt-1.5 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      </fieldset>

      {canEdit ? (
        <SubmitButton />
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Only a school admin can edit school information.
        </p>
      )}
    </form>
  );
}
