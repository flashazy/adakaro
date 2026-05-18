"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSchoolHeadTeacher } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";
import type { HeadTeacherCandidate } from "@/lib/duty-book/list-head-teacher-candidates";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save head teacher"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export function SchoolHeadTeacherForm({
  candidates,
  currentHeadTeacherId,
}: {
  candidates: HeadTeacherCandidate[];
  currentHeadTeacherId: string | null;
}) {
  const [state, formAction] = useActionState(updateSchoolHeadTeacher, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Head teacher updated. They can sign duty book reports.
        </div>
      ) : null}

      <div>
        <label
          htmlFor="head-teacher-id"
          className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
        >
          Head teacher
        </label>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          This person can sign daily duty book reports. If unset, a school admin
          may sign until you assign someone.
        </p>
        <select
          id="head-teacher-id"
          name="head_teacher_id"
          defaultValue={currentHeadTeacherId ?? ""}
          className="mt-2 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">Not assigned</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}
