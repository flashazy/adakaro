"use client";

import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";

export function AISuggestions({
  suggestions,
  onSelect,
  disabled = false,
  className,
  variant = "default",
}: {
  suggestions: AISuggestion[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "premium";
}) {
  if (suggestions.length === 0) return null;

  const isPremium = variant === "premium";

  return (
    <div
      className={cn(
        "flex flex-wrap justify-center gap-2 px-4 pb-2",
        className
      )}
    >
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s.prompt)}
          className={cn(
            "cursor-pointer rounded-full border text-left font-medium shadow-sm",
            "transition-all duration-150 ease-out",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
            "active:scale-[0.98]",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
            isPremium
              ? cn(
                  "border-slate-200/90 bg-white px-3.5 py-2 text-[13px] leading-snug text-slate-700",
                  "shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
                  "hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/90 hover:text-indigo-700 hover:shadow-md hover:shadow-indigo-500/10",
                  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none",
                  "dark:hover:border-indigo-800 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300"
                )
              : cn(
                  "border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700",
                  "hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
                  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                  "dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                )
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
