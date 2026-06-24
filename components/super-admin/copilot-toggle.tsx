"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopilotToggleProps {
  schoolId: string;
  schoolName: string;
  enabled: boolean;
  /** Called with the new value after a successful update. */
  onChanged?: (enabled: boolean) => void;
  className?: string;
}

/**
 * Super-admin switch to enable/disable Adakaro Copilot for a single school.
 * Optimistically flips, persists via the rollout API, and confirms with a toast.
 */
export function CopilotToggle({
  schoolId,
  schoolName,
  enabled,
  onChanged,
  className,
}: CopilotToggleProps) {
  const [value, setValue] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (pending) return;
    const next = !value;
    // Optimistic flip.
    setValue(next);

    startTransition(async () => {
      try {
        const res = await fetch("/api/super-admin/schools/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, enabled: next }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Update failed.");
        }
        onChanged?.(next);
        toast.success(
          next
            ? `Adakaro Copilot enabled for ${schoolName}.`
            : `Adakaro Copilot disabled for ${schoolName}.`
        );
      } catch (e) {
        // Revert on failure.
        setValue(!next);
        toast.error(
          e instanceof Error
            ? e.message
            : "Could not update Copilot access. Please try again."
        );
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={`${value ? "Disable" : "Enable"} Adakaro Copilot for ${schoolName}`}
      disabled={pending}
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        value ? "bg-emerald-500" : "bg-slate-300",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        ) : null}
      </span>
    </button>
  );
}
