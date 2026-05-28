"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  changeForcedPasswordAction,
  type ChangePasswordState,
} from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

const SUCCESS_REDIRECT_MS = 1500;

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

export function ChangePasswordForm({
  nextPath,
  variant,
}: {
  nextPath: string;
  variant: "teacher" | "parent";
}) {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [state, formAction] = useActionState(
    changeForcedPasswordAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) setShowSuccess(true);
  }, [state]);

  useEffect(() => {
    if (!showSuccess || !state?.ok) return;
    const redirectTo = state.redirectTo;
    router.prefetch(redirectTo);
    const timer = window.setTimeout(() => {
      router.replace(redirectTo);
    }, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [showSuccess, state, router]);

  const title =
    variant === "teacher"
      ? "Change your temporary password"
      : "Choose a new password";

  const description =
    variant === "teacher"
      ? "You are required to change your temporary password before you can access the dashboard."
      : "You signed in with a temporary password from enrollment. Choose a new password you will remember before continuing.";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        {description}
      </p>

      {showSuccess ? (
        <div
          className="mt-6 min-h-[4.5rem] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          Password changed successfully! Redirecting to your dashboard...
        </div>
      ) : (
        <>
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

          <SignOutButton
            formClassName="mt-6 text-center"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          />
        </>
      )}
    </div>
  );
}
