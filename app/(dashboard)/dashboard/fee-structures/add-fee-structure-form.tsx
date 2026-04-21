"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRef, useEffect, useState } from "react";
import { addFeeStructure, type FeeStructureActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Adding…" : "Add fee structure"}
    </button>
  );
}

interface Props {
  feeTypes: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  students: { id: string; full_name: string; admission_number: string | null }[];
  /** School ISO currency (TZS, KES, UGX, USD) */
  currencyCode: string;
}

const initialState: FeeStructureActionState = {};

export function AddFeeStructureForm({
  feeTypes,
  classes,
  students,
  currencyCode,
}: Props) {
  const [state, formAction] = useActionState(addFeeStructure, initialState);
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<"class" | "student">("class");
  const [studentSearch, setStudentSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOpen(false);
      setStudentSearch("");
    }
  }, [state.success]);

  const filteredStudents = studentSearch.trim()
    ? students.filter((s) => {
        const q = studentSearch.toLowerCase();
        return (
          s.full_name.toLowerCase().includes(q) ||
          (s.admission_number?.toLowerCase().includes(q) ?? false)
        );
      })
    : students;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Add a new fee structure
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
          <input type="hidden" name="target_type" value={targetType} />

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Fee type */}
            <div>
              <label
                htmlFor="fee_type_id"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Fee type <span className="text-red-500">*</span>
              </label>
              <select
                id="fee_type_id"
                name="fee_type_id"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select a fee type</option>
                {feeTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Amount ({currencyCode}) <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. 15000"
              />
            </div>

            {/* Target toggle */}
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">
                Assign to
              </p>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setTargetType("class")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    targetType === "class"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Class
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("student")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    targetType === "student"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Individual student
                </button>
              </div>
            </div>

            {/* Class dropdown */}
            {targetType === "class" && (
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
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Student searchable dropdown */}
            {targetType === "student" && (
              <div>
                <label
                  htmlFor="student_search"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Student <span className="text-red-500">*</span>
                </label>
                <input
                  id="student_search"
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students…"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                />
                <select
                  name="student_id"
                  required
                  size={Math.min(filteredStudents.length, 5) || 1}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                        {s.admission_number ? ` (${s.admission_number})` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No students found
                    </option>
                  )}
                </select>
              </div>
            )}

            {/* Due date */}
            <div>
              <label
                htmlFor="due_date"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Due date
              </label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-5">
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
