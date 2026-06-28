"use client";

import { useEffect, useState } from "react";
import { HeartPulse, Loader2 } from "lucide-react";
import { SaKpiCard, saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

export function KnowledgeHealthPanel({ snapshot: external }: { snapshot?: KnowledgeIntelligenceSnapshot | null }) {
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
      <div className={cn(saSection, "flex justify-center py-12")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const health = snapshot?.health;
  if (!health) return null;

  return (
    <div className="space-y-6">
      <div className={cn(saSection, "border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white")}>
        <div className="flex items-center gap-3">
          <HeartPulse className="h-8 w-8 text-emerald-600" />
          <div>
            <h3 className={saSectionTitle}>Knowledge Health Engine</h3>
            <p className={saSectionSubtitle}>Continuous monitoring of coverage, freshness, and retrievability</p>
          </div>
        </div>
        <p className="mt-4 text-3xl font-bold text-slate-900">
          {health.overallHealth}%
          <span className="ml-2 text-sm font-medium capitalize text-slate-500">{health.grade}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SaKpiCard label="Coverage" value={`${health.coverage}%`} />
        <SaKpiCard label="Freshness" value={`${health.freshness}%`} />
        <SaKpiCard label="Confidence" value={`${health.confidence}%`} />
        <SaKpiCard label="Retrievability" value={`${health.retrievability}%`} />
        <SaKpiCard label="Knowledge Density" value={`${health.knowledgeDensity}%`} />
        <SaKpiCard label="Duplicate Risk" value={`${health.duplicateRisk}%`} />
        <SaKpiCard label="Orphan Lessons" value={String(health.orphanCount)} />
        <SaKpiCard label="Outdated" value={String(health.outdatedCount)} />
      </div>

      <div className={cn(saSection, "overflow-x-auto")}>
        <h4 className="text-sm font-semibold text-slate-900">Module health</h4>
        <table className="mt-3 min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Module</th>
              <th className="py-2 pr-4">Health</th>
              <th className="py-2 pr-4">Coverage</th>
              <th className="py-2 pr-4">Lessons</th>
              <th className="py-2">Dup risk</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot?.moduleHealth ?? []).map((mod) => (
              <tr key={mod.moduleId} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium">{mod.moduleName}</td>
                <td className="py-2 pr-4">
                  <HealthBar value={mod.health} />
                </td>
                <td className="py-2 pr-4 tabular-nums">{mod.coverage}%</td>
                <td className="py-2 pr-4 tabular-nums">
                  {mod.lessonCount}/{mod.targetCount}
                </td>
                <td className="py-2 tabular-nums">{mod.duplicateRisk}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
