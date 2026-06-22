"use client";

import { cn } from "@/lib/utils";

export function AIThinkingIndicator({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-2 text-sm text-slate-500", className)}
      role="status"
      aria-live="polite"
      aria-label="Adakaro AI is thinking"
    >
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span>Thinking…</span>
    </div>
  );
}
