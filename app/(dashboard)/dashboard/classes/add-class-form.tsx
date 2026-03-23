"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRef, useEffect } from "react";
import { addClass, type ClassActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add class"}
    </button>
  );
}

const initialState: ClassActionState = {};

export function AddClassForm() {
  const [state, formAction] = useActionState(addClass, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
        Add a new class
      </h2>

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            placeholder="e.g. Grade 1"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Description
          </label>
          <input
            id="description"
            name="description"
            type="text"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            placeholder="Optional description"
          />
        </div>

        <SubmitButton />
      </form>

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
    </div>
  );
}
