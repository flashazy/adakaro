import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  checkQuestionDuplicates,
  computeKnowledgeHealth,
  findSimilarEntries,
  normalizedQuestionField,
} from "./knowledge-duplicates";
import { intentPayloadForCreate } from "./intent-recalculate";
import {
  demoteDuplicateEntries,
  snapshotEntryVersion,
  upsertIntentPrimaryEntry,
} from "./knowledge-versioning";
import { loadActiveKnowledgeEntries } from "./knowledge-search";
import type {
  AIKnowledgeEntry,
  DuplicateCheckResult,
  DuplicateSaveAction,
  KnowledgePriority,
} from "./types";

export interface KnowledgeEntryPayload {
  category: string;
  curriculum_module?: string | null;
  question: string;
  answer: string;
  keywords: string[];
  search_phrases: string[];
  alternative_wording: string[];
  synonyms: string[];
  related_terms: string[];
  priority: KnowledgePriority;
}

export async function loadEntriesForDuplicateCheck(
  client: SupabaseClient<Database>
): Promise<AIKnowledgeEntry[]> {
  const { data, error } = await client
    .from("ai_knowledge_entries")
    .select("*")
    .neq("category", "needs_review");

  if (error) {
    console.error("[knowledge] load for duplicates:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const entry = row as AIKnowledgeEntry;
    return {
      ...entry,
      synonyms: entry.synonyms ?? [],
      related_intents: entry.related_intents ?? [],
      is_primary: entry.is_primary ?? true,
      version_number: entry.version_number ?? 1,
    };
  });
}

export async function validateDuplicateBeforeSave(
  client: SupabaseClient<Database>,
  question: string,
  category: string,
  excludeId?: string
) {
  const entries = await loadEntriesForDuplicateCheck(client);
  return checkQuestionDuplicates(question, entries, { excludeId, category });
}

export function buildEntryPatch(
  payload: KnowledgeEntryPayload,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    category: payload.category,
    ...(payload.curriculum_module != null
      ? { curriculum_module: payload.curriculum_module }
      : {}),
    question: payload.question,
    answer: payload.answer,
    keywords: payload.keywords,
    search_phrases: payload.search_phrases,
    alternative_wording: payload.alternative_wording,
    synonyms: payload.synonyms,
    related_terms: payload.related_terms,
    priority: payload.priority,
    normalized_question: normalizedQuestionField(payload.question),
    ...extras,
  };
}

export async function createKnowledgeEntry(
  client: SupabaseClient<Database>,
  payload: KnowledgeEntryPayload,
  userId: string,
  options?: {
    duplicateAction?: DuplicateSaveAction;
    targetEntryId?: string;
    allEntries?: AIKnowledgeEntry[];
  }
): Promise<
  | { ok: true; row: AIKnowledgeEntry }
  | { ok: false; duplicate: true; check: DuplicateCheckResult }
  | { ok: false; error: string }
> {
  const entries =
    options?.allEntries ?? (await loadEntriesForDuplicateCheck(client));
  const check = checkQuestionDuplicates(payload.question, entries, {
    category: payload.category,
  });

  const action = options?.duplicateAction ?? "create";
  if (check.exactMatch && action === "create") {
    return { ok: false, duplicate: true, check };
  }

  if (action === "update_existing" && check.exactMatch) {
    const targetId = options?.targetEntryId ?? check.exactMatch.entry.id;
    const existing = entries.find((e) => e.id === targetId);
    if (!existing) return { ok: false, error: "Target entry not found." };

    await snapshotEntryVersion(client, existing, userId);
    const patch = buildEntryPatch(payload, {
      version_number: (existing.version_number ?? 1) + 1,
      updated_by: userId,
      is_primary: true,
      status: "active",
      merged_into_id: null,
    });

    const { data, error } = await client
      .from("ai_knowledge_entries")
      .update(patch as never)
      .eq("id", targetId)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Update failed." };
    const row = data as AIKnowledgeEntry;
    await finalizeEntry(client, row, userId, entries);
    return { ok: true, row };
  }

  if (action === "replace_answer" && check.exactMatch) {
    const targetId = options?.targetEntryId ?? check.exactMatch.entry.id;
    const existing = entries.find((e) => e.id === targetId);
    if (!existing) return { ok: false, error: "Target entry not found." };

    await snapshotEntryVersion(client, existing, userId);
    const { data, error } = await client
      .from("ai_knowledge_entries")
      .update({
        answer: payload.answer,
        version_number: (existing.version_number ?? 1) + 1,
        updated_by: userId,
      } as never)
      .eq("id", targetId)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Update failed." };
    return { ok: true, row: data as AIKnowledgeEntry };
  }

  if (action === "new_version" && check.exactMatch) {
    const targetId = options?.targetEntryId ?? check.exactMatch.entry.id;
    const existing = entries.find((e) => e.id === targetId);
    if (!existing) return { ok: false, error: "Target entry not found." };

    await snapshotEntryVersion(client, existing, userId);
    const patch = buildEntryPatch(payload, {
      version_number: (existing.version_number ?? 1) + 1,
      updated_by: userId,
      is_primary: true,
      status: "active",
    });

    const { data, error } = await client
      .from("ai_knowledge_entries")
      .update(patch as never)
      .eq("id", targetId)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Version failed." };
    const row = data as AIKnowledgeEntry;
    await finalizeEntry(client, row, userId, entries);
    return { ok: true, row };
  }

  const intentFields = intentPayloadForCreate(payload.question, payload.category);
  const insertPayload = {
    ...buildEntryPatch(payload),
    ...intentFields,
    status: "active" as const,
    created_by: userId,
    updated_by: userId,
    is_primary: true,
    version_number: 1,
  };

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .insert(insertPayload as never)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Create failed." };

  const row = data as AIKnowledgeEntry;
  await client
    .from("ai_knowledge_entries")
    .update({ root_entry_id: row.id } as never)
    .eq("id", row.id);

  const similar = findSimilarEntries(payload.question, entries, {
    excludeId: row.id,
    minSimilarity: 0.85,
    includeDifferentIntent: false,
  }).filter(
    (m) =>
      m.classification === "exact_duplicate" ||
      m.classification === "near_duplicate"
  );
  if (similar.length > 0) {
    await demoteDuplicateEntries(
      client,
      row.id,
      similar.map((s) => s.entry.id),
      userId
    );
  }

  await finalizeEntry(client, { ...row, root_entry_id: row.id }, userId, entries);
  return { ok: true, row: { ...row, root_entry_id: row.id } };
}

async function finalizeEntry(
  client: SupabaseClient<Database>,
  row: AIKnowledgeEntry,
  userId: string,
  allEntries: AIKnowledgeEntry[]
): Promise<void> {
  const health = computeKnowledgeHealth(row, allEntries);
  await client
    .from("ai_knowledge_entries")
    .update({ health_status: health.level } as never)
    .eq("id", row.id);

  if (row.intent_key) {
    await upsertIntentPrimaryEntry(client, row.intent_key, row.id, userId);
  }
}

export async function refreshEntryHealth(
  client: SupabaseClient<Database>,
  entryId: string
): Promise<void> {
  const entries = await loadActiveKnowledgeEntries(client);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return;
  const health = computeKnowledgeHealth(entry, entries);
  await client
    .from("ai_knowledge_entries")
    .update({ health_status: health.level } as never)
    .eq("id", entryId);
}
