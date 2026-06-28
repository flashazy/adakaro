"use client";

import { useEffect, useState } from "react";
import { Loader2, Rocket, Timer } from "lucide-react";
import { saBtnPrimarySm, saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { KnowledgeIntelligenceSnapshot, KnowledgeMission } from "@/lib/ai-training/knowledge-intelligence-types";
import { formatMissionEta } from "@/lib/ai-training/knowledge-missions";
import { cn } from "@/lib/utils";

interface KnowledgeMissionsPanelProps {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  onStartMission?: (mission: KnowledgeMission) => void;
}

export function KnowledgeMissionsPanel({ snapshot: external, onStartMission }: KnowledgeMissionsPanelProps) {
  const [snapshot, setSnapshot] = useState<KnowledgeIntelligenceSnapshot | null>(external ?? null);
  const [loading, setLoading] = useState(!external);

  useEffect(() => {
    if (external) {
      setSnapshot(external);
      return;
    }
    void fetch("/api/super-admin/ai-training/intelligence")
      .then((r) => r.json())
      .then((d: { snapshot?: KnowledgeIntelligenceSnapshot }) => setSnapshot(d.snapshot ?? null))
      .finally(() => setLoading(false));
  }, [external]);

  if (loading) {
    return (
      <div className={cn(saSection, "flex justify-center py-12 text-slate-500")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const missions = snapshot?.missions ?? [];

  return (
    <div className="space-y-4">
      <div className={saSection}>
        <h3 className={saSectionTitle}>Knowledge Missions</h3>
        <p className={saSectionSubtitle}>
          Project milestones — build knowledge strategically instead of generating random batches
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {missions.map((mission) => (
          <div
            key={mission.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Rocket className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{mission.title}</p>
                <p className="mt-1 text-sm text-slate-600">{mission.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Metric label="Lessons" value={String(mission.lessonsRemaining)} />
                  <Metric label="ETA" value={formatMissionEta(mission.estimatedMinutes)} icon={Timer} />
                  {mission.expectedQuality ? (
                    <Metric label="Expected quality" value={`${mission.expectedQuality}%`} />
                  ) : null}
                  {mission.coverageGain ? (
                    <Metric label="Coverage gain" value={`+${mission.coverageGain}%`} />
                  ) : null}
                  {mission.currentConfidence ? (
                    <Metric
                      label="Confidence"
                      value={`${mission.currentConfidence}% → ${mission.targetConfidence}%`}
                    />
                  ) : null}
                  {mission.coverageAfter ? (
                    <Metric label="Coverage after" value={`${mission.coverageAfter}%`} />
                  ) : null}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${mission.progress}%` }}
                  />
                </div>
                {onStartMission ? (
                  <button
                    type="button"
                    className={cn(saBtnPrimarySm, "mt-4")}
                    onClick={() => onStartMission(mission)}
                  >
                    Start Mission
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {missions.length === 0 ? (
        <p className="text-center text-sm text-slate-500">All missions complete — knowledge base is in great shape.</p>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Timer;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="flex items-center gap-1 font-semibold text-slate-800">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {value}
      </p>
    </div>
  );
}
