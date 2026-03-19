"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addParentLink, type LinkActionState } from "./actions";

interface ParentOption {
  id: string;
  full_name: string;
  email: string | null;
}

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
  className: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Linking...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          Link Parent
        </>
      )}
    </button>
  );
}

export default function AddLinkForm({
  parents,
  students,
}: {
  parents: ParentOption[];
  students: StudentOption[];
}) {
  const [state, formAction] = useActionState<LinkActionState, FormData>(
    addParentLink,
    {}
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Link a Parent to a Student
        </h2>
      </div>

      <form action={formAction} className="px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Parent select */}
          <div>
            <label
              htmlFor="parent_id"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Parent
            </label>
            <select
              id="parent_id"
              name="parent_id"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Select a parent…</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.email ? ` (${p.email})` : ""}
                </option>
              ))}
            </select>
            {parents.length === 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                No parent accounts found. Parents need to sign up first.
              </p>
            )}
          </div>

          {/* Student select */}
          <div>
            <label
              htmlFor="student_id"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Student
            </label>
            <select
              id="student_id"
              name="student_id"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {s.className}
                  {s.admission_number ? ` (${s.admission_number})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback */}
        {state.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            {state.success}
          </div>
        )}

        <div className="mt-4">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
