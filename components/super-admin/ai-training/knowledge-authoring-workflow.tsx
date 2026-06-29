"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import {
  AUTHORING_WORKFLOW_STEPS,
  type AuthoringWorkflowStepState,
} from "@/lib/ai-training/knowledge-authoring-workflow";
import { cn } from "@/lib/utils";

export function AuthoringWorkflowRail({
  steps,
  loadingStepId,
}: {
  steps: AuthoringWorkflowStepState[];
  loadingStepId?: string | null;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <WorkflowStepPill
              step={step}
              number={index + 1}
              loading={loadingStepId === step.id}
            />
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-0.5 h-px w-4 shrink-0 sm:w-6",
                  step.status === "complete" ? "bg-emerald-300" : "bg-slate-200"
                )}
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function WorkflowStepPill({
  step,
  number,
  loading = false,
}: {
  step: AuthoringWorkflowStepState;
  number: number;
  loading?: boolean;
}) {
  const meta = AUTHORING_WORKFLOW_STEPS.find((s) => s.id === step.id);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors sm:px-2.5",
        step.status === "complete" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        step.status === "active" &&
          "border-indigo-300 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100",
        step.status === "pending" && "border-slate-200 bg-white text-slate-400"
      )}
      title={meta?.description}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]",
          step.status === "complete" && "bg-emerald-600 text-white",
          step.status === "active" && "bg-indigo-600 text-white",
          step.status === "pending" && "bg-slate-100 text-slate-400"
        )}
      >
        {step.status === "complete" ? (
          <Check className="h-2.5 w-2.5" />
        ) : step.status === "active" && loading ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          number
        )}
      </span>
      <span className="hidden sm:inline">{step.label}</span>
    </div>
  );
}

export function AuthoringWorkflowSection({
  stepId,
  stepNumber,
  title,
  subtitle,
  status,
  children,
}: {
  stepId: string;
  stepNumber: number;
  title: string;
  subtitle?: string;
  status: AuthoringWorkflowStepState["status"];
  children: React.ReactNode;
}) {
  return (
    <section
      id={`authoring-step-${stepId}`}
      className={cn(
        "rounded-xl border p-4 transition-colors",
        status === "active" && "border-indigo-200 bg-indigo-50/30",
        status === "complete" && "border-emerald-100 bg-white",
        status === "pending" && "border-slate-200 bg-slate-50/40"
      )}
    >
      <header className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            status === "complete" && "bg-emerald-100 text-emerald-700",
            status === "active" && "bg-indigo-100 text-indigo-700",
            status === "pending" && "bg-slate-100 text-slate-400"
          )}
        >
          {status === "complete" ? <Check className="h-4 w-4" /> : stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {status === "complete" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
            Done
          </span>
        ) : status === "active" ? (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
            Current
          </span>
        ) : (
          <Circle className="h-4 w-4 text-slate-300" aria-hidden />
        )}
      </header>
      {children}
    </section>
  );
}
