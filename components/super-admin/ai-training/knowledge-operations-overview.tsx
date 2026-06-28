"use client";

import { useEffect, useState } from "react";
import { Activity, Brain, Loader2, Sparkles, Target, TrendingUp } from "lucide-react";
import {
  SaKpiCard,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { KnowledgeCompletionProgress } from "@/components/super-admin/ai-training/lesson-review-shared";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

export function KnowledgeOperationsOverview({
  snapshot: externalSnapshot,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<KnowledgeIntelligenceSnapshot | null>(
    externalSnapshot ?? null
  );
  const [loading, setLoading] = useState(!externalSnapshot);

  useEffect(() => {
    if (externalSnapshot) {
      setSnapshot(externalSnapshot);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/super-admin/ai-training/intelligence");
        if (!res.ok) return;
        const data = (await res.json()) as { snapshot?: KnowledgeIntelligenceSnapshot };
        setSnapshot(data.snapshot ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [externalSnapshot]);

  if (loading) {
    return (
      <div className={cn(saSection, "flex items-center justify-center py-16 text-slate-500")}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading knowledge intelligence…
      </div>
    );
  }

  if (!snapshot) return null;

  const { health, scorecard, learningSignals, missions, autonomousSuggestions } = snapshot;
  const totalLessons = snapshot.moduleHealth.reduce((s, m) => s + m.lessonCount, 0);
  const totalTarget = snapshot.moduleHealth.reduce((s, m) => s + m.targetCount, 0);

  return (
    <div className="space-y-6">
      <div className={cn(saSection, "border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <Brain className="h-4 w-4" />
              Enterprise Knowledge Operations
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Living Knowledge Dashboard</h2>
            <p className={saSectionSubtitle}>
              Self-improving intelligence — updated {new Date(snapshot.generatedAt).toLocaleString()}
            </p>
          </div>
          <HealthBadge score={health.overallHealth} grade={health.grade} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SaKpiCard label="Knowledge Health" value={`${health.overallHealth}%`} />
          <SaKpiCard label="Coverage" value={`${health.coverage}%`} />
          <SaKpiCard label="AI Confidence" value={`${health.confidence}%`} />
          <SaKpiCard label="Retrievability" value={`${health.retrievability}%`} />
          <SaKpiCard label="Composite Score" value={`${scorecard.composite}`} />
        </div>
      </div>

      <KnowledgeCompletionProgress
        completed={totalLessons}
        target={totalTarget}
        averageQuality={scorecard.knowledgeQuality}
        readyCount={learningSignals.successfulAnswers}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={saSection}>
          <h3 className={saSectionTitle}>Active Missions</h3>
          <p className={saSectionSubtitle}>Intelligent knowledge-building milestones</p>
          <ul className="mt-4 space-y-3">
            {missions.slice(0, 4).map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{m.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                  </div>
                  <Target className="h-4 w-4 shrink-0 text-indigo-500" />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>{m.lessonsRemaining} lessons</span>
                  <span>~{m.estimatedMinutes} min</span>
                  {m.expectedQuality ? <span>Q {m.expectedQuality}%</span> : null}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={saSection}>
          <h3 className={saSectionTitle}>Autonomous Suggestions</h3>
          <p className={saSectionSubtitle}>Proactive recommendations from the intelligence engine</p>
          <ul className="mt-4 space-y-2">
            {autonomousSuggestions.slice(0, 5).map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-violet-900">{s.title}</p>
                <p className="text-xs text-violet-700/80">{s.suggestedAction}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <InsightList
          title="Top Missing Topics"
          icon={Sparkles}
          items={snapshot.topMissingTopics.map((t) => `${t.topic} (${t.count} lessons)`)}
        />
        <InsightList
          title="Top Unanswered Questions"
          icon={Activity}
          items={snapshot.topUnansweredQuestions.map((q) => `${q.question} (${q.occurrences}×)`)}
        />
        <InsightList
          title="Weakest Modules"
          icon={TrendingUp}
          items={snapshot.weakestModules.map((m) => `${m.moduleName} — ${m.health}% health`)}
        />
      </div>
    </div>
  );
}

function HealthBadge({ score, grade }: { score: number; grade: string }) {
  const tone =
    score >= 85 ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : score >= 70 ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-red-100 text-red-800 ring-red-200";
  return (
    <span className={cn("rounded-full px-4 py-2 text-sm font-bold uppercase ring-1 ring-inset", tone)}>
      {grade} · {score}%
    </span>
  );
}

function InsightList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Sparkles;
  items: string[];
}) {
  return (
    <div className={cn(saSection, "bg-white")}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-indigo-500" />
        {title}
      </h4>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {items.length ? items.map((item) => <li key={item}>• {item}</li>) : <li className="text-slate-400">None</li>}
      </ul>
    </div>
  );
}

export { KnowledgeOperationsOverview as KnowledgeIntelligenceDashboard };
