"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { consumeIntelligenceScrollRestore } from "@/lib/super-admin/smart-intelligence-navigation";
import { IntelligenceDetailDrawer } from "./intelligence-detail-drawer";
import { IntelligenceScorecard } from "./intelligence-scorecard";
import { ExecutiveSummaryBanner } from "./executive-summary-banner";
import { PlatformHealthMeter } from "./platform-health-meter";
import { PriorityAttentionTable } from "./priority-attention-table";
import { RecommendedActionsPanel } from "./recommended-actions-panel";
import { RevenueOpportunities } from "./revenue-opportunities";
import { ChampionSchools } from "./champion-schools";
import {
  IntelligenceInlineLoading,
  IntelligenceSectionSkeleton,
} from "./intelligence-skeleton";
import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type {
  IntelligenceCardId,
  SmartIntelligencePayload,
} from "@/lib/super-admin/smart-intelligence-types";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import {
  buildChampionSchools,
  buildExecutiveSummary,
  buildPriorityAttentionRows,
  buildRecommendedActions,
  buildRevenueOpportunities,
  buildScorecards,
  computePlatformHealth,
} from "@/lib/super-admin/smart-intelligence-presentation";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { siSectionStack } from "./intelligence-ui-tokens";
import { scrollToIntelligenceSection } from "./intelligence-interactions";

export interface SmartIntelligenceSectionProps {
  initialData: SmartIntelligencePayload | null;
  initialError: string | null;
  schoolCount: number;
  schools: SuperAdminSchoolRow[];
  activeSchools: number;
}

export function SmartIntelligenceSection({
  initialData,
  initialError,
  schoolCount,
  schools,
  activeSchools,
}: SmartIntelligenceSectionProps) {
  const [data, setData] = useState<SmartIntelligencePayload | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [activeCard, setActiveCard] = useState<IntelligenceCardId | null>(null);
  const [detailsOpening, setDetailsOpening] = useState<IntelligenceCardId | null>(null);

  useEffect(() => {
    consumeIntelligenceScrollRestore();
  }, []);

  const fetchIntelligence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/smart-intelligence", {
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as
        | SmartIntelligencePayload
        | { error?: string };
      if (!res.ok) {
        setError(
          "error" in body && body.error
            ? body.error
            : "Could not load smart intelligence."
        );
        return;
      }
      setData(body as SmartIntelligencePayload);
    } catch {
      setError("Network error while loading smart intelligence.");
    } finally {
      setLoading(false);
    }
  }, []);

  const presentation = useMemo(() => {
    if (!data) return null;
    return {
      summary: buildExecutiveSummary(data, schools, activeSchools),
      health: computePlatformHealth(data, schoolCount),
      scorecards: buildScorecards(data),
      priorityRows: buildPriorityAttentionRows(data),
      actions: buildRecommendedActions(data, schools),
      revenueOpportunities: buildRevenueOpportunities(data, schools),
      champions: buildChampionSchools(data, schools),
    };
  }, [data, schools, activeSchools, schoolCount]);

  function openDetails(id: IntelligenceCardId) {
    setDetailsOpening(id);
    window.setTimeout(() => {
      setActiveCard(id);
      setDetailsOpening(null);
    }, 120);
  }

  function closeDetails() {
    setActiveCard(null);
  }

  function scrollToPriority() {
    scrollToIntelligenceSection("priority-attention");
  }

  function handleRecommendedAction(actionId: string) {
    switch (actionId) {
      case "contact-churn":
        setActiveCard(null);
        scrollToIntelligenceSection("priority-attention");
        break;
      case "onboarding-followup":
        setActiveCard("onboarding");
        break;
      case "upsell-engaged":
        setActiveCard(null);
        scrollToIntelligenceSection("revenue-opportunities");
        break;
      case "revenue-review":
        setActiveCard("revenue");
        break;
      case "all-clear":
        setActiveCard(null);
        scrollToIntelligenceSection("smart-intelligence-scorecards");
        break;
      default:
        break;
    }
  }

  const isEmpty = schoolCount === 0 && !loading && !error;

  return (
    <section
      id="smart-intelligence"
      className="mt-10 border-t border-slate-200/50 pt-12"
      aria-labelledby="smart-intelligence-heading"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="smart-intelligence-heading"
            className="text-xl font-semibold tracking-tight text-slate-950"
          >
            Smart Intelligence
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Executive decision center — churn, risk, revenue, onboarding, and engagement.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-6 space-y-5">
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          <IntelligenceSectionSkeleton />
        </div>
      ) : error && !data ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 px-6 py-10 text-center shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
          <p className="mt-3 text-sm font-medium text-red-800">{error}</p>
          <SuperAdminLoadingButton
            type="button"
            loading={loading}
            loadingLabel="Retrying…"
            className={cn(saBtnSecondarySm, "mt-4")}
            onClick={() => void fetchIntelligence()}
          >
            Retry
          </SuperAdminLoadingButton>
        </div>
      ) : isEmpty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">No schools yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Intelligence summaries will appear once schools are registered on the platform.
          </p>
        </div>
      ) : data && presentation ? (
        <div className={cn("mt-8", siSectionStack)}>
          <ExecutiveSummaryBanner
            summary={presentation.summary}
            computedAt={data.computedAt}
            onViewPriority={scrollToPriority}
          />

          <PlatformHealthMeter health={presentation.health} />

          <div id="smart-intelligence-scorecards">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Intelligence Scorecards
            </h3>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {presentation.scorecards.map((card) => (
                <IntelligenceScorecard
                  key={card.id}
                  card={card}
                  onViewDetails={openDetails}
                  detailsLoading={detailsOpening === card.id}
                  className={card.id === "engagement" ? "xl:col-span-1" : undefined}
                />
              ))}
            </div>
          </div>

          <RecommendedActionsPanel
            actions={presentation.actions}
            onAction={handleRecommendedAction}
          />

          <PriorityAttentionTable rows={presentation.priorityRows} />

          <div className="grid gap-8 xl:grid-cols-2">
            <RevenueOpportunities
              rows={presentation.revenueOpportunities}
              data={data}
              schools={schools}
            />
            <ChampionSchools rows={presentation.champions} data={data} />
          </div>

          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>Refresh failed: {error}</span>
              <SuperAdminLoadingButton
                type="button"
                loading={loading}
                loadingLabel="Retrying…"
                className={saBtnSecondarySm}
                onClick={() => void fetchIntelligence()}
              >
                Retry
              </SuperAdminLoadingButton>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <IntelligenceInlineLoading />
        </div>
      )}

      <IntelligenceDetailDrawer
        cardId={activeCard}
        data={data}
        onClose={closeDetails}
      />
    </section>
  );
}
