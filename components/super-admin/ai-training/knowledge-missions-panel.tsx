"use client";

import { Rocket, Timer, TrendingUp } from "lucide-react";
import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import {
  EmptyStateInsight,
  MasteryRing,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot, KnowledgeMission } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildMissionIntelligence, buildPageInsight } from "@/lib/ai-training/operations-presentation";
import { cn } from "@/lib/utils";

interface KnowledgeMissionsPanelProps {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  onStartMission?: (mission: KnowledgeMission) => void;
}

export function KnowledgeMissionsPanel({ snapshot: external, onStartMission }: KnowledgeMissionsPanelProps) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={2} />;
  const missions = snapshot?.missions ?? [];
  const insight = snapshot ? buildPageInsight("missions", snapshot) : "";

  return (
    <div className={OPS_STACK}>
      {insight ? <PageAIInsight message={insight} context="missions" /> : null}

      {missions.length === 0 ? (
        <EmptyStateInsight kind="missions" />
      ) : (
        <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
          {missions.map((mission) => (
            <MissionCampaignCard
              key={mission.id}
              mission={mission}
              snapshot={snapshot}
              onStartMission={onStartMission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MissionCampaignCard({
  mission,
  snapshot,
  onStartMission,
}: {
  mission: KnowledgeMission;
  snapshot: KnowledgeIntelligenceSnapshot | null;
  onStartMission?: (mission: KnowledgeMission) => void;
}) {
  const intel = snapshot ? buildMissionIntelligence(mission, snapshot) : null;
  const priorityTone =
    mission.priority === "critical"
      ? "bg-red-100 text-red-800 ring-red-200"
      : mission.priority === "high"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <MasteryRing percent={mission.progress} size={48} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-violet-700">
            {mission.progress}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5 text-violet-600" />
            <p className="text-sm font-bold text-slate-900">{mission.title}</p>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1", priorityTone)}>
              {mission.priority}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">{mission.description}</p>
          {intel ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                <IntelMetric label="Impact" value={intel.businessImpact} />
                <IntelMetric label="Coverage" value={intel.coverageImprovement} icon={TrendingUp} />
                <IntelMetric label="Confidence" value={intel.confidenceImprovement} />
                <IntelMetric label="ETA" value={intel.completionPrediction} icon={Timer} />
              </div>
              <p className="mt-1.5 text-[10px] text-violet-600">Next: {intel.recommendedNext}</p>
            </>
          ) : null}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${mission.progress}%` }}
            />
          </div>
          {onStartMission ? (
            <button type="button" className={cn(saBtnPrimarySm, "mt-2 !py-1 !text-xs")} onClick={() => onStartMission(mission)}>
              Start Mission
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IntelMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Timer;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100">
      <p className="uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-medium text-slate-800">
        {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
        <span className="line-clamp-2">{value}</span>
      </p>
    </div>
  );
}
