"use client";

import { useFormStatus } from "react-dom";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  requestParentRecoveryCode,
  verifyParentRecoveryCode,
  type RequestRecoveryState,
  type VerifyRecoveryState,
} from "./actions";

const initialRequest: RequestRecoveryState = {};
const initialVerify: VerifyRecoveryState = {};

function PrimaryButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
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
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [reqState, reqAction] = useActionState(
    requestParentRecoveryCode,
    initialRequest
  );
  const [verState, verAction] = useActionState(
    verifyParentRecoveryCode,
    initialVerify
  );
  const [reveal, setReveal] = useState(true);
  const success = reqState.success;
  return (
    <div className="space-y-6">
      <form
        action={reqAction}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="admission_number"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Child&apos;s admission number
          </label>
          <input
            id="admission_number"
            name="admission_number"
            type="text"
            required
            disabled={Boolean(success)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Your registered phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            disabled={Boolean(success)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            autoComplete="tel"
            placeholder="Same number your school has on file"
          />
        </div>
        {reqState.error && !success ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {reqState.error}
          </div>
        ) : null}
        {!success ? <PrimaryButton label="Continue" loadingLabel="Checking…" /> : null}
      </form>

      {success ? (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Your verification code
          </p>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
            This code expires in 6 minutes. Enter it below to sign in, then
            you&apos;ll set a new password.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-2xl font-bold tracking-widest text-amber-950 tabular-nums dark:text-amber-50">
              {reveal ? success.code : "••••••"}
            </p>
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="text-xs font-medium text-amber-800 underline dark:text-amber-300"
            >
              {reveal ? "Hide" : "Show code"}
            </button>
          </div>
        </div>
      ) : null}

      {success ? (
        <form action={verAction} className="space-y-4">
          <input type="hidden" name="request_id" value={success.requestId} />
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Enter 6-digit code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 tracking-widest shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </div>
          {verState.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {verState.error}
            </div>
          ) : null}
          <PrimaryButton
            label="Verify and sign in"
            loadingLabel="Signing in…"
          />
        </form>
      ) : null}

      <p className="text-center text-sm text-slate-500 dark:text-zinc-400">
        <Link
          href="/login"
          className="font-medium text-school-primary hover:opacity-90"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
