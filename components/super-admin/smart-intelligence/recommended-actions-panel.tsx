"use client";

import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type { RecommendedActionItem } from "@/lib/super-admin/smart-intelligence-presentation";
import { cn } from "@/lib/utils";
import { siCardSurface } from "./intelligence-ui-tokens";

function actionToneClass(tone: RecommendedActionItem["tone"]): string {
  switch (tone) {
    case "critical":
      return "border-red-100/80 bg-red-50/25 hover:border-red-200/60";
    case "warning":
      return "border-amber-100/80 bg-amber-50/25 hover:border-amber-200/60";
    case "healthy":
      return "border-emerald-100/80 bg-emerald-50/25 hover:border-emerald-200/60";
    default:
      return "border-slate-200/60 bg-white hover:border-indigo-100/80";
  }
}

function impactBadgeClass(tone: RecommendedActionItem["tone"]): string {
  switch (tone) {
    case "critical":
      return "border-red-200/70 bg-red-50/80 text-red-800";
    case "warning":
      return "border-amber-200/70 bg-amber-50/80 text-amber-800";
    case "healthy":
      return "border-emerald-200/70 bg-emerald-50/80 text-emerald-800";
    default:
      return "border-slate-200/70 bg-slate-50/80 text-slate-600";
  }
}

export interface RecommendedActionsPanelProps {
  actions: RecommendedActionItem[];
  onAction: (actionId: string) => void;
}

export function RecommendedActionsPanel({
  actions,
  onAction,
}: RecommendedActionsPanelProps) {
  return (
    <article className={cn(siCardSurface, "p-6")}>
      <h3 className="text-base font-semibold tracking-tight text-slate-950">
        Recommended Actions Today
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Actionable tasks generated from current platform intelligence.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className={cn(
              "flex flex-col rounded-xl border p-5 transition-all duration-200",
              actionToneClass(action.tone)
            )}
          >
            <p className="text-sm font-semibold text-slate-900">
              <span className="mr-1.5" aria-hidden>
                {action.emoji}
              </span>
              {action.title}
            </p>
            <span
              className={cn(
                "mt-2 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                impactBadgeClass(action.tone)
              )}
            >
              {action.impactBadge}
            </span>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-500">
              {action.description}
            </p>
            <div className="mt-4">
              <button
                type="button"
                className={cn(
                  saBtnSecondarySm,
                  "border-slate-200/60 bg-white transition-colors hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                )}
                onClick={() => onAction(action.id)}
              >
                {action.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
