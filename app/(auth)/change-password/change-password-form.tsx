"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signOut } from "../actions";
import {
  changeTeacherPasswordAction,
  type ChangePasswordState,
} from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        "Save new password"
      )}
    </button>
  );
}

const initial: ChangePasswordState | null = null;

export function ChangePasswordForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(
    changeTeacherPasswordAction,
    initial
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        Your school administrator created your account with a temporary password.
        Set a new password you will remember before continuing.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        {state && !state.ok ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {state.error}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            New password
          </label>
          <PasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Confirm new password
          </label>
          <PasswordInput
            id="confirm-password"
            name="confirm_password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repeat password"
          />
        </div>

        <SubmitButton />
      </form>

      <form action={signOut} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
