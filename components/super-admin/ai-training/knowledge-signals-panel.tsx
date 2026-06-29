"use client";

import {
  EmptyStateInsight,
  HeatmapGrid,
  IntelligenceTrendChart,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildModuleHeatmaps, buildPageInsight, buildSignalInsights } from "@/lib/ai-training/operations-presentation";
import { cn } from "@/lib/utils";

export function KnowledgeSignalsPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={2} />;

  const signals = snapshot?.learningSignals;
  if (!signals) return null;

  const insights = buildSignalInsights(snapshot);
  const heatmaps = buildModuleHeatmaps(snapshot);
  const pageInsight = buildPageInsight("signals", snapshot);

  return (
    <div className={OPS_STACK}>
      <PageAIInsight message={pageInsight} context="signals" />

      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4")}>
        <InsightCard label="Most learned" value={insights.mostLearnedTopic} />
        <InsightCard label="Fastest growing" value={insights.fastestGrowingModule} />
        <InsightCard label="Confidence trend" value={insights.highestConfidenceIncrease} tone="healthy" />
        <InsightCard label="Low confidence" value={String(signals.lowConfidenceRetrievals)} tone="attention" />
      </div>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <IntelligenceTrendChart trends={snapshot.trends} dataKey="confidence" label="Confidence" compact />
        <HeatmapGrid title="Usage by module" cells={heatmaps.usage} />
      </div>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <SignalList
          title="Repeated questions"
          items={signals.topRepeatedQuestions.map((q) => ({
            label: q.question,
            meta: `${q.count}×`,
          }))}
        />
        <SignalList
          title="Rising topics"
          items={signals.risingTopics.map((t) => ({
            label: t.topic,
            meta: `${t.count}`,
          }))}
        />
      </div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "healthy" | "attention" | "info";
}) {
  const ring =
    tone === "healthy"
      ? "ring-emerald-200 bg-emerald-50/40"
      : tone === "attention"
        ? "ring-amber-200 bg-amber-50/40"
        : "ring-sky-200 bg-sky-50/40";
  return (
    <div className={cn("rounded-lg border p-2.5 shadow-sm ring-1", ring)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">{value === "—" ? "Monitoring…" : value}</p>
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
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
      <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
      <ul className="mt-2 space-y-1">
        {items.length === 0 ? (
          <EmptyStateInsight kind="signals" />
        ) : (
          items.map((item) => (
            <li
              key={item.label}
              className="flex items-start justify-between gap-2 rounded-md bg-slate-50/80 px-2 py-1.5"
            >
              <span className="text-xs text-slate-700">{item.label}</span>
              <span className="shrink-0 text-[10px] font-semibold text-sky-600">{item.meta}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
