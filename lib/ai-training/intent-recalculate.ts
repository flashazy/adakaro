import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  inferIntentWithConfidence,
  type IntentInferenceResult,
} from "./intent-registry";
import type { AIKnowledgeEntry } from "./types";

export const INTENT_REGISTRY_VERSION = "2026-06";

const BATCH_SIZE = 50;

export interface IntentClassification {
  intent_key: string | null;
  intent_name: string | null;
  intent_group: string | null;
  related_intents: string[];
  intent_confidence: number | null;
  intent_recalculated_at: string | null;
}

export interface IntentChangePreview {
  id: string;
  question: string;
  category: string;
  oldIntentKey: string | null;
  oldIntentName: string | null;
  newIntentKey: string | null;
  newIntentName: string | null;
  confidence: number | null;
  reason: string;
}

export interface BulkRecalculatePreview {
  scanned: number;
  wouldUpdate: number;
  unchanged: number;
  changes: IntentChangePreview[];
}

export interface BulkRecalculateResult {
  scanned: number;
  updated: number;
  unchanged: number;
  failed: number;
  durationMs: number;
}

export interface IntentHealthSummary {
  registryVersion: string;
  activeEntries: number;
  nullIntentCount: number;
  staleIntentCount: number;
  needsRecalculation: number;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function intentFieldsFromInference(
  inference: IntentInferenceResult | null,
  category: string
): IntentClassification {
  if (!inference) {
    return {
      intent_key: null,
      intent_name: null,
      intent_group: category,
      related_intents: [],
      intent_confidence: null,
      intent_recalculated_at: null,
    };
  }

  return {
    intent_key: inference.key,
    intent_name: inference.name,
    intent_group: inference.group,
    related_intents: inference.relatedIntents,
    intent_confidence: inference.confidence,
    intent_recalculated_at: null,
  };
}

export function intentFieldsChanged(
  current: {
    intent_key?: string | null;
    intent_name?: string | null;
    intent_group?: string | null;
    related_intents?: string[];
  },
  next: IntentClassification
): boolean {
  const currentKey = current.intent_key ?? null;
  const currentName = current.intent_name ?? null;
  const currentGroup = current.intent_group ?? null;
  const currentRelated = current.related_intents ?? [];

  return (
    currentKey !== next.intent_key ||
    currentName !== next.intent_name ||
    currentGroup !== next.intent_group ||
    !arraysEqual(currentRelated, next.related_intents)
  );
}

export function computeIntentRecalculation(
  question: string,
  category: string,
  current?: {
    intent_key?: string | null;
    intent_name?: string | null;
    intent_group?: string | null;
    related_intents?: string[];
  }
): {
  inference: IntentInferenceResult | null;
  next: IntentClassification;
  changed: boolean;
} {
  const inference = inferIntentWithConfidence(question, category);
  const next = intentFieldsFromInference(inference, category);
  const changed = current ? intentFieldsChanged(current, next) : true;
  return { inference, next, changed };
}

export function buildIntentPatch(
  next: IntentClassification,
  recalculatedAt: string
): Record<string, unknown> {
  return {
    intent_key: next.intent_key,
    intent_name: next.intent_name,
    intent_group: next.intent_group,
    related_intents: next.related_intents,
    intent_confidence: next.intent_confidence,
    intent_recalculated_at: recalculatedAt,
  };
}

export async function logIntentHistory(
  client: SupabaseClient<Database>,
  params: {
    entryId: string;
    previousIntentKey: string | null;
    newIntentKey: string | null;
    previousIntentName: string | null;
    newIntentName: string | null;
    reason: string;
    userId: string | null;
  }
): Promise<void> {
  const { error } = await client.from("ai_knowledge_intent_history").insert({
    knowledge_entry_id: params.entryId,
    previous_intent_key: params.previousIntentKey,
    new_intent_key: params.newIntentKey,
    previous_intent_name: params.previousIntentName,
    new_intent_name: params.newIntentName,
    reason: params.reason,
    changed_by: params.userId,
  } as never);

  if (error) {
    console.error("[intent] history log:", error);
  }
}

export async function applyIntentRecalculation(
  client: SupabaseClient<Database>,
  entry: AIKnowledgeEntry,
  userId: string | null,
  reason: string,
  force = false
): Promise<{ row: AIKnowledgeEntry | null; changed: boolean }> {
  const { inference, next, changed } = computeIntentRecalculation(
    entry.question,
    entry.category,
    entry
  );

  if (!changed && !force) {
    return { row: entry, changed: false };
  }

  const now = new Date().toISOString();
  const patch = buildIntentPatch(next, now);

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .update(patch as never)
    .eq("id", entry.id)
    .select("*")
    .single();

  if (error) {
    console.error("[intent] recalculate entry:", error);
    return { row: null, changed: false };
  }

  if (changed) {
    await logIntentHistory(client, {
      entryId: entry.id,
      previousIntentKey: entry.intent_key ?? null,
      newIntentKey: next.intent_key,
      previousIntentName: entry.intent_name ?? null,
      newIntentName: next.intent_name,
      reason: inference?.reason ?? reason,
      userId,
    });
  }

  return { row: data as AIKnowledgeEntry, changed: changed || force };
}

export function previewEntryIntentChange(
  entry: AIKnowledgeEntry
): IntentChangePreview | null {
  const { inference, next, changed } = computeIntentRecalculation(
    entry.question,
    entry.category,
    entry
  );

  if (!changed) return null;

  return {
    id: entry.id,
    question: entry.question,
    category: entry.category,
    oldIntentKey: entry.intent_key ?? null,
    oldIntentName: entry.intent_name ?? null,
    newIntentKey: next.intent_key,
    newIntentName: next.intent_name,
    confidence: next.intent_confidence,
    reason: inference?.reason ?? "Intent engine updated classification.",
  };
}

export async function loadActiveEntriesForIntentScan(
  client: SupabaseClient<Database>
): Promise<AIKnowledgeEntry[]> {
  const rows: AIKnowledgeEntry[] = [];
  let from = 0;
  const pageSize = 200;

  while (true) {
    const { data, error } = await client
      .from("ai_knowledge_entries")
      .select("*")
      .eq("status", "active")
      .neq("category", "needs_review")
      .order("updated_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("[intent] scan entries:", error);
      break;
    }

    const batch = (data ?? []) as AIKnowledgeEntry[];
    rows.push(
      ...batch.map((row) => ({
        ...row,
        synonyms: row.synonyms ?? [],
        related_intents: row.related_intents ?? [],
      }))
    );

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export function previewBulkIntentRecalculation(
  entries: AIKnowledgeEntry[]
): BulkRecalculatePreview {
  const changes: IntentChangePreview[] = [];

  for (const entry of entries) {
    const change = previewEntryIntentChange(entry);
    if (change) changes.push(change);
  }

  return {
    scanned: entries.length,
    wouldUpdate: changes.length,
    unchanged: entries.length - changes.length,
    changes,
  };
}

export async function applyBulkIntentRecalculation(
  client: SupabaseClient<Database>,
  entries: AIKnowledgeEntry[],
  userId: string | null,
  changeIds?: Set<string>
): Promise<BulkRecalculateResult> {
  const started = Date.now();
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  const toProcess = changeIds
    ? entries.filter((e) => changeIds.has(e.id))
    : entries.filter((e) => previewEntryIntentChange(e) !== null);

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    for (const entry of batch) {
      const result = await applyIntentRecalculation(
        client,
        entry,
        userId,
        "Bulk intent recalculation",
        false
      );

      if (!result.row) {
        failed++;
      } else if (result.changed) {
        updated++;
      } else {
        unchanged++;
      }
    }
  }

  const skipped = entries.length - toProcess.length;
  unchanged += skipped;

  return {
    scanned: entries.length,
    updated,
    unchanged,
    failed,
    durationMs: Date.now() - started,
  };
}

export function computeIntentHealth(
  entries: AIKnowledgeEntry[]
): IntentHealthSummary {
  let nullIntentCount = 0;
  let staleIntentCount = 0;

  for (const entry of entries) {
    if (!entry.intent_key) nullIntentCount++;
    if (previewEntryIntentChange(entry)) staleIntentCount++;
  }

  return {
    registryVersion: INTENT_REGISTRY_VERSION,
    activeEntries: entries.length,
    nullIntentCount,
    staleIntentCount,
    needsRecalculation: staleIntentCount,
  };
}

/** Apply intent on create; always sets confidence timestamp. */
export function intentPayloadForCreate(
  question: string,
  category: string
): Record<string, unknown> {
  const inference = inferIntentWithConfidence(question, category);
  const next = intentFieldsFromInference(inference, category);
  const now = new Date().toISOString();
  return buildIntentPatch(next, now);
}

/** Recalculate on edit when question or category changed. Returns patch or null. */
export function intentPatchIfQuestionChanged(
  question: string,
  category: string,
  previous: AIKnowledgeEntry,
  questionChanged: boolean,
  categoryChanged: boolean
): Record<string, unknown> | null {
  if (!questionChanged && !categoryChanged) return null;

  const { inference, next, changed } = computeIntentRecalculation(
    question,
    category,
    previous
  );

  if (!changed) return null;

  const now = new Date().toISOString();
  return {
    ...buildIntentPatch(next, now),
    _history: {
      previousIntentKey: previous.intent_key ?? null,
      newIntentKey: next.intent_key,
      previousIntentName: previous.intent_name ?? null,
      newIntentName: next.intent_name,
      reason:
        inference?.reason ??
        (questionChanged
          ? "Question changed — intent recalculated."
          : "Category changed — intent recalculated."),
    },
  };
}
