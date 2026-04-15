"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signup, type AuthState } from "../actions";
import { PasswordInput } from "@/components/auth/password-input";

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  const { pending } = useFormStatus();
  const busy = isLoading || pending;

  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2
            className="mr-2 h-4 w-4 shrink-0 animate-spin"
            aria-hidden
          />
          Creating account...
        </>
      ) : (
        "Create account"
      )}
    </button>
  );
}

const initialState: AuthState = {};

export default function SignupContent() {
  const [state, formAction, isLoading] = useActionState(signup, initialState);
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role")?.toLowerCase().trim();
  const defaultAdmin = roleParam === "admin";
  const nextParam = searchParams.get("next") ?? "";
  const loginHref =
    nextParam && nextParam.startsWith("/")
      ? `/login?next=${encodeURIComponent(nextParam)}`
      : "/login";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Create your account
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Get started managing school fees in minutes.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={nextParam} />

        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-400">
            {state.success}
          </div>
        )}

        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Phone{" "}
            <span className="font-normal text-slate-400 dark:text-zinc-500">
              (optional)
            </span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            placeholder="+254 700 000 000"
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
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="At least 6 characters"
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
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Re-enter your password"
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
            I am a&hellip;
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="group relative flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm transition-colors has-[:checked]:border-indigo-600 has-[:checked]:ring-1 has-[:checked]:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:has-[:checked]:border-indigo-400 dark:has-[:checked]:ring-indigo-400">
              <input
                type="radio"
                name="role"
                value="parent"
                defaultChecked={!defaultAdmin}
                className="sr-only"
              />
              <div>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  Parent
                </span>
                <span className="block text-xs text-slate-500 dark:text-zinc-400">
                  View &amp; pay fees
                </span>
              </div>
            </label>

            <label className="group relative flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm transition-colors has-[:checked]:border-indigo-600 has-[:checked]:ring-1 has-[:checked]:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:has-[:checked]:border-indigo-400 dark:has-[:checked]:ring-indigo-400">
              <input
                type="radio"
                name="role"
                value="admin"
                defaultChecked={defaultAdmin}
                className="sr-only"
              />
              <div>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  Admin
                </span>
                <span className="block text-xs text-slate-500 dark:text-zinc-400">
                  Manage a school
                </span>
              </div>
            </label>
          </div>
        </fieldset>

        <SubmitButton isLoading={isLoading} />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
