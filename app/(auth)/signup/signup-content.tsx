"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signup, type AuthState } from "../actions";
import { PasswordInput } from "@/components/auth/password-input";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/supabase";

const MSG_PASSWORD_MISMATCH = "Passwords do not match.";
const MSG_PHONE_REQUIRED = "Phone number is required.";
const MSG_PASSWORD_SHORT = "Password must be at least 6 characters.";
const MSG_NAME_EMAIL_PASSWORD = "Full name, email, and password are required.";
const MSG_ROLE_SELF = "This role cannot be self-registered. Use a school invitation or contact support.";

type HighlightKey =
  | "fullName"
  | "email"
  | "phone"
  | "password"
  | "confirmPassword"
  | "role";

function rawHighlightsForError(
  error: string | undefined,
  v: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }
): Set<HighlightKey> {
  const s = new Set<HighlightKey>();
  if (!error) return s;
  if (error === MSG_PASSWORD_MISMATCH) {
    if (v.password && v.password === v.confirmPassword) {
      return s;
    }
    s.add("password");
    s.add("confirmPassword");
    return s;
  }
  if (error === MSG_PHONE_REQUIRED) {
    if (!v.phone.trim()) s.add("phone");
    return s;
  }
  if (error === MSG_PASSWORD_SHORT) {
    if (v.password.length < 6) s.add("password");
    return s;
  }
  if (error === MSG_NAME_EMAIL_PASSWORD) {
    if (!v.fullName.trim()) s.add("fullName");
    if (!v.email.trim()) s.add("email");
    if (!v.password) s.add("password");
    return s;
  }
  if (error === MSG_ROLE_SELF) {
    s.add("role");
    return s;
  }
  const e = error.toLowerCase();
  if (
    e.includes("email") &&
    (e.includes("invalid") ||
      e.includes("format") ||
      e.includes("already") ||
      e.includes("registered") ||
      e.includes("taken") ||
      e.includes("user"))
  ) {
    s.add("email");
    return s;
  }
  if (e.includes("password") && !e.includes("match")) {
    s.add("password");
    return s;
  }
  if (e.includes("phone")) {
    s.add("phone");
    return s;
  }
  return s;
}

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  const { pending } = useFormStatus();
  const busy = isLoading || pending;

  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:cursor-not-allowed disabled:opacity-60"
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

type SignupRole = Extract<UserRole, "parent" | "admin">;

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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<SignupRole>(() =>
    defaultAdmin ? "admin" : "parent"
  );

  const [clearedHighlights, setClearedHighlights] = useState(
    () => new Set<HighlightKey>()
  );
  const wasActionPending = useRef(false);

  const highlightRaw = useMemo(
    () =>
      rawHighlightsForError(state.error, {
        fullName,
        email,
        phone,
        password,
        confirmPassword,
      }),
    [state.error, fullName, email, phone, password, confirmPassword]
  );

  const hasFieldError = (k: HighlightKey) =>
    highlightRaw.has(k) && !clearedHighlights.has(k);

  useEffect(() => {
    if (wasActionPending.current && !isLoading && state.error) {
      setClearedHighlights(new Set());
    }
    wasActionPending.current = isLoading;
  }, [isLoading, state.error]);

  useEffect(() => {
    if (!state.success) return;
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setRole(defaultAdmin ? "admin" : "parent");
  }, [state.success, defaultAdmin]);

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

  const roleTileClass = (invalid: boolean) =>
    cn(
      "group relative flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800",
      invalid
        ? "border-red-400 dark:border-red-500/60"
        : "border-slate-300 has-[:checked]:border-school-primary has-[:checked]:ring-1 has-[:checked]:ring-school-primary dark:has-[:checked]:border-[rgb(var(--school-primary-rgb)/0.45)] dark:has-[:checked]:ring-school-primary"
    );

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
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setClearedHighlights((p) => new Set(p).add("fullName"));
            }}
            disabled={isLoading}
            className={textFieldClass(hasFieldError("fullName"))}
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
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setClearedHighlights((p) => new Set(p).add("email"));
            }}
            disabled={isLoading}
            className={textFieldClass(hasFieldError("email"))}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setClearedHighlights((p) => new Set(p).add("phone"));
            }}
            disabled={isLoading}
            className={textFieldClass(hasFieldError("phone"))}
            placeholder="+255 700 000 000"
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
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (state.error === MSG_PASSWORD_MISMATCH) {
                setClearedHighlights((p) => {
                  const n = new Set(p);
                  n.add("password");
                  n.add("confirmPassword");
                  return n;
                });
              } else {
                setClearedHighlights((p) => new Set(p).add("password"));
              }
            }}
            disabled={isLoading}
            className={passwordFieldClass(hasFieldError("password"))}
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
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (state.error === MSG_PASSWORD_MISMATCH) {
                setClearedHighlights((p) => {
                  const n = new Set(p);
                  n.add("password");
                  n.add("confirmPassword");
                  return n;
                });
              } else {
                setClearedHighlights((p) => new Set(p).add("confirmPassword"));
              }
            }}
            disabled={isLoading}
            className={passwordFieldClass(hasFieldError("confirmPassword"))}
            placeholder="Re-enter your password"
          />
        </div>

        <fieldset disabled={isLoading}>
          <legend className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
            I am a&hellip;
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className={roleTileClass(hasFieldError("role"))}>
              <input
                type="radio"
                name="role"
                value="parent"
                checked={role === "parent"}
                onChange={() => {
                  setRole("parent");
                  setClearedHighlights((p) => new Set(p).add("role"));
                }}
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

            <label className={roleTileClass(hasFieldError("role"))}>
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === "admin"}
                onChange={() => {
                  setRole("admin");
                  setClearedHighlights((p) => new Set(p).add("role"));
                }}
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
          className="font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
