"use client";

import { KnowledgeCompletionProgress } from "@/components/super-admin/ai-training/lesson-review-shared";
import {
  AIBrainHeader,
  CompactBriefRow,
  ExplainableMetricCard,
  IntelligenceFeed,
  IntelligenceTrendChart,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
  PredictiveInsightsPanel,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import { ConversationReplayPanel } from "@/components/super-admin/ai-training/operations/conversation-replay-panel";
import type { KnowledgeIntelligenceSnapshot, KnowledgeMission } from "@/lib/ai-training/knowledge-intelligence-types";
import {
  buildBrainHeader,
  buildExplainableConfidence,
  buildExplainableCoverage,
  buildIntelligenceFeed,
  buildMorningBrief,
  buildPageInsight,
  buildPredictiveIntelligence,
} from "@/lib/ai-training/operations-presentation";
import { formatMissionEta } from "@/lib/ai-training/knowledge-missions";
import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { Rocket, Target } from "lucide-react";
import { CurriculumPlannerMetrics } from "@/components/super-admin/ai-training/curriculum-planner-panel";
import { cn } from "@/lib/utils";

export function KnowledgeOperationsOverview({
  snapshot: externalSnapshot,
  onStartMission,
  onNavigateTab,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  userName?: string;
  onStartMission?: (mission: KnowledgeMission) => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(externalSnapshot);

  if (loading) return <OperationsSkeleton rows={3} />;
  if (!snapshot) return null;

  const brain = buildBrainHeader(snapshot);
  const brief = buildMorningBrief(snapshot);
  const feed = buildIntelligenceFeed(snapshot);
  const insight = buildPageInsight("overview", snapshot);
  const coverage = buildExplainableCoverage(snapshot);
  const confidence = buildExplainableConfidence(snapshot);
  const predictions = buildPredictiveIntelligence(snapshot);

  const totalLessons = snapshot.moduleHealth.reduce((s, m) => s + m.lessonCount, 0);
  const totalTarget = snapshot.moduleHealth.reduce((s, m) => s + m.targetCount, 0);

  return (
    <div className={OPS_STACK}>
      <PageAIInsight message={insight} context="overview" />
      <AIBrainHeader data={brain} coveragePercent={snapshot.health.coverage} />
      <CompactBriefRow
        generated={brief.generated}
        approved={brief.approved}
        confidenceDelta={brief.confidenceDelta}
        coverageDelta={brief.coverageDelta}
      />

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-3")}>
        <div className="lg:col-span-2">
          <IntelligenceFeed events={feed} />
        </div>
        <PredictiveInsightsPanel insights={predictions} />
      </div>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <ExplainableMetricCard metric={coverage} />
        <ExplainableMetricCard metric={confidence} />
      </div>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-3")}>
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="confidence" label="Confidence" color="#6366f1" compact />
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="coverage" label="Coverage" color="#10b981" compact />
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Brain Health" color="#7c3aed" compact />
      </div>

      <KnowledgeCompletionProgress
        completed={totalLessons}
        target={totalTarget}
        averageQuality={snapshot.scorecard.knowledgeQuality}
        readyCount={snapshot.learningSignals.successfulAnswers}
      />

      {snapshot.planner ? <CurriculumPlannerMetrics analytics={snapshot.planner.analytics} /> : null}

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <MissionPreview missions={snapshot.missions} onStartMission={onStartMission} />
        <SuggestionsPreview
          suggestions={snapshot.autonomousSuggestions}
          onNavigate={() => onNavigateTab?.("intelligence")}
        />
      </div>

      <ConversationReplayPanel />
    </div>
  );
}

function MissionPreview({
  missions,
  onStartMission,
}: {
  missions: KnowledgeIntelligenceSnapshot["missions"];
  onStartMission?: (mission: KnowledgeMission) => void;
}) {
  if (missions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-center text-xs text-slate-500">
        All strategic missions are complete.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-violet-100/80 bg-white/80 p-3 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-900">Active Missions</h3>
      <ul className="mt-2 space-y-2">
        {missions.slice(0, 3).map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-violet-100 bg-violet-50/30 px-3 py-2 transition-all duration-200 hover:border-violet-200 hover:shadow-sm"
          >
            <div className="flex items-start gap-2">
              <Rocket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">{m.title}</p>
                <p className="text-[10px] text-slate-500">
                  {m.lessonsRemaining} lessons · {formatMissionEta(m.estimatedMinutes)}
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
                {onStartMission ? (
                  <button type="button" className={cn(saBtnPrimarySm, "mt-2 !py-1 !text-xs")} onClick={() => onStartMission(m)}>
                    Start Mission
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionsPreview({
  suggestions,
  onNavigate,
}: {
  suggestions: KnowledgeIntelligenceSnapshot["autonomousSuggestions"];
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-100/80 bg-amber-50/20 p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5 text-amber-600" />
        <h3 className="text-xs font-semibold text-slate-900">Autonomous Recommendations</h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s.id} className="rounded-md border border-amber-100/80 bg-white/70 px-2.5 py-2">
            <p className="text-xs font-medium text-slate-900">{s.title}</p>
            <p className="text-[10px] text-amber-800/80">{s.suggestedAction}</p>
          </li>
        ))}
      </ul>
      {onNavigate ? (
        <button type="button" className="mt-2 text-[10px] font-semibold text-violet-600 hover:text-violet-800" onClick={onNavigate}>
          System Intelligence →
        </button>
      ) : null}
    </div>
  );
}

export { KnowledgeOperationsOverview as KnowledgeIntelligenceDashboard };
