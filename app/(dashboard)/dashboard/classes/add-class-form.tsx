"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRef, useEffect } from "react";
import { addClass, type ClassActionState } from "./actions";
import { BulkAddClassesModal } from "./bulk-add-classes-modal";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add class"}
    </button>
  );
}

const initialState: ClassActionState = {};

export interface AddClassFormProps {
  parentOptions?: { id: string; name: string }[];
}

export function AddClassForm({ parentOptions = [] }: AddClassFormProps) {
  const [state, formAction] = useActionState(addClass, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Add a new class
        </h2>
      </div>

      <form ref={formRef} action={formAction} className="px-6 py-5">
        <div className="space-y-4">
          <div>
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
              placeholder="Class name"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Description{" "}
              <span className="font-normal text-slate-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          {parentOptions.length > 0 && (
            <div>
              <label
                htmlFor="parent_class_id"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent class{" "}
                <span className="font-normal text-slate-400 dark:text-zinc-500">
                  (optional)
                </span>
              </label>
              <select
                id="parent_class_id"
                name="parent_class_id"
                defaultValue=""
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">None</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <SubmitButton />
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
            Bulk Add Classes
          </button>
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

      <BulkAddClassesModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        parentOptions={parentOptions}
      />
    </div>
  );
}
