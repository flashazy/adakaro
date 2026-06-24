"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopilotStatusBadge } from "./copilot-dock";

export function CopilotWelcomeScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
        <Sparkles className="h-7 w-7" aria-hidden />
      </div>

      <h2 className="mt-6 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Adakaro Copilot
      </h2>

      <div className="mt-3">
        <CopilotStatusBadge status="ready" />
      </div>

      <p className="mt-6 max-w-xs text-base font-medium text-slate-700 dark:text-zinc-200">
        Ask anything about your school
      </p>
      <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-zinc-400">
        Answers respect your role permissions.
      </p>
    </div>
  );
}
