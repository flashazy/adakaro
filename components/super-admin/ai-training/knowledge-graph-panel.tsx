"use client";

import { useEffect, useState } from "react";
import { InteractiveKnowledgeGraph } from "@/components/super-admin/ai-training/operations/interactive-knowledge-graph";
import type { KnowledgeGraphData } from "@/lib/ai-training/knowledge-intelligence-types";

interface KnowledgeGraphPanelProps {
  onOpenEntry?: (entryId: string) => void;
}

export function KnowledgeGraphPanel({ onOpenEntry }: KnowledgeGraphPanelProps) {
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/super-admin/ai-training/intelligence/graph")
      .then((r) => r.json())
      .then((d: { graph?: KnowledgeGraphData }) => setGraph(d.graph ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <InteractiveKnowledgeGraph graph={graph} loading={loading} onOpenEntry={onOpenEntry} />
  );
}
