"use client";

import { KnowledgeCompletionProgress } from "@/components/super-admin/ai-training/lesson-review-shared";
import {
  AIBrainHeader,
  ExplainableMetricCard,
  IntelligenceFeed,
  IntelligenceTrendChart,
  MorningBriefCard,
  OperationsSkeleton,
  PredictiveInsightsPanel,
  StorySection,
  WelcomeBanner,
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
  buildPredictiveIntelligence,
  buildWelcomeMessage,
} from "@/lib/ai-training/operations-presentation";
import { formatMissionEta } from "@/lib/ai-training/knowledge-missions";
import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { Rocket, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function KnowledgeOperationsOverview({
  snapshot: externalSnapshot,
  userName,
  onStartMission,
  onNavigateTab,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  userName?: string;
  onStartMission?: (mission: KnowledgeMission) => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(externalSnapshot);

  if (loading) return <OperationsSkeleton rows={4} />;
  if (!snapshot) return null;

  const brain = buildBrainHeader(snapshot);
  const brief = buildMorningBrief(snapshot);
  const feed = buildIntelligenceFeed(snapshot);
  const welcome = buildWelcomeMessage(snapshot, userName);
  const coverage = buildExplainableCoverage(snapshot);
  const confidence = buildExplainableConfidence(snapshot);
  const predictions = buildPredictiveIntelligence(snapshot);

  const totalLessons = snapshot.moduleHealth.reduce((s, m) => s + m.lessonCount, 0);
  const totalTarget = snapshot.moduleHealth.reduce((s, m) => s + m.targetCount, 0);
  const topMission = snapshot.missions[0];

  return (
    <div className="space-y-6">
      <WelcomeBanner message={welcome} />
      <AIBrainHeader data={brain} />
      <MorningBriefCard brief={brief} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <IntelligenceFeed events={feed} />
        </div>
        <PredictiveInsightsPanel insights={predictions} />
      </div>

      <StorySection
        title="Operations narrative"
        what={`Brain health at ${snapshot.health.overallHealth}% with ${snapshot.learningSignals.questionsAsked} questions processed.`}
        why="Continuous learning from usage and reviewer decisions keeps answers accurate and trustworthy."
        next={topMission?.title ?? "Review autonomous suggestions in System Intelligence."}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExplainableMetricCard metric={coverage} />
        <ExplainableMetricCard metric={confidence} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="confidence" label="Confidence" color="#6366f1" />
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="coverage" label="Coverage" color="#10b981" />
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Brain Health" color="#8b5cf6" />
      </div>

      <KnowledgeCompletionProgress
        completed={totalLessons}
        target={totalTarget}
        averageQuality={snapshot.scorecard.knowledgeQuality}
        readyCount={snapshot.learningSignals.successfulAnswers}
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-slate-900">Active Missions</h3>
      <p className="mt-0.5 text-xs text-slate-500">Strategic knowledge-building campaigns</p>
      <ul className="mt-4 space-y-3">
        {missions.slice(0, 3).map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-white p-4 transition-all hover:border-indigo-200 hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{m.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {m.lessonsRemaining} lessons · {formatMissionEta(m.estimatedMinutes)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
                {onStartMission ? (
                  <button
                    type="button"
                    className={cn(saBtnPrimarySm, "mt-3")}
                    onClick={() => onStartMission(m)}
                  >
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
    <div className="rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/40 to-white p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-900">Autonomous Recommendations</h3>
      </div>
      <ul className="mt-4 space-y-2">
        {suggestions.slice(0, 4).map((s) => (
          <li key={s.id} className="rounded-lg border border-violet-100 bg-white/60 px-3 py-2.5">
            <p className="text-sm font-medium text-violet-900">{s.title}</p>
            <p className="text-xs text-violet-700/80">{s.suggestedAction}</p>
          </li>
        ))}
      </ul>
      {onNavigate ? (
        <button type="button" className="mt-3 text-xs font-semibold text-violet-600 hover:text-violet-800" onClick={onNavigate}>
          View System Intelligence →
        </button>
      ) : null}
    </div>
  );
}

export { KnowledgeOperationsOverview as KnowledgeIntelligenceDashboard };
