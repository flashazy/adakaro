"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, type AuthState } from "../actions";
import { PasswordInput } from "@/components/auth/password-input";
import { cn } from "@/lib/utils";

/** User acknowledged replacing the current browser session with a different account (this tab only). */
const SESSION_REPLACE_ACK_KEY = "adakaro_confirm_session_replace";
/** Per-tab marker: sessionStorage is not shared across tabs (unlike auth cookies). */
const LOGIN_TAB_MARKER_KEY = "adakaro_login_tab_marker";

type SessionEmailResponse = {
  email: string | null;
  cancelHref: string;
  hasSession: boolean;
};

function SubmitButton({
  isLoading,
  disabled,
}: {
  isLoading: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = isLoading || pending;

  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy}
      className="inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2
            className="mr-2 h-4 w-4 shrink-0 animate-spin"
            aria-hidden
          />
          Signing in...
        </>
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
  const [isLoading, setIsLoading] = useState(false);
  const awaitingLoginActionRef = useRef(false);
  const [showSessionReplaceWarning, setShowSessionReplaceWarning] =
    useState(false);
  const [cancelHrefForBanner, setCancelHrefForBanner] = useState("/dashboard");
  const [loginId, setLoginId] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [clearedIdHighlight, setClearedIdHighlight] = useState(false);
  const [clearedPasswordHighlight, setClearedPasswordHighlight] =
    useState(false);
  const wasActionBusy = useRef(false);
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

  const loginActionBusy = isLoading || isLoginPending || isPending;
  useEffect(() => {
    if (wasActionBusy.current && !loginActionBusy && state.error) {
      setClearedIdHighlight(false);
      setClearedPasswordHighlight(false);
    }
    wasActionBusy.current = loginActionBusy;
  }, [loginActionBusy, state.error]);

  const textFieldClass = (invalid: boolean) =>
    cn(
      "mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500",
      invalid
        ? "border-red-400 focus:border-red-500/90 focus:ring-red-500/20 dark:border-red-500/60 dark:focus:border-red-500/80"
        : "border-slate-300 focus:border-school-primary focus:ring-school-primary dark:border-zinc-700 dark:focus:border-school-primary dark:focus:ring-school-primary"
    );

  const passwordFieldClass = (invalid: boolean) =>
    invalid
      ? "border !border-red-400 focus:!border-red-500/90 focus:!ring-red-500/25 dark:!border-red-500/60 dark:focus:!border-red-500/80"
      : undefined;

  const h = state.loginFieldHighlight;
  const showIdErr = Boolean(
    h?.identifier && !clearedIdHighlight && !showSessionReplaceWarning
  );
  const showPassErr = Boolean(
    h?.password && !clearedPasswordHighlight && !showSessionReplaceWarning
  );

  useEffect(() => {
    if (!awaitingLoginActionRef.current) return;
    if (!isLoginPending && !isPending) {
      setIsLoading(false);
      awaitingLoginActionRef.current = false;
    }
  }, [isLoginPending, isPending]);

  const runLogin = (fd: FormData) => {
    awaitingLoginActionRef.current = true;
    startTransition(() => {
      formAction(fd);
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void (async () => {
      try {
        const raw = (fd.get("email") as string) ?? "";
        const attempt = raw.trim().toLowerCase();
        const password = fd.get("password");
        if (!attempt || !password) return;

        setIsLoading(true);

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

        if (attempt.includes("@")) {
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
            setIsLoading(false);
            return;
          }
        }

        runLogin(fd);
      } catch {
        setIsLoading(false);
        awaitingLoginActionRef.current = false;
      }
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
    setIsLoading(true);
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

  const busy = isLoading || isLoginPending || isPending;

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
                className="inline-flex items-center justify-center rounded-lg bg-school-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
            Email or full name
          </label>
          <input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            required
            value={loginId}
            onChange={(e) => {
              setLoginId(e.target.value);
              setClearedIdHighlight(true);
            }}
            disabled={showSessionReplaceWarning}
            className={textFieldClass(showIdErr)}
            placeholder="you@example.com or your full name"
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
            value={passwordValue}
            onChange={(e) => {
              setPasswordValue(e.target.value);
              setClearedPasswordHighlight(true);
            }}
            disabled={showSessionReplaceWarning}
            className={passwordFieldClass(showPassErr)}
            placeholder="••••••••"
          />
        </div>

        <SubmitButton
          isLoading={isLoading}
          disabled={showSessionReplaceWarning}
        />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href={signupHref}
          className="font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
