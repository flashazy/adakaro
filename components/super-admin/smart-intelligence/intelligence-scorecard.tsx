"use client";

import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type { IntelligenceCardId } from "@/lib/super-admin/smart-intelligence-types";
import type { ScorecardView } from "@/lib/super-admin/smart-intelligence-presentation";
import { trendLabelClass } from "@/lib/super-admin/smart-intelligence-presentation";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Rocket,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { intelligenceStatusBadgeClass } from "./intelligence-skeleton";
import { Sparkline } from "./sparkline";
import { siCardSurface, siCardSurfaceHover } from "./intelligence-ui-tokens";

const CARD_ICONS: Record<IntelligenceCardId, LucideIcon> = {
  churn: AlertTriangle,
  risk: Activity,
  revenue: DollarSign,
  onboarding: Rocket,
  engagement: Users,
};

function TrendIcon({ direction }: { direction: ScorecardView["trend"]["direction"] }) {
  if (direction === "up") {
    return <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />;
  }
  if (direction === "down") {
    return <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />;
  }
  return null;
}

export interface IntelligenceScorecardProps {
  card: ScorecardView;
  onViewDetails: (id: IntelligenceCardId) => void;
  detailsLoading?: boolean;
  className?: string;
}

export function IntelligenceScorecard({
  card,
  onViewDetails,
  detailsLoading = false,
  className,
}: IntelligenceScorecardProps) {
  const Icon = CARD_ICONS[card.id];

  return (
    <article
      className={cn(
        siCardSurface,
        siCardSurfaceHover,
        "group flex min-h-[232px] flex-col p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={intelligenceStatusBadgeClass(card.statusBadge.tone)}>
          {card.statusBadge.label}
        </span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Sparkline
              points={card.sparkline.points}
              placeholder={card.sparkline.placeholder}
              direction={card.trend.direction}
            />
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50/80 text-indigo-600 transition-colors group-hover:bg-indigo-100">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">30d trend</span>
        </div>
      </div>

      <p className="mt-6 text-[10px] font-semibold uppercase tracking-widest text-slate-400/90">
        {card.title}
      </p>
      <p className="mt-1 text-[2.05rem] font-bold leading-none tracking-tight text-slate-950 tabular-nums">
        {card.headlineValue}
      </p>

      <p
        className={cn(
          "mt-3 inline-flex max-w-full items-center gap-1 text-[11px] font-medium",
          trendLabelClass(card.trend.direction)
        )}
        title={card.trend.label}
      >
        <TrendIcon direction={card.trend.direction} />
        <span className="truncate">{card.trend.label}</span>
      </p>

      <p className="mt-auto pt-5 text-xs leading-relaxed text-slate-400">
        {card.insight}
      </p>

      <div className="mt-4 border-t border-slate-100/80 pt-4">
        <SuperAdminLoadingButton
          type="button"
          loading={detailsLoading}
          loadingLabel="Opening…"
          className={cn(
            saBtnSecondarySm,
            "w-full border-transparent bg-slate-50/80 text-indigo-600 shadow-none hover:bg-indigo-50 hover:text-indigo-700"
          )}
          onClick={() => onViewDetails(card.id)}
        >
          View details
        </SuperAdminLoadingButton>
      </div>
    </article>
  );
}
