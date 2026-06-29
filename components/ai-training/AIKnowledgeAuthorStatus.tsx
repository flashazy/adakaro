"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import {
  DRAFT_GENERATION_STAGES,
  DRAFT_GENERATION_STAGE_LABELS,
  type DraftGenerationStage,
} from "@/lib/ai-author/types";
import { ProgressBar } from "@/components/ai-training/author-panel-shared";
import { cn } from "@/lib/utils";

export function AIKnowledgeAuthorStatus({
  activeStage,
  complete,
  className,
}: {
  activeStage: DraftGenerationStage | null;
  complete: boolean;
  className?: string;
}) {
  if (!activeStage && !complete) return null;

  const activeIndex = activeStage
    ? DRAFT_GENERATION_STAGES.indexOf(activeStage)
    : DRAFT_GENERATION_STAGES.length;

  const progress = complete
    ? 100
    : Math.round(((activeIndex + 0.5) / DRAFT_GENERATION_STAGES.length) * 100);

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 p-4 shadow-sm",
        className
      )}
    >
      {complete ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Enterprise Draft Ready
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <Sparkles className="h-4 w-4 animate-pulse text-indigo-600" />
            Knowledge Intelligence Engine
          </div>
          <ProgressBar value={progress} />
          <p className="text-[10px] text-indigo-600/80">{progress}% complete</p>
        </div>
      )}

      <ol className="mt-3 space-y-1">
        {DRAFT_GENERATION_STAGES.map((stage, index) => {
          const done = complete || index < activeIndex;
          const active = !complete && stage === activeStage;

          return (
            <li
              key={stage}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-300",
                done && "text-emerald-800",
                active && "bg-white/90 font-medium text-indigo-900 shadow-sm",
                !done && !active && "text-slate-400"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200" />
              )}
              {DRAFT_GENERATION_STAGE_LABELS[stage]}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
