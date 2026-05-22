"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoordinatorParentAccessSummary } from "./types";

export type ParentAccessFilter = "all" | "can_open" | "cannot_open";

export function ParentAccessBadge({ canOpen }: { canOpen: boolean }) {
  if (canOpen) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/45 dark:bg-emerald-950/40 dark:text-emerald-100">
        <span aria-hidden>🟢</span>
        Parent Can Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-900 dark:border-rose-900/45 dark:bg-rose-950/40 dark:text-rose-100">
      <span aria-hidden>🔴</span>
      Parent Cannot Open
    </span>
  );
}

export function ParentAccessColumnHeader() {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
      <span className="relative inline-flex items-center gap-1">
        Parent Access
        <button
          type="button"
          title="Parent access depends on school fee rules set by Finance/Admin."
          className="inline-flex rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:text-zinc-500 dark:hover:text-zinc-300"
          aria-describedby={tooltipId}
          aria-label="About parent access"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-0 top-full z-10 mt-1 max-w-[14rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-normal normal-case tracking-normal text-slate-600 shadow-md dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
            open ? "block" : "hidden"
          )}
        >
          Parent access depends on school fee rules set by Finance/Admin.
        </span>
      </span>
    </th>
  );
}

export function ParentAccessSummaryBanner({
  summary,
}: {
  summary: CoordinatorParentAccessSummary;
}) {
  const { canOpenCount, cannotOpenCount } = summary;
  const total = canOpenCount + cannotOpenCount;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800/40 sm:px-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Parent Report Access Summary
      </p>
      <div className="mt-1 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <p className="font-medium text-slate-800 dark:text-zinc-100">
          <span aria-hidden>🟢</span> {canOpenCount} parent
          {canOpenCount === 1 ? "" : "s"} can open reports
        </p>
        {cannotOpenCount > 0 ? (
          <p className="font-medium text-slate-800 dark:text-zinc-100">
            <span aria-hidden>🔴</span> {cannotOpenCount} parent
            {cannotOpenCount === 1 ? "" : "s"} cannot open reports
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
        Fee payment rules affect parent visibility only. Coordinator report
        generation is not affected.
      </p>
    </div>
  );
}

export function ParentAccessFilterBar({
  value,
  onChange,
}: {
  value: ParentAccessFilter;
  onChange: (next: ParentAccessFilter) => void;
}) {
  const chips: { id: ParentAccessFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "can_open", label: "Can Open" },
    { id: "cannot_open", label: "Cannot Open" },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
        <span className="shrink-0 font-medium">Show</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ParentAccessFilter)}
          className="h-9 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          aria-label="Filter students by parent access"
        >
          <option value="all">All students</option>
          <option value="can_open">Parent Can Open</option>
          <option value="cannot_open">Parent Cannot Open</option>
        </select>
      </label>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Quick filter by parent access"
      >
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              value === chip.id
                ? "border-school-primary bg-school-primary/10 text-school-primary dark:border-school-primary dark:bg-school-primary/20"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ParentAccessConfirmationBlock({
  summary,
  intro = "Report cards will generate normally.",
}: {
  summary: CoordinatorParentAccessSummary;
  intro?: string;
}) {
  const { canOpenCount, cannotOpenCount } = summary;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-slate-700 dark:text-zinc-300">{intro}</p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Parent visibility summary
        </p>
        <ul className="mt-2 space-y-1 font-medium text-slate-800 dark:text-zinc-100">
          <li>
            <span aria-hidden>🟢</span> {canOpenCount} parent account
            {canOpenCount === 1 ? "" : "s"} can open reports
          </li>
          {cannotOpenCount > 0 ? (
            <li>
              <span aria-hidden>🔴</span> {cannotOpenCount} parent account
              {cannotOpenCount === 1 ? "" : "s"} cannot open reports yet
            </li>
          ) : null}
        </ul>
        {cannotOpenCount > 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            Reason: School fee requirement not reached.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
          Coordinator actions will continue normally.
        </p>
      </div>
    </div>
  );
}
