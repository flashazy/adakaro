"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  acceptTeacherInviteAction,
  type AcceptInviteState,
} from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

const initial = null as AcceptInviteState | null;

interface AcceptInviteFormProps {
  token: string;
  invitedEmail: string;
}

export function AcceptInviteForm({ token, invitedEmail }: AcceptInviteFormProps) {
  const [state, formAction] = useActionState(acceptTeacherInviteAction, initial);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Accept teacher invitation
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Create your password to join as a teacher. You will sign in with{" "}
        <span className="font-medium text-slate-800 dark:text-zinc-200">
          {invitedEmail}
        </span>
        .
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />

        {state?.ok === false && state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {state.error}
          </div>
        )}

        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <label
            htmlFor="confirm_password"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Confirm password
          </label>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            required
            autoComplete="new-password"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
