"use client";

import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";

export function CopilotPromptCards({
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
    <div className={cn("grid gap-2", className)}>
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s.prompt)}
          className={cn(
            "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-left text-sm font-medium text-slate-700 shadow-sm",
            "transition-all duration-200 hover:-translate-y-px hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md hover:shadow-indigo-500/10",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
