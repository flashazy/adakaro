"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import type { GenerationStep } from "@/lib/ai-training/lesson-generator";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  steps: GenerationStep[];
  activeStepIndex: number;
  generatedCount: number;
  estimatedSecondsRemaining: number;
  className?: string;
}

export function GenerationProgress({
  steps,
  activeStepIndex,
  generatedCount,
  estimatedSecondsRemaining,
  className,
}: GenerationProgressProps) {
  const progressPercent = Math.min(
    100,
    Math.round(((activeStepIndex + 1) / Math.max(steps.length, 1)) * 100)
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              AI Lesson Generation
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              Building draft lessons…
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-indigo-600">
              {generatedCount}
            </p>
            <p className="text-xs text-slate-500">lessons generated</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>{progressPercent}% complete</span>
            <span>
              ~{Math.max(0, estimatedSecondsRemaining)}s remaining
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isComplete = step.complete || index < activeStepIndex;
          const isActive = index === activeStepIndex && !step.complete;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
                isComplete
                  ? "border-emerald-200 bg-emerald-50/60"
                  : isActive
                    ? "border-indigo-200 bg-indigo-50/80 shadow-sm"
                    : "border-slate-100 bg-white/60"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isComplete
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-slate-100 text-slate-400"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isComplete
                    ? "text-emerald-800"
                    : isActive
                      ? "text-indigo-900"
                      : "text-slate-500"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
