"use client";

import { Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
          style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

export function AIThinkingIndicator({
  className,
  showAvatar = false,
  showIdentity = false,
}: {
  className?: string;
  /** Chat-style row with Adakaro AI avatar (matches message bubbles). */
  showAvatar?: boolean;
  /** Show "Adakaro AI" identity label (public assistant). */
  showIdentity?: boolean;
}) {
  if (showAvatar) {
    return (
      <div
        className={cn(
          "flex gap-3 px-4 py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="Adakaro AI is thinking"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
          aria-hidden
        >
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {showIdentity ? (
            <p className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <Sparkles className="h-3 w-3 text-indigo-500" aria-hidden />
              Adakaro AI
            </p>
          ) : null}
          <div
            className={cn(
              "ai-thinking-shimmer relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
              "before:pointer-events-none before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-indigo-50/60 before:to-transparent dark:before:via-indigo-950/30"
            )}
          >
            <div className="relative flex items-center gap-2.5 text-sm text-slate-500 dark:text-zinc-400">
              <ThinkingDots />
              <span className="font-medium">Thinking…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2 text-sm text-slate-500", className)}
      role="status"
      aria-live="polite"
      aria-label="Adakaro AI is thinking"
    >
      <ThinkingDots />
      <span>Thinking…</span>
    </div>
  );
}
