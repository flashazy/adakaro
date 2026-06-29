"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  GlassPanel,
  IntelligenceTrendChart,
  OperationsSkeleton,
  StorySection,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { scorecardToRadarData } from "@/lib/ai-training/knowledge-intelligence-score";

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
  if (loading) return <OperationsSkeleton rows={3} />;

  const scorecard = snapshot?.scorecard;
  if (!scorecard) return null;

  const radar = scorecardToRadarData(scorecard);

  return (
    <div className="space-y-6">
      <GlassPanel gradient="indigo">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">System Intelligence</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-slate-900">
          {scorecard.composite}
          <span className="ml-2 text-lg font-medium text-slate-500">composite</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Enterprise scorecard across 10 intelligence dimensions — each metric explains a facet of organizational AI readiness.
        </p>
      </GlassPanel>

      <StorySection
        title="Intelligence assessment"
        what={`Composite score ${scorecard.composite} with strongest axis at ${Math.max(...radar.map((r) => r.value))}.`}
        why="Balanced intelligence prevents over-indexing on volume without quality or retrieval readiness."
        next="Improve lowest-scoring dimensions through targeted missions."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel>
          <p className="text-sm font-semibold text-slate-900">Intelligence radar</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#64748b" }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        {snapshot ? (
          <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Composite trend proxy" color="#8b5cf6" />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {radar.map((item) => (
          <ScorecardMetric key={item.axis} axis={item.axis} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function ScorecardMetric({ axis, value }: { axis: string; value: number }) {
  const explanation = SCORE_EXPLANATIONS[axis] ?? "Intelligence dimension score.";
  const low = value < 70;

  return (
    <GlassPanel className="h-full">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{axis}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{explanation}</p>
      {low ? (
        <p className="mt-2 text-xs font-medium text-amber-700">Improve through targeted missions</p>
      ) : null}
    </GlassPanel>
  );
}
