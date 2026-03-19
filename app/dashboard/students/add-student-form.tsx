"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRef, useEffect, useState } from "react";
import { addStudent, type StudentActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Adding…" : "Add student"}
    </button>
  );
}

interface Props {
  classes: { id: string; name: string }[];
}

const initialState: StudentActionState = {};

export function AddStudentForm({ classes }: Props) {
  const [state, formAction] = useActionState(addStudent, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.success]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Add a new student
        </h2>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <form
          ref={formRef}
          action={formAction}
          className="border-t border-slate-200 px-6 pb-6 pt-4 dark:border-zinc-800"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. Jane Doe"
              />
            </div>

            <div>
              <label
                htmlFor="admission_number"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Admission number
              </label>
              <input
                id="admission_number"
                name="admission_number"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. ADM-001"
              />
            </div>

            <div>
              <label
                htmlFor="class_id"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Class <span className="text-red-500">*</span>
              </label>
              <select
                id="class_id"
                name="class_id"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="parent_name"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent name
              </label>
              <input
                id="parent_name"
                name="parent_name"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="Parent's full name"
              />
            </div>

            <div>
              <label
                htmlFor="parent_email"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent email
              </label>
              <input
                id="parent_email"
                name="parent_email"
                type="email"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="parent@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="parent_phone"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent phone
              </label>
              <input
                id="parent_phone"
                name="parent_phone"
                type="tel"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="+254 700 000 000"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <SubmitButton />
          </div>

          {state.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {state.success}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
