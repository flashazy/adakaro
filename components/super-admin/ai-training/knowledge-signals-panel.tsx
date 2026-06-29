"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  GlassPanel,
  HeatmapGrid,
  IntelligenceTrendChart,
  OperationsSkeleton,
  StorySection,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildModuleHeatmaps, buildSignalInsights } from "@/lib/ai-training/operations-presentation";

export function KnowledgeSignalsPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={3} />;

  const signals = snapshot?.learningSignals;
  if (!signals) return null;

  const insights = buildSignalInsights(snapshot);
  const heatmaps = buildModuleHeatmaps(snapshot);

  return (
    <div className="space-y-6">
      <GlassPanel gradient="indigo">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Learning Signals Intelligence</h3>
        </div>
        <p className="mt-2 text-sm text-slate-600">{insights.narrative}</p>
      </GlassPanel>

      <StorySection
        title="Signal analysis"
        what={`${signals.questionsAsked} questions processed with ${signals.successfulAnswers} confident answers.`}
        why="Learning signals reveal what users need and where knowledge must improve."
        next={
          insights.mostRequestedQuestion !== "—"
            ? `Address: "${insights.mostRequestedQuestion.slice(0, 60)}…"`
            : "Monitor rising topics for curriculum expansion."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard label="Most learned topic" value={insights.mostLearnedTopic} />
        <InsightCard label="Most improved module" value={insights.mostImprovedModule} />
        <InsightCard label="Fastest growing module" value={insights.fastestGrowingModule} />
        <InsightCard label="Confidence trend" value={insights.highestConfidenceIncrease} />
        <InsightCard label="Most requested question" value={truncate(insights.mostRequestedQuestion, 48)} wide />
        <InsightCard label="Highest duplicate rate" value={insights.highestDuplicateRate} />
        <InsightCard label="Reviewer approvals" value={String(signals.approvals)} />
        <InsightCard label="Low confidence events" value={String(signals.lowConfidenceRetrievals)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="confidence" label="Confidence trend" />
        <HeatmapGrid title="Question frequency by module (usage proxy)" cells={heatmaps.usage} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SignalList
          title="Top repeated questions"
          items={signals.topRepeatedQuestions.map((q) => ({
            label: q.question,
            meta: `${q.count}× asked`,
          }))}
        />
        <SignalList
          title="Rising topics"
          items={signals.risingTopics.map((t) => ({
            label: t.topic,
            meta: `${t.count} signals`,
          }))}
        />
      </div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm ${wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SignalList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; meta: string }>;
}) {
  return (
    <GlassPanel>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-slate-400">No signals yet</li>
        ) : (
          items.map((item) => (
            <li
              key={item.label}
              className="flex items-start justify-between gap-2 rounded-lg bg-slate-50/80 px-3 py-2"
            >
              <span className="text-sm text-slate-700">{item.label}</span>
              <span className="shrink-0 text-xs font-semibold text-indigo-600">{item.meta}</span>
            </li>
          ))
        )}
      </ul>
    </GlassPanel>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
