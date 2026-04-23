"use client";

import { useActionState, useEffect, useState } from "react";
import { resetTeacherPasswordByAdminAction } from "../actions";
import type { ResetTeacherPasswordState } from "../types";
import { Loader2 } from "lucide-react";

type ResetTeacherPasswordModalProps = {
  open: boolean;
  onClose: () => void;
  teacherUserId: string;
  teacherName: string;
};

export function ResetTeacherPasswordModal({
  open,
  onClose,
  teacherUserId,
  teacherName,
}: ResetTeacherPasswordModalProps) {
  const [state, formAction, pending] = useActionState(
    resetTeacherPasswordByAdminAction,
    null as ResetTeacherPasswordState
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.ok === true) {
      setCopied(false);
    }
  }, [state]);

  if (!open) return null;

  const showPassword = state?.ok === true;
  const err = state?.ok === false ? state.error : null;
  const tempPassword = showPassword ? state.tempPassword : null;

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-teacher-pw-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id="reset-teacher-pw-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          {showPassword ? "Temporary password" : "Reset teacher password"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {showPassword
            ? "Copy this password and share it with the teacher by phone. It expires in 24 hours if they do not sign in and set a new password."
            : `Set a new temporary sign-in password for ${teacherName}. They will be asked to choose a new password on next login.`}
        </p>

        {err ? (
          <p
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        {showPassword && tempPassword ? (
          <div className="mt-4">
            <label
              className="block text-xs font-medium text-slate-500 dark:text-zinc-400"
              htmlFor="temp-teacher-pw"
            >
              One-time temporary password
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="temp-teacher-pw"
                readOnly
                value={tempPassword}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(tempPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        {!showPassword ? (
          <form action={formAction} className="mt-4">
            <input type="hidden" name="teacher_user_id" value={teacherUserId} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Reset password"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
