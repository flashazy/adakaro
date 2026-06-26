"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";
import { AISuggestions } from "./AISuggestions";

export function AIWelcomeScreen({
  title,
  subtitle,
  suggestions,
  onSelectSuggestion,
  disabled = false,
  variant = "default",
  className,
}: {
  title: string;
  subtitle: string;
  suggestions: AISuggestion[];
  onSelectSuggestion: (prompt: string) => void;
  disabled?: boolean;
  variant?: "default" | "public" | "copilot";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-5 py-8",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
        <Sparkles className="h-8 w-8" aria-hidden />
      </div>
      <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
        {subtitle}
      </p>
      <div className="mt-8 w-full max-w-lg">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Suggested prompts
        </p>
        <AISuggestions
          suggestions={suggestions}
          onSelect={onSelectSuggestion}
          disabled={disabled}
          className="justify-center px-0"
        />
      </div>
    </div>
  );
}
