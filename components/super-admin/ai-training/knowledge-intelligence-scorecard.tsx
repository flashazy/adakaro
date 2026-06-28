"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { IntelligenceScorecard, KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { scorecardToRadarData } from "@/lib/ai-training/knowledge-intelligence-score";
import { cn } from "@/lib/utils";

export function KnowledgeIntelligenceScorecardPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const [scorecard, setScorecard] = useState<IntelligenceScorecard | null>(
    external?.scorecard ?? null
  );
  const [loading, setLoading] = useState(!external);

  useEffect(() => {
    if (external?.scorecard) {
      setScorecard(external.scorecard);
      return;
    }
    void fetch("/api/super-admin/ai-training/intelligence")
      .then((r) => r.json())
      .then((d: { snapshot?: KnowledgeIntelligenceSnapshot }) =>
        setScorecard(d.snapshot?.scorecard ?? null)
      )
      .finally(() => setLoading(false));
  }, [external]);

  if (loading) {
    return (
      <div className={cn(saSection, "flex justify-center py-12")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!scorecard) return null;

  const radar = scorecardToRadarData(scorecard);

  return (
    <div className="space-y-6">
      <div className={saSection}>
        <h3 className={saSectionTitle}>System Intelligence Scorecard</h3>
        <p className={saSectionSubtitle}>
          Enterprise knowledge metrics — composite score {scorecard.composite}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {radar.map((item) => (
          <div key={item.axis} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{item.axis}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">{item.value}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={cn(saSection, "grid gap-4 lg:grid-cols-2")}>
        <ScoreRow label="Knowledge Quality" value={scorecard.knowledgeQuality} />
        <ScoreRow label="Reviewer Confidence" value={scorecard.reviewerConfidence} />
        <ScoreRow label="Knowledge Strength" value={scorecard.knowledgeStrength} />
        <ScoreRow label="Coverage Contribution" value={scorecard.coverageContribution} />
        <ScoreRow label="Retrieval Readiness" value={scorecard.retrievalReadiness} />
        <ScoreRow label="Freshness" value={scorecard.freshness} />
        <ScoreRow label="Dependency Health" value={scorecard.dependencyHealth} />
        <ScoreRow label="Keyword Richness" value={scorecard.keywordRichness} />
        <ScoreRow label="AI Reliability" value={scorecard.aiReliability} />
        <ScoreRow label="Learning Value" value={scorecard.learningValue} />
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-lg font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}
