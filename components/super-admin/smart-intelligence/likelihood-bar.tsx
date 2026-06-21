"use client";

import { cn } from "@/lib/utils";

export interface LikelihoodBarProps {
  value: number;
  className?: string;
}

/** Visual likelihood bar for revenue opportunity scanning. */
export function LikelihoodBar({ value, className }: LikelihoodBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round(clamped / 10);

  return (
    <div className={cn("flex min-w-[120px] flex-col gap-1", className)}>
      <span className="text-xs font-bold tabular-nums text-indigo-800">{clamped}%</span>
      <div
        className="font-mono text-[10px] leading-none tracking-tight text-indigo-600/80"
        aria-hidden
      >
        {"█".repeat(filled)}
        <span className="text-slate-200">{"░".repeat(10 - filled)}</span>
      </div>
    </div>
  );
}
