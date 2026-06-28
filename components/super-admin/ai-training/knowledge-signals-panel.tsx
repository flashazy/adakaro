"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { SaKpiCard, saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

export function KnowledgeSignalsPanel({ snapshot: external }: { snapshot?: KnowledgeIntelligenceSnapshot | null }) {
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

  const signals = snapshot?.learningSignals;
  if (!signals) return null;

  return (
    <div className="space-y-6">
      <div className={saSection}>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          <h3 className={saSectionTitle}>Learning Signals</h3>
        </div>
        <p className={saSectionSubtitle}>How users and reviewers teach the system every week</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SaKpiCard label="Questions Asked" value={String(signals.questionsAsked)} />
        <SaKpiCard label="Successful Answers" value={String(signals.successfulAnswers)} />
        <SaKpiCard label="Low Confidence" value={String(signals.lowConfidenceRetrievals)} />
        <SaKpiCard label="Reviewer Edits" value={String(signals.reviewerEdits)} />
        <SaKpiCard label="Approvals" value={String(signals.approvals)} />
        <SaKpiCard label="Regenerations" value={String(signals.regenerations)} />
        <SaKpiCard label="Rejections" value={String(signals.rejections)} />
        <SaKpiCard label="Abandoned" value={String(signals.questionsAbandoned)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SignalList
          title="Top repeated questions"
          items={signals.topRepeatedQuestions.map((q) => `${q.question} (${q.count}×)`)}
        />
        <SignalList
          title="Rising topics"
          items={signals.risingTopics.map((t) => `${t.topic} (${t.count})`)}
        />
      </div>
    </div>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn(saSection, "bg-white")}>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {items.length ? items.map((i) => <li key={i}>• {i}</li>) : <li className="text-slate-400">No signals yet</li>}
      </ul>
    </div>
  );
}
