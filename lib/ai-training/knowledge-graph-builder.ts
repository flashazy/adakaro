/**
 * Knowledge Graph Builder — visual graph from entries and intents (Phase 4).
 */

import { getIntentDefinition } from "./intent-registry";
import { resolveEntryIntent } from "./intent-registry";
import { getGraphNeighbors } from "./knowledge-graph";
import type {
  KnowledgeGraphData,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./knowledge-intelligence-types";
import { computeKnowledgeStrength } from "./knowledge-strength";
import type { AIKnowledgeEntry } from "./types";

const MODULE_PREREQUISITE_CHAINS: Record<string, string[]> = {
  "about-adakaro": ["What is Adakaro?", "What can Adakaro do?", "Who uses Adakaro?"],
  pricing: ["How much does Adakaro cost?", "Is there a free plan?", "When does billing start?"],
  finance: ["How does school finance work?", "Can I issue fee receipts?", "How are fee balances calculated?"],
  "parent-portal": ["What can parents see?", "How do parents access Adakaro?"],
};

export function buildKnowledgeGraph(entries: AIKnowledgeEntry[]): KnowledgeGraphData {
  const active = entries.filter((e) => e.status === "active" && !e.merged_into_id);
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const entry of active) {
    const intent = resolveEntryIntent(entry);
    const strength = computeKnowledgeStrength(entry);
    nodes.push({
      id: `entry:${entry.id}`,
      type: "lesson",
      label: entry.question.length > 48 ? `${entry.question.slice(0, 45)}…` : entry.question,
      moduleId: entry.curriculum_module ?? undefined,
      strength,
      entryId: entry.id,
    });

    if (intent.intent_key) {
      const def = getIntentDefinition(intent.intent_key);
      for (const related of def?.relatedIntents ?? []) {
        addEdge(edges, seenEdges, `entry:${entry.id}`, `intent:${related}`, "related", "Related intent");
      }
      for (const related of intent.related_intents ?? []) {
        addEdge(edges, seenEdges, `entry:${entry.id}`, `intent:${related}`, "references", "References");
      }
    }
  }

  for (const entry of active) {
    const intent = resolveEntryIntent(entry);
    if (!intent.intent_key) continue;
    const neighbors = getGraphNeighbors(intent.intent_key, active);
    for (const neighbor of neighbors) {
      if (neighbor.id === entry.id) continue;
      addEdge(
        edges,
        seenEdges,
        `entry:${entry.id}`,
        `entry:${neighbor.id}`,
        "related",
        "Same intent group"
      );
    }
  }

  const paths = buildCurriculumPaths(active);

  return { nodes, edges, paths };
}

function addEdge(
  edges: KnowledgeGraphEdge[],
  seen: Set<string>,
  source: string,
  target: string,
  relation: KnowledgeGraphEdge["relation"],
  label?: string
): void {
  const key = `${source}|${target}|${relation}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ id: key, source, target, relation, label });
}

function buildCurriculumPaths(entries: AIKnowledgeEntry[]): KnowledgeGraphData["paths"] {
  const paths: KnowledgeGraphData["paths"] = [];

  for (const [moduleId, questions] of Object.entries(MODULE_PREREQUISITE_CHAINS)) {
    const nodeIds: string[] = [];
    for (const q of questions) {
      const match = entries.find(
        (e) =>
          e.curriculum_module === moduleId &&
          e.question.toLowerCase().includes(q.toLowerCase().slice(0, 20))
      );
      if (match) nodeIds.push(`entry:${match.id}`);
    }
    if (nodeIds.length >= 2) {
      paths.push({
        label: moduleId.replace(/-/g, " "),
        nodeIds,
      });
    }
  }

  return paths.slice(0, 8);
}

export function getGraphNeighborsForEntry(
  entry: AIKnowledgeEntry,
  entries: AIKnowledgeEntry[]
): AIKnowledgeEntry[] {
  const intent = resolveEntryIntent(entry);
  if (!intent.intent_key) return [];
  return getGraphNeighbors(intent.intent_key, entries).filter((e) => e.id !== entry.id);
}

export function summarizeGraph(graph: KnowledgeGraphData): {
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
} {
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  const lessonNodes = graph.nodes.filter((n) => n.type === "lesson");
  const orphanCount = lessonNodes.filter((n) => !connected.has(n.id)).length;
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    orphanCount,
  };
}
