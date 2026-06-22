"use client";

import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";
import type { CopilotSnapshot } from "@/lib/ai/copilot/types";
import { CopilotPromptCards } from "./copilot-prompt-cards";
import { CopilotSnapshotCard } from "./copilot-snapshot-card";

const CAPABILITY_CARDS = [
  {
    id: "academics",
    emoji: "📚",
    label: "Academics",
    prompt: "Which classes are behind on syllabus coverage?",
  },
  {
    id: "finance",
    emoji: "💰",
    label: "Finance",
    prompt: "Generate a fee collection summary for this term.",
  },
  {
    id: "students",
    emoji: "👨‍🎓",
    label: "Students",
    prompt: "Show students with fee balances.",
  },
  {
    id: "reports",
    emoji: "📊",
    label: "Reports",
    prompt: "How many admissions do we have this month?",
  },
] as const;

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function CopilotWelcomeScreen({
  suggestions,
  onFillPrompt,
  onSendPrompt,
  snapshot = null,
  disabled = false,
  showOnboarding = true,
  className,
}: {
  suggestions: AISuggestion[];
  onFillPrompt: (prompt: string) => void;
  onSendPrompt?: (prompt: string) => void;
  snapshot?: CopilotSnapshot | null;
  disabled?: boolean;
  showOnboarding?: boolean;
  className?: string;
}) {
  const handleSnapshotAction = (prompt: string) => {
    if (onSendPrompt) onSendPrompt(prompt);
    else onFillPrompt(prompt);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-5 px-4 py-5 sm:px-5",
        className
      )}
    >
      {showOnboarding ? (
        <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/80 px-4 py-3.5 dark:border-amber-900/40 dark:from-amber-950/40 dark:to-orange-950/20">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            AI Training Center Ready
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/90">
            Start teaching Adakaro Copilot with your most common school
            questions and answers.
          </p>
        </div>
      ) : null}

      {snapshot ? (
        <CopilotSnapshotCard
          snapshot={snapshot}
          onAction={handleSnapshotAction}
          disabled={disabled}
        />
      ) : null}

      <div className="space-y-3">
        <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {getTimeGreeting()} <span aria-hidden>👋</span>
        </p>
        <div className="space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
          <p className="font-medium text-slate-800 dark:text-zinc-100">
            I&apos;m Adakaro Copilot.
          </p>
          <div>
            <p className="text-slate-500 dark:text-zinc-400">I can help with:</p>
            <ul className="mt-1.5 space-y-1">
              {["Students", "Attendance", "Finance", "Reports", "School Operations"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1 w-1 shrink-0 rounded-full bg-indigo-400"
                      aria-hidden
                    />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
          <p className="font-medium text-slate-700 dark:text-zinc-200">
            What would you like to know?
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CAPABILITY_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={disabled}
            onClick={() => onFillPrompt(card.prompt)}
            className={cn(
              "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2 py-3 text-center",
              "transition-all duration-200 hover:-translate-y-px hover:border-indigo-200 hover:bg-white hover:shadow-md hover:shadow-indigo-500/10",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
              "disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-indigo-800 dark:hover:bg-zinc-900"
            )}
          >
            <span className="text-lg leading-none" aria-hidden>
              {card.emoji}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              {card.label}
            </span>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Try asking
        </p>
        <CopilotPromptCards
          suggestions={suggestions}
          onSelect={onFillPrompt}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
