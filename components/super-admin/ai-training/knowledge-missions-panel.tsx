"use client";

import { Rocket, Timer, TrendingUp } from "lucide-react";
import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { MasteryRing, OperationsSkeleton, StorySection } from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot, KnowledgeMission } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildMissionIntelligence } from "@/lib/ai-training/operations-presentation";
import { formatMissionEta } from "@/lib/ai-training/knowledge-missions";
import { cn } from "@/lib/utils";

interface KnowledgeMissionsPanelProps {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  onStartMission?: (mission: KnowledgeMission) => void;
}

export function KnowledgeMissionsPanel({ snapshot: external, onStartMission }: KnowledgeMissionsPanelProps) {
  const { snapshot, loading } = useIntelligenceSnapshot(external);
  if (loading) return <OperationsSkeleton rows={2} />;
  const missions = snapshot?.missions ?? [];

  return (
    <div className="space-y-6">
      <StorySection
        title="Mission strategy"
        what={`${missions.length} active campaigns targeting knowledge gaps and module completion.`}
        why="Missions convert raw generation into strategic milestones with measurable impact."
        next={missions[0]?.title ?? "All missions complete — maintain quality."}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {missions.map((mission) => (
          <MissionCampaignCard
            key={mission.id}
            mission={mission}
            snapshot={snapshot}
            onStartMission={onStartMission}
          />
        ))}
      </div>

      {missions.length === 0 ? (
        <p className="text-center text-sm text-slate-500">All missions complete — knowledge base is in excellent shape.</p>
      ) : null}
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
      ? "bg-red-100 text-red-800"
      : mission.priority === "high"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="relative flex shrink-0 flex-col items-center">
          <MasteryRing percent={mission.progress} size={56} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-700">
            {mission.progress}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Rocket className="h-4 w-4 text-indigo-600" />
            <p className="font-bold text-slate-900">{mission.title}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", priorityTone)}>
              {mission.priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{mission.description}</p>
          {intel ? (
            <>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{intel.narrative}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <IntelMetric label="Business impact" value={intel.businessImpact} />
                <IntelMetric label="Learning gain" value={intel.learningGain} />
                <IntelMetric label="Coverage" value={intel.coverageImprovement} icon={TrendingUp} />
                <IntelMetric label="Confidence" value={intel.confidenceImprovement} />
                <IntelMetric label="Score gain" value={intel.scoreGain} />
                <IntelMetric label="Completion" value={intel.completionPrediction} icon={Timer} />
              </div>

              {intel.dependencies.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700">Dependencies: {intel.dependencies.join(", ")}</p>
              ) : null}

              <p className="mt-2 text-xs text-indigo-600">
                Next recommended: {intel.recommendedNext}
              </p>
            </>
          ) : null}

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
              style={{ width: `${mission.progress}%` }}
            />
          </div>

          {onStartMission ? (
            <button type="button" className={cn(saBtnPrimarySm, "mt-4")} onClick={() => onStartMission(mission)}>
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
    <div className="rounded-lg bg-slate-50/80 px-2.5 py-2">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-medium text-slate-800">
        {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
        <span className="line-clamp-2">{value}</span>
      </p>
    </div>
  );
}
