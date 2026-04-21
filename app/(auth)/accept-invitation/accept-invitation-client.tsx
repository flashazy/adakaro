"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

interface AcceptInvitationClientProps {
  token: string;
  schoolName: string;
  invitedEmail: string;
  isLoggedIn: boolean;
  userEmail: string | null;
  loginUrl: string;
  signupUrl: string;
}

export function AcceptInvitationClient({
  token,
  schoolName,
  invitedEmail,
  isLoggedIn,
  userEmail,
  loginUrl,
  signupUrl,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedInvite = invitedEmail.trim().toLowerCase();
  const normalizedUser = (userEmail ?? "").trim().toLowerCase();
  const emailMismatch =
    isLoggedIn &&
    normalizedUser.length > 0 &&
    normalizedInvite !== normalizedUser;

  async function accept() {
    if (pending || emailMismatch) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/schools/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setError(body.error || `Something went wrong (${res.status})`);
        return;
      }
      router.push("/dashboard?inviteAccepted=1");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        School invitation
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        You&apos;ve been invited to help manage{" "}
        <span className="font-semibold text-slate-900 dark:text-white">
          {schoolName}
        </span>{" "}
        on Adakaro as an administrator.
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
        Invitation for:{" "}
        <span className="font-medium text-slate-800 dark:text-zinc-300">
          {invitedEmail}
        </span>
      </p>

      {!isLoggedIn ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Sign in or create an account with this email address to accept.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={loginUrl}
              className="inline-flex justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
            >
              Sign in
            </Link>
            <Link
              href={signupUrl}
              className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}

      {isLoggedIn && emailMismatch ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          You&apos;re signed in as <strong>{userEmail}</strong>, but this
          invitation was sent to <strong>{invitedEmail}</strong>. Sign out and
          sign in with the invited email, or use a different browser profile.
        </div>
      ) : null}

      {isLoggedIn && !emailMismatch ? (
        <div className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className="w-full rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Accepting…" : "Accept invitation"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
