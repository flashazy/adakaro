"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  parentResetPasswordAction,
  type ParentResetPasswordState,
} from "./actions";

const initial: ParentResetPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
          Saving…
        </>
      ) : (
        "Save new password"
      )}
    </button>
  );
}

export function ParentResetPasswordForm() {
  const [state, formAction] = useActionState(
    parentResetPasswordAction,
    initial
  );
  return (
    <div>
      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            New password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label
            htmlFor="confirm_password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Confirm new password
          </label>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        {state.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {state.error}
          </div>
        ) : null}
        <SubmitButton />
      </form>
      <div className="pt-2 text-center text-xs text-slate-500 dark:text-zinc-500">
        <p className="mb-1">Wrong account?</p>
        <SignOutButton className="text-sm text-school-primary underline decoration-school-primary/40 underline-offset-2 hover:opacity-90" />
      </div>
    </div>
  );
}
