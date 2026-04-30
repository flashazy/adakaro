"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RemoveAdminButtonProps {
  userId: string;
  label: string;
  disabled?: boolean;
  /** Native tooltip when `disabled` (wraps control so hover works). */
  disabledTitle?: string;
  /** When true, user returns to teacher membership instead of being removed. */
  promotedFromTeacher?: boolean;
}

export function RemoveAdminButton({
  userId,
  label,
  disabled,
  disabledTitle,
  promotedFromTeacher = false,
}: RemoveAdminButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (pending || disabled) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/schools/remove-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || `Failed (${res.status})`);
        return;
      }
      setShowConfirm(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  const warning = promotedFromTeacher
    ? "They will go back to teacher-only access for this school. This action cannot be undone."
    : "They will lose admin access. This action cannot be undone.";

  const triggerBtn = (
    <button
      type="button"
      onClick={() => {
        if (disabled || pending) return;
        setError(null);
        setShowConfirm(true);
      }}
      disabled={disabled || pending}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );

  const wrappedTrigger =
    (disabled || pending) && disabledTitle ? (
      <span className="inline-flex" title={disabledTitle}>
        {triggerBtn}
      </span>
    ) : (
      triggerBtn
    );

  return (
    <>
      {wrappedTrigger}

      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-admin-title-${userId}`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
            onClick={() => setShowConfirm(false)}
            disabled={pending}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2
              id={`remove-admin-title-${userId}`}
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Remove {label}?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              {warning}
            </p>

            {error ? (
              <p
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
              >
                {pending ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
