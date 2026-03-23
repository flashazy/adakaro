"use client";

import { useCallback, useId, useState } from "react";
import { submitSchoolAdminInvite } from "./invite-admin-action";

interface InviteAdminModalProps {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

export function InviteAdminModal({
  open,
  onClose,
  onInvited,
}: InviteAdminModalProps) {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const close = useCallback(() => {
    if (!pending) {
      setError(null);
      setSuccess(null);
      onClose();
    }
  }, [pending, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email) {
      setError("Email is required.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await submitSchoolAdminInvite(new FormData(form));

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Invitation created for ${result.email}. They will see it when they sign in to Adakaro.`
      );
      form.reset();
      onInvited?.();
      window.setTimeout(() => {
        close();
      }, 2000);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
        aria-label="Close dialog"
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id={`${formId}-title`}
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Invite new admin
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Only people who already have an Adakaro account can be invited. They
          will see a pending invitation when they sign in (no email is sent).
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
              {success}
            </div>
          ) : null}

          <div>
            <label
              htmlFor={`${formId}-email`}
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Email address
            </label>
            <input
              id={`${formId}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
              placeholder="colleague@school.org"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
