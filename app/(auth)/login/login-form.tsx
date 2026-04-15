"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, type AuthState } from "../actions";
import { PasswordInput } from "@/components/auth/password-input";

/** User acknowledged replacing the current browser session with a different account (this tab only). */
const SESSION_REPLACE_ACK_KEY = "adakaro_confirm_session_replace";
/** Per-tab marker: sessionStorage is not shared across tabs (unlike auth cookies). */
const LOGIN_TAB_MARKER_KEY = "adakaro_login_tab_marker";

type SessionEmailResponse = {
  email: string | null;
  cancelHref: string;
  hasSession: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <svg
          className="h-5 w-5 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        "Sign in"
      )}
    </button>
  );
}

const initialState: AuthState = {};

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isLoginPending] = useActionState(
    login,
    initialState
  );
  const [isPending, startTransition] = useTransition();
  const [showSessionReplaceWarning, setShowSessionReplaceWarning] =
    useState(false);
  const [cancelHrefForBanner, setCancelHrefForBanner] = useState("/dashboard");
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const signupHref =
    next && next.startsWith("/")
      ? `/signup?next=${encodeURIComponent(next)}`
      : "/signup";

  useEffect(() => {
    try {
      sessionStorage.setItem(
        LOGIN_TAB_MARKER_KEY,
        `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      );
    } catch {
      /* private / blocked storage */
    }
  }, []);

  useEffect(() => {
    if (!state.error) return;
    try {
      sessionStorage.removeItem(SESSION_REPLACE_ACK_KEY);
    } catch {
      /* ignore */
    }
  }, [state.error]);

  const runLogin = (fd: FormData) => {
    startTransition(() => {
      formAction(fd);
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void (async () => {
      const raw = (fd.get("email") as string) ?? "";
      const attempt = raw.trim().toLowerCase();
      const password = fd.get("password");
      if (!attempt || !password) return;

      let ack = false;
      try {
        ack = sessionStorage.getItem(SESSION_REPLACE_ACK_KEY) === "1";
      } catch {
        ack = false;
      }

      if (ack) {
        runLogin(fd);
        return;
      }

      let res: SessionEmailResponse;
      try {
        const r = await fetch("/api/auth/session-email", {
          credentials: "include",
        });
        res = (await r.json()) as SessionEmailResponse;
      } catch {
        runLogin(fd);
        return;
      }

      if (
        res.email &&
        res.email.trim().toLowerCase() !== attempt
      ) {
        setCancelHrefForBanner(res.cancelHref || "/dashboard");
        setShowSessionReplaceWarning(true);
        return;
      }

      runLogin(fd);
    })();
  };

  const handleContinueReplace = () => {
    try {
      sessionStorage.setItem(SESSION_REPLACE_ACK_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowSessionReplaceWarning(false);
    const form = formRef.current;
    if (!form) return;
    runLogin(new FormData(form));
  };

  const handleCancelReplace = () => {
    try {
      sessionStorage.removeItem(SESSION_REPLACE_ACK_KEY);
    } catch {
      /* ignore */
    }
    setShowSessionReplaceWarning(false);
    router.push(cancelHrefForBanner);
  };

  const busy = isLoginPending || isPending;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Welcome back
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Sign in to your account to continue.
      </p>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleFormSubmit}
        className="mt-6 space-y-4"
      >
        <input type="hidden" name="next" value={next} />

        {showSessionReplaceWarning && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="alert"
          >
            <p className="font-medium">Switch accounts?</p>
            <p className="mt-2 leading-relaxed">
              Another account is already logged in on this browser. For
              multiple accounts, please use Chrome Profiles, different browsers,
              or log out completely before switching accounts.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleContinueReplace}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  "Continue"
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelReplace}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {state.error}
          </div>
        )}

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
            disabled={showSessionReplaceWarning}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            placeholder="you@example.com"
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
            autoComplete="current-password"
            required
            minLength={6}
            disabled={showSessionReplaceWarning}
            placeholder="••••••••"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href={signupHref}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
