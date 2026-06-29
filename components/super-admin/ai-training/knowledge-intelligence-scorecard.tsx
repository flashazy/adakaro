"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  AnimatedNumber,
  GlassPanel,
  IntelligenceTrendChart,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildPageInsight } from "@/lib/ai-training/operations-presentation";
import { scorecardToRadarData } from "@/lib/ai-training/knowledge-intelligence-score";
import { cn } from "@/lib/utils";

const SCORE_EXPLANATIONS: Record<string, string> = {
  "Knowledge Quality": "Writing clarity and structure of published lessons.",
  "Reviewer Confidence": "How confidently reviewers approve generated content.",
  "Knowledge Strength": "Importance weight of core vs reference knowledge.",
  "Coverage Contribution": "How well lessons fill curriculum targets.",
  "Retrieval Readiness": "Keyword richness and search phrase coverage.",
  "Freshness": "Recency of updates across active knowledge.",
  "Dependency Health": "Prerequisite and reference link integrity.",
  "Keyword Richness": "Depth of searchable metadata per lesson.",
  "AI Reliability": "Consistency of successful answer retrieval.",
  "Learning Value": "Impact of usage signals on knowledge improvement.",
};

export function KnowledgeIntelligenceScorecardPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={2} />;

  const scorecard = snapshot?.scorecard;
  if (!scorecard) return null;

  const radar = scorecardToRadarData(scorecard);
  const insight = buildPageInsight("intelligence", snapshot);

  return (
    <div className={OPS_STACK}>
      <PageAIInsight message={insight} context="intelligence" />

      <GlassPanel gradient="indigo" compact>
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">System Intelligence</p>
        <p className="mt-0.5 text-3xl font-extrabold tabular-nums text-slate-900">
          <AnimatedNumber value={scorecard.composite} />
          <span className="ml-2 text-sm font-medium text-slate-500">composite</span>
        </p>
      </GlassPanel>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <GlassPanel compact>
          <p className="text-xs font-semibold text-slate-900">Intelligence radar</p>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "#64748b" }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#7c3aed"
                  fill="#7c3aed"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  animationDuration={400}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Health trend" color="#7c3aed" compact />
      </div>

      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-5")}>
        {radar.map((item) => (
          <ScorecardMetric key={item.axis} axis={item.axis} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function ScorecardMetric({ axis, value }: { axis: string; value: number }) {
  const explanation = SCORE_EXPLANATIONS[axis] ?? "Intelligence dimension.";
  const low = value < 70;
  const barColor =
    value >= 80 ? "from-emerald-500 to-teal-500" : value >= 60 ? "from-sky-500 to-indigo-500" : "from-amber-400 to-orange-400";

  return (
    <GlassPanel compact className="h-full">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{axis}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-violet-700">
        <AnimatedNumber value={value} />
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10px] text-slate-500">{explanation}</p>
      {low ? <p className="mt-1 text-[10px] font-medium text-amber-700">Needs missions</p> : null}
    </GlassPanel>
  );
}
