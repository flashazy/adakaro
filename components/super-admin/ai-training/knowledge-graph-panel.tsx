"use client";

import { useEffect, useState } from "react";
import { InteractiveKnowledgeGraph } from "@/components/super-admin/ai-training/operations/interactive-knowledge-graph";
import {
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeGraphData, KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildPageInsight } from "@/lib/ai-training/operations-presentation";

interface KnowledgeGraphPanelProps {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
  onOpenEntry?: (entryId: string) => void;
}

export function KnowledgeGraphPanel({ snapshot: external, onOpenEntry }: KnowledgeGraphPanelProps) {
  const { snapshot } = useIntelligenceSnapshot(external);
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/super-admin/ai-training/intelligence/graph")
      .then((r) => r.json())
      .then((d: { graph?: KnowledgeGraphData }) => setGraph(d.graph ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <OperationsSkeleton rows={2} />;

  const insight = snapshot ? buildPageInsight("graph", snapshot) : "";

  return (
    <div className={OPS_STACK}>
      {insight ? <PageAIInsight message={insight} context="graph" /> : null}
      <InteractiveKnowledgeGraph graph={graph} loading={false} onOpenEntry={onOpenEntry} />
    </div>
  );
}
