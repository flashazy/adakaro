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

  async function handleRemove() {
    if (pending || disabled) return;
    const message = promotedFromTeacher
      ? `Remove admin access from ${label}? They will go back to teacher-only access for this school.`
      : `Remove ${label} from the school team? They will lose admin access.`;
    if (!confirm(message)) {
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/schools/remove-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(body.error || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      alert("Network error.");
    } finally {
      setPending(false);
    }
  }

  const btn = (
    <button
      type="button"
      onClick={handleRemove}
      disabled={disabled || pending}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );

  if ((disabled || pending) && disabledTitle) {
    return (
      <span className="inline-flex" title={disabledTitle}>
        {btn}
      </span>
    );
  }

  return btn;
}
