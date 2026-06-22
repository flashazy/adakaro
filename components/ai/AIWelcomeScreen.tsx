"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";
import { AISuggestions } from "./AISuggestions";

const PUBLIC_TOPICS = [
  "Report Cards",
  "Attendance",
  "School Finance",
  "Student Management",
  "Pricing",
  "Getting Started",
] as const;

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
  const isPublicPremium = variant === "public";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-5 py-8",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25",
          isPublicPremium ? "h-14 w-14" : "h-16 w-16"
        )}
      >
        <Sparkles
          className={isPublicPremium ? "h-7 w-7" : "h-8 w-8"}
          aria-hidden
        />
      </div>
      <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isPublicPremium ? (
          <>
            <span aria-hidden>👋 </span>
            Welcome to Adakaro AI
          </>
        ) : (
          title
        )}
      </h2>
      {isPublicPremium ? (
        <div className="mt-4 max-w-sm text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            Ask me about:
          </p>
          <ul className="mt-3 space-y-1.5 text-left text-sm text-slate-600 dark:text-zinc-400">
            {PUBLIC_TOPICS.map((topic) => (
              <li key={topic} className="flex items-center gap-2">
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-indigo-400"
                  aria-hidden
                />
                {topic}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            I can help you quickly find information about Adakaro.
          </p>
        </div>
      ) : (
        <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
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
