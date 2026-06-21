"use client";

import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type { ExecutiveSummaryView } from "@/lib/super-admin/smart-intelligence-presentation";
import { platformHealthBadgeClass } from "@/lib/super-admin/smart-intelligence-presentation";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { siCardSurface } from "./intelligence-ui-tokens";

export interface ExecutiveSummaryBannerProps {
  summary: ExecutiveSummaryView;
  computedAt: string;
  onViewPriority: () => void;
}

function MicroKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export function ExecutiveSummaryBanner({
  summary,
  computedAt,
  onViewPriority,
}: ExecutiveSummaryBannerProps) {
  const updated = new Date(computedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { microKpis } = summary;

  return (
    <article
      className={cn(
        siCardSurface,
        "relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 lg:p-8"
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-100/30 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Executive Brief
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                platformHealthBadgeClass(summary.healthBadge.tone)
              )}
            >
              {summary.healthBadge.label}
            </span>
            {summary.totalAlerts > 0 ? (
              <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {summary.totalAlerts} alert{summary.totalAlerts === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950 lg:text-2xl">
            Platform Intelligence Summary
          </h3>

          <div
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200/50 bg-white/70 px-4 py-3"
            aria-label="Platform micro KPIs"
          >
            <MicroKpi label="Schools" value={microKpis.schools} />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <MicroKpi label="Paid" value={microKpis.paid} />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <MicroKpi label="At Risk" value={microKpis.atRisk} />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <MicroKpi label="Champions" value={microKpis.champions} />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <MicroKpi label="Stuck" value={microKpis.stuckSetup} />
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-500 lg:text-[15px] lg:leading-7">
            {summary.narrative}
          </p>
          <p className="mt-4 text-xs text-slate-400">Last updated {updated}</p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            className={cn(
              saBtnPrimarySm,
              "px-5 py-2.5 text-sm transition-transform active:scale-[0.98]"
            )}
            onClick={onViewPriority}
          >
            View Priority Schools
          </button>
        </div>
      </div>
    </article>
  );
}
