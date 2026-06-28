/**
 * Knowledge Evolution — version history timeline (Phase 10).
 */

import type { KnowledgeEvolutionEvent, EvolutionEventType } from "./knowledge-intelligence-types";
import type { KnowledgeVersionRow } from "./knowledge-versioning";
import type { AIKnowledgeEntry } from "./types";

export function buildEvolutionTimeline(
  entry: AIKnowledgeEntry,
  versions: KnowledgeVersionRow[] = []
): KnowledgeEvolutionEvent[] {
  const events: KnowledgeEvolutionEvent[] = [];

  events.push({
    id: `ev-created-${entry.id}`,
    entryId: entry.id,
    type: "created",
    label: "Created",
    timestamp: entry.created_at,
    versionNumber: 1,
    summary: entry.question,
  });

  if (entry.created_at !== entry.updated_at) {
    events.push({
      id: `ev-modified-${entry.id}`,
      entryId: entry.id,
      type: "modified",
      label: "Modified",
      timestamp: entry.updated_at,
      versionNumber: entry.version_number ?? 1,
    });
  }

  for (const version of versions) {
    const type: EvolutionEventType =
      version.version_number > (entry.version_number ?? 1) ? "improved" : "modified";
    events.push({
      id: `ev-version-${version.id}`,
      entryId: entry.id,
      type,
      label: `Version ${version.version_number}`,
      timestamp: version.created_at,
      versionNumber: version.version_number,
      summary: version.question,
    });
  }

  if (entry.status === "archived") {
    events.push({
      id: `ev-retired-${entry.id}`,
      entryId: entry.id,
      type: "retired",
      label: "Retired",
      timestamp: entry.updated_at,
    });
  }

  if (entry.merged_into_id) {
    events.push({
      id: `ev-merged-${entry.id}`,
      entryId: entry.id,
      type: "merged",
      label: "Merged into another entry",
      timestamp: entry.updated_at,
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function compareVersions(
  a: KnowledgeVersionRow,
  b: KnowledgeVersionRow
): Array<{ field: string; before: string; after: string }> {
  const diffs: Array<{ field: string; before: string; after: string }> = [];
  if (a.question !== b.question) {
    diffs.push({ field: "Question", before: a.question, after: b.question });
  }
  if (a.answer !== b.answer) {
    diffs.push({
      field: "Answer",
      before: truncate(a.answer, 120),
      after: truncate(b.answer, 120),
    });
  }
  if (a.keywords.join(",") !== b.keywords.join(",")) {
    diffs.push({
      field: "Keywords",
      before: a.keywords.join(", "),
      after: b.keywords.join(", "),
    });
  }
  return diffs;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function evolutionTypeLabel(type: EvolutionEventType): string {
  const labels: Record<EvolutionEventType, string> = {
    created: "Created",
    modified: "Modified",
    improved: "Improved",
    regenerated: "Regenerated",
    published: "Published",
    deprecated: "Deprecated",
    merged: "Merged",
    retired: "Retired",
  };
  return labels[type];
}
