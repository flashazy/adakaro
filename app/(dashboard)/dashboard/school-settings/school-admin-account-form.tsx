"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeAccountEmailAction,
  changeAccountPasswordAction,
} from "./actions";
import { initialAccountSettingsState } from "./school-settings-shared";
import { PasswordInput } from "@/components/auth/password-input";

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

function EmailSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending…" : "Change email"}
    </button>
  );
}


export interface SchoolAdminAccountFormProps {
  currentEmail: string;
}

export function SchoolAdminAccountForm({
  currentEmail,
}: SchoolAdminAccountFormProps) {
  const [pwdState, pwdAction] = useActionState(
    changeAccountPasswordAction,
    initialAccountSettingsState
  );
  const [emailState, emailAction] = useActionState(
    changeAccountEmailAction,
    initialAccountSettingsState
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Your sign-in email
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {currentEmail}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Change password
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Enter your current password, then choose a new one (at least 8
          characters).
        </p>
        <form action={pwdAction} className="mt-4 max-w-md space-y-3">
          {!pwdState.ok && pwdState.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {pwdState.error}
            </div>
          ) : null}
          {pwdState.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              {pwdState.message ?? "Password updated."}
            </div>
          ) : null}
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Current password
            </label>
            <PasswordInput
              id="current-password"
              name="current_password"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              New password
            </label>
            <PasswordInput
              id="new-password"
              name="new_password"
              autoComplete="new-password"
              required
              minLength={8}
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
            />
          </div>
          <PasswordSubmitButton />
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Change email address
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          We will send a confirmation link to the new address. Your sign-in email
          stays the same until you confirm.
        </p>
        <form action={emailAction} className="mt-4 max-w-md space-y-3">
          {!emailState.ok && emailState.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {emailState.error}
            </div>
          ) : null}
          {emailState.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              {emailState.message ?? "Check your email to confirm."}
            </div>
          ) : null}
          <div>
            <label
              htmlFor="new-email"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              New email address
            </label>
            <input
              id="new-email"
              name="new_email"
              type="email"
              autoComplete="email"
              required
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <EmailSubmitButton />
        </form>
      </div>
    </div>
  );
}
