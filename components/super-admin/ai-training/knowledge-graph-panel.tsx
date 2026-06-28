"use client";

import { useEffect, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { KnowledgeGraphData } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

export function KnowledgeGraphPanel() {
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/super-admin/ai-training/intelligence/graph")
      .then((r) => r.json())
      .then((d: { graph?: KnowledgeGraphData }) => setGraph(d.graph ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn(saSection, "flex justify-center py-12")}>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!graph) return null;

  return (
    <div className="space-y-6">
      <div className={saSection}>
        <h3 className={saSectionTitle}>Knowledge Graph</h3>
        <p className={saSectionSubtitle}>
          {graph.nodes.length} lessons · {graph.edges.length} connections · visual curriculum paths
        </p>
      </div>

      {graph.paths.length > 0 ? (
        <div className="space-y-4">
          {graph.paths.map((path) => (
            <div key={path.label} className={cn(saSection, "overflow-x-auto")}>
              <p className="mb-3 text-sm font-semibold capitalize text-indigo-700">{path.label}</p>
              <div className="flex min-w-max items-center gap-2">
                {path.nodeIds.map((nodeId, idx) => {
                  const node = graph.nodes.find((n) => n.id === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center gap-2">
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900">
                        {node?.label ?? nodeId}
                      </div>
                      {idx < path.nodeIds.length - 1 ? (
                        <GitBranch className="h-4 w-4 rotate-90 text-slate-300" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={cn(saSection, "max-h-96 overflow-y-auto")}>
        <h4 className="text-sm font-semibold text-slate-900">Lesson connections</h4>
        <ul className="mt-3 space-y-2 text-sm">
          {graph.edges.slice(0, 40).map((edge) => {
            const source = graph.nodes.find((n) => n.id === edge.source);
            const target = graph.nodes.find((n) => n.id === edge.target);
            return (
              <li key={edge.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{source?.label ?? edge.source}</span>
                <span className="mx-2 text-indigo-500">→ {edge.relation.replace(/_/g, " ")} →</span>
                <span className="font-medium text-slate-800">{target?.label ?? edge.target}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
