"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { addStudent, type StudentActionState } from "./actions";

function syncAdmissionFromPreview(
  preview: string | null | undefined
): { value: string; snapshot: string } {
  const v = (preview ?? "").trim();
  return { value: v, snapshot: v };
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Adding…" : "Add student"}
    </button>
  );
}

interface Props {
  classes: { id: string; name: string }[];
  /** Current enrolment count for plan warnings. */
  studentCount?: number;
  /** Plan cap; null = unlimited. */
  studentLimit?: number | null;
  /** Next admission number preview (does not reserve a slot). */
  nextAdmissionPreview?: string | null;
  /** School prefix when set (3–4 letters). */
  schoolAdmissionPrefix?: string | null;
}

const initialState: StudentActionState = {};

export function AddStudentForm({
  classes,
  studentCount = 0,
  studentLimit = null,
  nextAdmissionPreview = null,
  schoolAdmissionPrefix = null,
}: Props) {
  const effectivePrefix =
    typeof schoolAdmissionPrefix === "string"
      ? schoolAdmissionPrefix.trim().toUpperCase()
      : "";
  const hasAdmissionPrefix = effectivePrefix.length > 0;

  const router = useRouter();
  const [state, formAction] = useActionState(addStudent, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const admissionInputRef = useRef<HTMLInputElement>(null);
  const [admissionValue, setAdmissionValue] = useState("");
  const [admissionSnapshot, setAdmissionSnapshot] = useState("");

  useEffect(() => {
    if (open && hasAdmissionPrefix) {
      const { value, snapshot } = syncAdmissionFromPreview(
        nextAdmissionPreview
      );
      setAdmissionValue(value);
      setAdmissionSnapshot(snapshot);
    }
  }, [open, hasAdmissionPrefix, nextAdmissionPreview]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  const atStudentLimit =
    studentLimit != null && studentCount >= studentLimit;
  const approachingLimit =
    studentLimit != null &&
    !atStudentLimit &&
    studentCount >= Math.max(0, studentLimit - 5);

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
          {atStudentLimit ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
              You&apos;ve reached your plan limit ({studentLimit} students).
              Upgrade on the{" "}
              <a
                href="/pricing"
                className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-400"
              >
                Pricing
              </a>{" "}
              page to add more.
            </div>
          ) : approachingLimit ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              You&apos;re close to your plan limit: {studentCount} of{" "}
              {studentLimit} students used.
            </div>
          ) : null}
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
              {hasAdmissionPrefix ? (
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="hidden"
                    name="admission_default_snapshot"
                    value={admissionSnapshot}
                  />
                  <input
                    ref={admissionInputRef}
                    id="admission_number"
                    name="admission_number"
                    type="text"
                    autoComplete="off"
                    value={admissionValue}
                    onChange={(e) => setAdmissionValue(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                    placeholder={`e.g. ${effectivePrefix}-001`}
                  />
                  <button
                    type="button"
                    title="Focus field to edit admission number"
                    onClick={() => {
                      admissionInputRef.current?.focus();
                      admissionInputRef.current?.select();
                    }}
                    className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <input
                  id="admission_number"
                  name="admission_number"
                  type="text"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  placeholder="e.g. ADM-001 (optional)"
                />
              )}
              {hasAdmissionPrefix ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Pre-filled with the next number. You can edit it; if you leave
                  it as suggested, the next free sequence number is assigned
                  when you save.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Set a school admission prefix in School settings to enable
                  auto-generated numbers.
                </p>
              )}
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
            <SubmitButton disabled={atStudentLimit} />
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
