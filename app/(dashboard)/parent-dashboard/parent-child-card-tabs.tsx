"use client";

import { useState, type ReactNode, Children } from "react";
import { cn } from "@/lib/utils";

const TAB_LABELS = [
  "Fees",
  "Report cards",
  "Exam results",
  "Attendance",
  "Class results",
] as const;

/**
 * Renders one of five RSC child segments (active tab). Child order: Fees, Report
 * cards, Exam results, Attendance, Class results.
 */
export function ParentChildCardTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);
  return (
    <div>
      <div
        className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900/40"
        role="tablist"
        aria-label="Student sections"
      >
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={cn(
              "relative rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
              active === i
                ? "bg-slate-50 text-school-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-school-primary dark:bg-zinc-800/80 dark:text-school-primary"
                : "text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0" role="tabpanel">
        {items[active] ?? null}
      </div>
    </div>
  );
}
