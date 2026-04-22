"use client";

/**
 * Shared "score display format" toggle.
 *
 * Pure formatting (how a cell’s score string is built) lives in
 * `grade-marks-label-format.ts` so server code (e.g. full marks report math)
 * does not import this client file.
 *
 * three formats: percentage, marks, both — see `grade-marks-label-format.ts`
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type GradeDisplayFormat,
  DEFAULT_GRADE_DISPLAY_FORMAT,
  isGradeDisplayFormat,
} from "./grade-marks-label-format";

export {
  type GradeDisplayFormat,
  DEFAULT_GRADE_DISPLAY_FORMAT,
  isGradeDisplayFormat,
  formatMarksCellLabel,
  formatReportCardCellLabel,
} from "./grade-marks-label-format";

/** localStorage key — namespaced to avoid clashing with anything else. */
export const GRADE_DISPLAY_FORMAT_STORAGE_KEY = "adakaro:grade-display-format";

function safeReadFromStorage(): GradeDisplayFormat {
  if (typeof window === "undefined") return DEFAULT_GRADE_DISPLAY_FORMAT;
  try {
    const raw = window.localStorage.getItem(GRADE_DISPLAY_FORMAT_STORAGE_KEY);
    return isGradeDisplayFormat(raw) ? raw : DEFAULT_GRADE_DISPLAY_FORMAT;
  } catch {
    return DEFAULT_GRADE_DISPLAY_FORMAT;
  }
}

function safeWriteToStorage(value: GradeDisplayFormat) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRADE_DISPLAY_FORMAT_STORAGE_KEY, value);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

/** Custom event name fired when the preference changes anywhere on the page. */
const CHANGE_EVENT = "adakaro:grade-display-format:change";

/**
 * React state that mirrors the persisted preference. All instances on the
 * same page stay in sync via a custom window event so toggling the format on
 * the Marks page header instantly updates every cell that consumes it.
 */
export function useGradeDisplayFormat(): {
  format: GradeDisplayFormat;
  setFormat: (next: GradeDisplayFormat) => void;
} {
  // Render-server / first-paint safe: always start from the default and let
  // the effect promote the persisted value once we know we're in the browser.
  const [format, setFormatState] = useState<GradeDisplayFormat>(
    DEFAULT_GRADE_DISPLAY_FORMAT
  );

  useEffect(() => {
    setFormatState(safeReadFromStorage());

    function handleChange(event: Event) {
      const next = (event as CustomEvent<GradeDisplayFormat>).detail;
      if (isGradeDisplayFormat(next)) setFormatState(next);
    }
    function handleStorage(event: StorageEvent) {
      if (event.key !== GRADE_DISPLAY_FORMAT_STORAGE_KEY) return;
      if (isGradeDisplayFormat(event.newValue)) setFormatState(event.newValue);
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setFormat = useCallback((next: GradeDisplayFormat) => {
    setFormatState(next);
    safeWriteToStorage(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<GradeDisplayFormat>(CHANGE_EVENT, { detail: next })
      );
    }
  }, []);

  return { format, setFormat };
}

const FORMAT_OPTIONS: { value: GradeDisplayFormat; label: string }[] = [
  { value: "percentage", label: "Percentage" },
  { value: "marks", label: "Marks" },
  { value: "both", label: "Both" },
];

/**
 * Compact button-group toggle used on the Marks page filter row and above the
 * Report Cards subject table. Stays small so it can sit beside other filters
 * on a single line on desktop and wrap cleanly on mobile.
 */
export function GradeDisplayFormatToggle({
  value,
  onChange,
  label = "Show scores as",
  className,
  size = "sm",
}: {
  value: GradeDisplayFormat;
  onChange: (next: GradeDisplayFormat) => void;
  label?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const padding = size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 print:hidden",
        className
      )}
    >
      {label ? (
        <span className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-zinc-400">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label ?? "Score display format"}
        className="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {FORMAT_OPTIONS.map((opt, idx) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary",
                padding,
                idx > 0 && "border-l border-slate-200 dark:border-zinc-700",
                active
                  ? "bg-school-primary text-white"
                  : "hover:bg-slate-50 dark:hover:bg-zinc-800"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
