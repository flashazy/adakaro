"use client";

import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";

export function AISuggestions({
  suggestions,
  onSelect,
  disabled = false,
  className,
}: {
  suggestions: AISuggestion[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 px-4 pb-2", className)}>
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s.prompt)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
