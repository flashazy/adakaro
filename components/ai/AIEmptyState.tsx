"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AIEmptyState({
  title = "Start a conversation",
  description = "Ask anything about Adakaro.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/50">
        <Sparkles className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
