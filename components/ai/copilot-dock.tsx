"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./copilot-dock.module.css";

export type CopilotAIStatus =
  | "ready"
  | "training_required"
  | "analyzing"
  | "connected";

const STATUS_META: Record<
  CopilotAIStatus,
  { label: string; shortLabel: string; className: string; dotClassName: string }
> = {
  ready: {
    label: "AI Ready",
    shortLabel: "AI Ready",
    className:
      "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60",
    dotClassName: "bg-emerald-500",
  },
  training_required: {
    label: "Training Required",
    shortLabel: "Training",
    className:
      "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60",
    dotClassName: "bg-amber-500",
  },
  analyzing: {
    label: "Analyzing",
    shortLabel: "Analyzing",
    className:
      "bg-indigo-50 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/60",
    dotClassName: "bg-indigo-500 animate-pulse",
  },
  connected: {
    label: "Connected to School Data",
    shortLabel: "School Data",
    className:
      "bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60",
    dotClassName: "bg-violet-500",
  },
};

export function CopilotStatusBadge({
  status,
  compact = false,
  className,
}: {
  status: CopilotAIStatus;
  compact?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        meta.className,
        className
      )}
    >
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotClassName)}
        aria-hidden
      />
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

export function CopilotDock({
  onClick,
  status = "ready",
}: {
  onClick: () => void;
  status?: CopilotAIStatus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group fixed z-40 cursor-pointer overflow-hidden rounded-2xl border border-white/70 bg-white/85 text-left shadow-lg shadow-indigo-500/10 backdrop-blur-xl",
        "transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200/80 hover:shadow-xl hover:shadow-indigo-500/25",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        "dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/30 dark:hover:border-indigo-700/60",
        "max-md:left-1/2 max-md:w-[85%] max-md:max-w-[340px] max-md:-translate-x-1/2",
        "max-md:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        "md:bottom-6 md:right-6 md:w-[min(340px,calc(100vw-2rem))]",
        "min-h-[68px] max-h-[76px]"
      )}
      aria-label="Open Adakaro Copilot"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/[0.04] via-violet-500/[0.06] to-indigo-500/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex h-full min-h-[68px] items-center gap-3 px-3.5 py-3 sm:px-4">
        <div className="relative shrink-0">
          <div
            className={cn(
              "pointer-events-none absolute -inset-1 rounded-2xl bg-indigo-400/40 blur-md",
              styles.iconGlow
            )}
            aria-hidden
          />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/35 ring-2 ring-indigo-400/20 transition duration-200 group-hover:shadow-xl group-hover:shadow-indigo-500/40">
            <Sparkles className="h-[18px] w-[18px]" aria-hidden />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            Adakaro Copilot
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-zinc-400 sm:line-clamp-1">
            Ask anything about your school
          </p>
          <div className="mt-1.5 md:hidden">
            <CopilotStatusBadge status={status} compact />
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <span className="rounded-md bg-indigo-600/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            AI
          </span>
          <CopilotStatusBadge status={status} compact />
        </div>
      </div>
    </button>
  );
}

export function copilotStatusFromChat(
  chatStatus: "idle" | "thinking" | "streaming" | "error",
  options?: { trainingRequired?: boolean }
): CopilotAIStatus {
  if (chatStatus === "thinking" || chatStatus === "streaming") {
    return "analyzing";
  }
  if (options?.trainingRequired) {
    return "training_required";
  }
  return "ready";
}
