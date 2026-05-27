"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AsyncLoadingShellProps {
  /** Primary loading message (shown immediately). */
  message?: string;
  /** Message after `slowAfterMs` (default 10s). */
  slowMessage?: string;
  /** Milliseconds before showing the slow message. */
  slowAfterMs?: number;
  /** Optional skeleton rows below the spinner. */
  skeletonRows?: number;
  className?: string;
}

/**
 * Spinner + optional skeleton with a "still loading" hint after a timeout.
 * Helps users know the app is working on slow queries (not frozen).
 */
export function AsyncLoadingShell({
  message = "Loading…",
  slowMessage = "Still loading… This can take a moment for large classes.",
  slowAfterMs = 10_000,
  skeletonRows = 4,
  className = "",
}: AsyncLoadingShellProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(t);
  }, [slowAfterMs]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2
          className="h-8 w-8 animate-spin text-school-primary"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">
          {slow ? slowMessage : message}
        </p>
        {slow ? (
          <p className="max-w-md text-xs text-slate-500 dark:text-zinc-400">
            Large classes with many report cards may need extra time. Please
            keep this tab open.
          </p>
        ) : null}
      </div>
      {skeletonRows > 0 ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
