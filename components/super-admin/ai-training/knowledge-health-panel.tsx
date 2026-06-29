"use client";

import {
  BrainHealthDiagnosisPanel,
  ExplainableMetricCard,
  HeatmapGrid,
  IntelligenceTrendChart,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import {
  buildBrainHealthDiagnosis,
  buildExplainableConfidence,
  buildExplainableCoverage,
  buildModuleHeatmaps,
  buildPageInsight,
} from "@/lib/ai-training/operations-presentation";
import { CurriculumPlannerPanel } from "@/components/super-admin/ai-training/curriculum-planner-panel";
import { cn } from "@/lib/utils";

export function KnowledgeHealthPanel({
  snapshot: external,
  onSelectEntry,
  onCreateLesson,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  onSelectEntry?: (entryId: string) => void;
  onCreateLesson?: (question: string, category?: string) => void;
}) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={2} />;
  if (!snapshot?.health) return null;

  const diagnosis = buildBrainHealthDiagnosis(snapshot);
  const coverage = buildExplainableCoverage(snapshot);
  const confidence = buildExplainableConfidence(snapshot);
  const heatmaps = buildModuleHeatmaps(snapshot);
  const insight = buildPageInsight("health", snapshot);

  return (
    <div className={OPS_STACK}>
      <PageAIInsight message={insight} context="health" />
      <BrainHealthDiagnosisPanel diagnosis={diagnosis} />

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <ExplainableMetricCard metric={coverage} />
        <ExplainableMetricCard metric={confidence} />
      </div>

      <IntelligenceTrendChart trends={snapshot.trends} dataKey="health" label="Brain Health" color="#10b981" compact />

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <HeatmapGrid title="Coverage" cells={heatmaps.coverage} />
        <HeatmapGrid title="Confidence" cells={heatmaps.confidence} />
        <HeatmapGrid title="Duplicate risk" cells={heatmaps.duplicate} invert />
        <HeatmapGrid title="Quality" cells={heatmaps.quality} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2">
          <h4 className="text-xs font-semibold text-slate-900">Module health</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-left uppercase text-slate-500">
                <th className="px-3 py-2">Module</th>
                <th className="py-2 pr-3">Health</th>
                <th className="py-2 pr-3">Coverage</th>
                <th className="py-2 pr-3">Lessons</th>
                <th className="py-2">Dup</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.moduleHealth.map((mod) => (
                <tr key={mod.moduleId} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-medium">{mod.moduleName}</td>
                  <td className="py-2 pr-3">
                    <HealthBar value={mod.health} />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{mod.coverage}%</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {mod.lessonCount}/{mod.targetCount}
                  </td>
                  <td className="py-2 tabular-nums">{mod.duplicateRisk}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {snapshot.planner ? (
        <CurriculumPlannerPanel
          planner={snapshot.planner}
          onSelectEntry={onSelectEntry}
          onCreateLesson={onCreateLesson}
        />
      ) : null}
    </div>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
