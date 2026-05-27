"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800",
        className
      )}
      aria-hidden
    />
  );
}

export type MarksMatrixLoadPhase =
  | "idle"
  | "loading"
  | "assignments"
  | "scores"
  | "ready"
  | "error";

interface MarksMatrixTableSkeletonProps {
  /** Assignment column labels when known; otherwise generic placeholders. */
  columnTitles?: string[];
  rowCount?: number;
  className?: string;
}

/**
 * Table-shaped skeleton for the marks matrix (student rows × assignment columns).
 */
export function MarksMatrixTableSkeleton({
  columnTitles,
  rowCount = 7,
  className = "",
}: MarksMatrixTableSkeletonProps) {
  const cols =
    columnTitles && columnTitles.length > 0
      ? columnTitles
      : ["Assignment 1", "Assignment 2", "Assignment 3"];

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700",
        className
      )}
      aria-hidden
    >
      <table className="w-max min-w-full border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
            <th className="sticky left-0 z-20 min-w-[11rem] border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
              <Shimmer className="h-4 w-24" />
            </th>
            {cols.map((title, i) => (
              <th
                key={`${title}-${i}`}
                className="min-w-[8rem] max-w-[11rem] px-2 py-2 text-center"
              >
                <Shimmer className="mx-auto h-4 w-28 max-w-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-slate-100 dark:border-zinc-800"
            >
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                <Shimmer className="h-4 w-32" />
              </td>
              {cols.map((_, colIdx) => (
                <td key={colIdx} className="px-2 py-2">
                  <Shimmer className="mx-auto h-8 w-16" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type MarksMatrixSlowTier = "none" | "notice" | "warning";

interface MarksMatrixLoadingStatusProps {
  phase: MarksMatrixLoadPhase;
  slowTier: MarksMatrixSlowTier;
  className?: string;
}

function statusMessage(phase: MarksMatrixLoadPhase, slowTier: MarksMatrixSlowTier): string {
  if (slowTier === "warning") {
    return "Taking longer than expected. Check your connection.";
  }
  if (slowTier === "notice") {
    return "Still loading large dataset… This may take a moment.";
  }
  if (phase === "assignments") {
    return "Loading assignments…";
  }
  if (phase === "scores") {
    return "Loading marks matrix…";
  }
  return "Loading marks matrix…";
}

function statusSubtext(phase: MarksMatrixLoadPhase, slowTier: MarksMatrixSlowTier): string | null {
  if (slowTier === "warning") {
    return "You can wait or try switching class/subject and back.";
  }
  if (slowTier === "notice") {
    return "Fetching students and scores for every assignment.";
  }
  if (phase === "scores") {
    return "Assignments loaded — filling in student scores…";
  }
  if (phase === "assignments") {
    return "Preparing columns for this term…";
  }
  return null;
}

/** Spinner + timed messages shown above the matrix skeleton. */
export function MarksMatrixLoadingStatus({
  phase,
  slowTier,
  className = "",
}: MarksMatrixLoadingStatusProps) {
  const message = statusMessage(phase, slowTier);
  const subtext = statusSubtext(phase, slowTier);
  const progress =
    phase === "assignments" ? 35 : phase === "scores" ? 70 : 15;

  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-school-primary"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">
          {message}
        </p>
      </div>
      {subtext ? (
        <p className="text-xs text-slate-500 dark:text-zinc-400">{subtext}</p>
      ) : null}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-school-primary/80 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface MarksMatrixLoadErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

export function MarksMatrixLoadError({
  message,
  onRetry,
  className = "",
}: MarksMatrixLoadErrorProps) {
  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/40",
        className
      )}
      role="alert"
    >
      <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
        Failed to load assignments.
      </p>
      <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-200/90">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100 dark:hover:bg-rose-900/40"
      >
        Retry
      </button>
    </div>
  );
}

/** Hook: 5s notice, 15s warning while `loading` is true. */
export function useMarksMatrixSlowTier(loading: boolean): MarksMatrixSlowTier {
  const [tier, setTier] = useState<MarksMatrixSlowTier>("none");

  useEffect(() => {
    if (!loading) {
      setTier("none");
      return;
    }
    setTier("none");
    const t5 = window.setTimeout(() => setTier("notice"), 5_000);
    const t15 = window.setTimeout(() => setTier("warning"), 15_000);
    return () => {
      window.clearTimeout(t5);
      window.clearTimeout(t15);
    };
  }, [loading]);

  return tier;
}
