"use client";

/**
 * Shared "score display format" toggle.
 *
 * Teachers can choose how a numeric score appears wherever it shows up in the
 * Marks page and Report Cards page. The underlying calculations never change —
 * only the rendered string. The chosen format persists across reloads via
 * `localStorage` so each teacher's preference sticks.
 *
 * Three formats are supported:
 *   - "percentage" — e.g. "82% (A)" on the Marks page, "82%" on report cards
 *   - "marks"      — e.g. "41/50 (A)"        / "41/50"
 *   - "both"       — e.g. "41/50 - 82% (A)"  / "41/50 (82%)"
 *
 * Default is "percentage" so existing screens look identical until the teacher
 * opts in to a different display.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMaxScore } from "@/lib/tanzania-grades";
import type { SchoolLevel } from "@/lib/school-level";

export type GradeDisplayFormat = "percentage" | "marks" | "both";

export const DEFAULT_GRADE_DISPLAY_FORMAT: GradeDisplayFormat = "percentage";

/** localStorage key — namespaced to avoid clashing with anything else. */
export const GRADE_DISPLAY_FORMAT_STORAGE_KEY = "adakaro:grade-display-format";

const VALID_VALUES: readonly GradeDisplayFormat[] = [
  "percentage",
  "marks",
  "both",
] as const;

export function isGradeDisplayFormat(
  value: unknown
): value is GradeDisplayFormat {
  return (
    typeof value === "string" &&
    (VALID_VALUES as readonly string[]).includes(value)
  );
}

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

/* -------------------------------------------------------------------------- */
/*                              Number formatting                             */
/* -------------------------------------------------------------------------- */

function trimTrailingZero(n: number): string {
  // Up to 1 decimal, but drop ".0" so integers look clean ("41" not "41.0").
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercentLabel(percent: number | null): string {
  if (percent == null || !Number.isFinite(percent)) return "—";
  return `${trimTrailingZero(percent)}%`;
}

function formatMarksLabel(score: number | null, maxScore: number): string {
  if (score == null || !Number.isFinite(score) || maxScore <= 0) return "—";
  return `${trimTrailingZero(score)}/${trimTrailingZero(maxScore)}`;
}

/**
 * Render a single Marks-page cell value (matrix or single-assignment table).
 * The letter grade is appended in parentheses when supplied. Examples with
 * letter "A":
 *   percentage → "82% (A)"
 *   marks      → "41/50 (A)"
 *   both       → "41/50 - 82% (A)"
 */
export function formatMarksCellLabel(params: {
  score: number | null;
  maxScore: number;
  percent: number | null;
  letter?: string | null;
  format: GradeDisplayFormat;
}): string {
  const { score, maxScore, percent, letter, format } = params;
  const noScore =
    score == null ||
    !Number.isFinite(score) ||
    percent == null ||
    !Number.isFinite(percent);
  if (noScore) return "—";

  const pctLabel = formatPercentLabel(percent);
  const marksLabel = formatMarksLabel(score, maxScore);
  const tail = letter && letter !== "—" ? ` (${letter})` : "";

  switch (format) {
    case "marks":
      return `${marksLabel}${tail}`;
    case "both":
      return `${marksLabel} - ${pctLabel}${tail}`;
    case "percentage":
    default:
      return `${pctLabel}${tail}`;
  }
}

/**
 * Render a single Report-Cards subject cell value. No letter grade appended
 * (the report card has its own dedicated "Grade" column). Examples:
 *   percentage → "82%"
 *   marks      → "41/50"
 *   both       → "41/50 (82%)"
 *
 * Report-card storage only persists percentages, so when the teacher picks
 * "marks" or "both" we synthesize the marks fraction from the school's
 * standard max score (50 for primary, 100 for secondary). That keeps the
 * display consistent with the Marks page grading scale.
 */
export function formatReportCardCellLabel(params: {
  percent: number | null;
  format: GradeDisplayFormat;
  schoolLevel: SchoolLevel | null | undefined;
}): string {
  const { percent, format, schoolLevel } = params;
  if (percent == null || !Number.isFinite(percent)) return "—";

  const max = getMaxScore(schoolLevel ?? "secondary");
  const pctLabel = formatPercentLabel(percent);
  const synthesizedScore = (percent / 100) * max;
  const marksLabel = formatMarksLabel(synthesizedScore, max);

  switch (format) {
    case "marks":
      return marksLabel;
    case "both":
      return `${marksLabel} (${pctLabel})`;
    case "percentage":
    default:
      return pctLabel;
  }
}
