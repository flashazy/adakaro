"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";
import { AISuggestions } from "./AISuggestions";

export function PublicAIWelcomeScreen({
  suggestions,
  onSelectSuggestion,
  disabled = false,
  className,
}: {
  suggestions: AISuggestion[];
  onSelectSuggestion: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 pt-5 pb-3 sm:px-5 sm:pt-6",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
        <Sparkles className="h-7 w-7" aria-hidden />
      </div>

      <h2 className="mt-3 text-center text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
        <span aria-hidden>✨ </span>
        Hi! I&apos;m Adakaro AI
      </h2>

      <p className="mt-1.5 max-w-xs text-center text-sm text-slate-500 dark:text-zinc-400">
        Ask me anything about Adakaro.
      </p>

      <div className="mt-4 w-full max-w-md">
        <AISuggestions
          suggestions={suggestions}
          onSelect={onSelectSuggestion}
          disabled={disabled}
          variant="premium"
          className="justify-center gap-2 px-0"
        />
      </div>
    </div>
  );
}
