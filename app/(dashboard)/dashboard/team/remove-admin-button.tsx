"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RemoveAdminButtonProps {
  userId: string;
  label: string;
  disabled?: boolean;
}

export function RemoveAdminButton({
  userId,
  label,
  disabled,
}: RemoveAdminButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    if (pending || disabled) return;
    if (
      !confirm(
        `Remove ${label} from the school team? They will lose admin access.`
      )
    ) {
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

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={disabled || pending}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
