import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { normalizedQuestionField } from "./knowledge-duplicates";
import type { AIKnowledgeEntry } from "./types";

export interface KnowledgeVersionRow {
  id: string;
  knowledge_entry_id: string;
  version_number: number;
  question: string;
  answer: string;
  keywords: string[];
  search_phrases: string[];
  alternative_wording: string[];
  synonyms: string[];
  related_terms: string[];
  intent_key: string | null;
  created_by: string | null;
  created_at: string;
}

export function entrySnapshot(entry: AIKnowledgeEntry): Omit<
  KnowledgeVersionRow,
  "id" | "knowledge_entry_id" | "created_at" | "created_by"
> {
  return {
    version_number: entry.version_number ?? 1,
    question: entry.question,
    answer: entry.answer,
    keywords: entry.keywords,
    search_phrases: entry.search_phrases,
    alternative_wording: entry.alternative_wording,
    synonyms: entry.synonyms ?? [],
    related_terms: entry.related_terms,
    intent_key: entry.intent_key ?? null,
  };
}

export async function snapshotEntryVersion(
  client: SupabaseClient<Database>,
  entry: AIKnowledgeEntry,
  userId: string | null
): Promise<void> {
  const snapshot = entrySnapshot(entry);
  const { error } = await client.from("ai_knowledge_entry_versions").insert({
    knowledge_entry_id: entry.id,
    ...snapshot,
    created_by: userId,
  } as never);

  if (error && error.code !== "23505") {
    console.error("[knowledge] snapshot version:", error);
  }
}

export async function loadEntryVersions(
  client: SupabaseClient<Database>,
  entryId: string
): Promise<KnowledgeVersionRow[]> {
  const { data, error } = await client
    .from("ai_knowledge_entry_versions")
    .select("*")
    .eq("knowledge_entry_id", entryId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("[knowledge] load versions:", error);
    return [];
  }

  return (data ?? []) as KnowledgeVersionRow[];
}

export async function restoreEntryVersion(
  client: SupabaseClient<Database>,
  entry: AIKnowledgeEntry,
  version: KnowledgeVersionRow,
  userId: string | null
): Promise<AIKnowledgeEntry | null> {
  await snapshotEntryVersion(client, entry, userId);

  const nextVersion = (entry.version_number ?? 1) + 1;
  const patch = {
    question: version.question,
    answer: version.answer,
    keywords: version.keywords,
    search_phrases: version.search_phrases,
    alternative_wording: version.alternative_wording,
    synonyms: version.synonyms,
    related_terms: version.related_terms,
    intent_key: version.intent_key,
    normalized_question: normalizedQuestionField(version.question),
    version_number: nextVersion,
    updated_by: userId,
    is_primary: true,
    status: "active" as const,
  };

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .update(patch as never)
    .eq("id", entry.id)
    .select("*")
    .single();

  if (error) {
    console.error("[knowledge] restore version:", error);
    return null;
  }

  return data as AIKnowledgeEntry;
}

export async function upsertIntentPrimaryEntry(
  client: SupabaseClient<Database>,
  intentKey: string,
  entryId: string,
  userId: string | null
): Promise<void> {
  const { error } = await client.from("ai_intent_primary_entries").upsert(
    {
      intent_key: intentKey,
      primary_entry_id: entryId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "intent_key" }
  );

  if (error) {
    console.error("[knowledge] upsert intent primary:", error);
  }
}

export async function demoteDuplicateEntries(
  client: SupabaseClient<Database>,
  primaryId: string,
  duplicateIds: string[],
  userId: string | null
): Promise<void> {
  if (duplicateIds.length === 0) return;

  const { error } = await client
    .from("ai_knowledge_entries")
    .update({
      is_primary: false,
      status: "archived",
      merged_into_id: primaryId,
      updated_by: userId,
    } as never)
    .in("id", duplicateIds);

  if (error) {
    console.error("[knowledge] demote duplicates:", error);
  }
}
