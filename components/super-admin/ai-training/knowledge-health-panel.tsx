"use client";

import {
  BrainHealthDiagnosisPanel,
  ExplainableMetricCard,
  HeatmapGrid,
  IntelligenceTrendChart,
  OperationsSkeleton,
  StorySection,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import {
  buildBrainHealthDiagnosis,
  buildExplainableConfidence,
  buildExplainableCoverage,
  buildModuleHeatmaps,
} from "@/lib/ai-training/operations-presentation";
import { cn } from "@/lib/utils";

export function KnowledgeHealthPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={3} />;
  if (!snapshot?.health) return null;

  const diagnosis = buildBrainHealthDiagnosis(snapshot);
  const coverage = buildExplainableCoverage(snapshot);
  const confidence = buildExplainableConfidence(snapshot);
  const heatmaps = buildModuleHeatmaps(snapshot);

  return (
    <div className="space-y-6">
      <BrainHealthDiagnosisPanel diagnosis={diagnosis} />

      <StorySection
        title="Health diagnosis summary"
        what={`Overall brain health is ${snapshot.health.overallHealth}% (${snapshot.health.grade}).`}
        why="Healthy knowledge ensures users receive accurate, retrievable answers across all modules."
        next={diagnosis.recommendedAction}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExplainableMetricCard metric={coverage} />
        <ExplainableMetricCard metric={confidence} />
      </div>

      <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Brain Health" color="#10b981" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HeatmapGrid title="Coverage heatmap" cells={heatmaps.coverage} />
        <HeatmapGrid title="Confidence heatmap" cells={heatmaps.confidence} />
        <HeatmapGrid title="Duplicate risk heatmap" cells={heatmaps.duplicate} invert />
        <HeatmapGrid title="Quality heatmap" cells={heatmaps.quality} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h4 className="text-sm font-semibold text-slate-900">Module health matrix</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="px-5 py-3">Module</th>
                <th className="py-3 pr-4">Health</th>
                <th className="py-3 pr-4">Coverage</th>
                <th className="py-3 pr-4">Lessons</th>
                <th className="py-3 pr-4">Dup risk</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.moduleHealth.map((mod) => (
                <tr key={mod.moduleId} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium">{mod.moduleName}</td>
                  <td className="py-3 pr-4">
                    <HealthBar value={mod.health} />
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{mod.coverage}%</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {mod.lessonCount}/{mod.targetCount}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{mod.duplicateRisk}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
