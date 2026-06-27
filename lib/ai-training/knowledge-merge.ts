import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { mergeStringArrays, normalizedQuestionField } from "./knowledge-duplicates";
import {
  demoteDuplicateEntries,
  snapshotEntryVersion,
  upsertIntentPrimaryEntry,
} from "./knowledge-versioning";
import { computeKnowledgeHealth } from "./knowledge-duplicates";
import type { AIKnowledgeEntry } from "./types";

export async function mergeKnowledgeEntries(
  client: SupabaseClient<Database>,
  primary: AIKnowledgeEntry,
  duplicate: AIKnowledgeEntry,
  userId: string | null
): Promise<{ ok: boolean; row?: AIKnowledgeEntry; error?: string }> {
  if (primary.id === duplicate.id) {
    return { ok: false, error: "Cannot merge an entry with itself." };
  }

  await snapshotEntryVersion(client, primary, userId);

  const mergedQuestion =
    primary.answer.trim().length >= duplicate.answer.trim().length
      ? primary.question
      : duplicate.question;
  const mergedAnswer =
    primary.answer.trim().length >= duplicate.answer.trim().length
      ? primary.answer
      : duplicate.answer;

  const patch = {
    question: mergedQuestion,
    answer: mergedAnswer,
    keywords: mergeStringArrays(primary.keywords, duplicate.keywords),
    search_phrases: mergeStringArrays(
      primary.search_phrases,
      duplicate.search_phrases
    ),
    alternative_wording: mergeStringArrays(
      primary.alternative_wording,
      duplicate.alternative_wording,
      [duplicate.question]
    ),
    synonyms: mergeStringArrays(primary.synonyms ?? [], duplicate.synonyms ?? []),
    related_terms: mergeStringArrays(
      primary.related_terms,
      duplicate.related_terms
    ),
    intent_key: primary.intent_key ?? duplicate.intent_key,
    intent_name: primary.intent_name ?? duplicate.intent_name,
    intent_group: primary.intent_group ?? duplicate.intent_group,
    normalized_question: normalizedQuestionField(mergedQuestion),
    version_number: (primary.version_number ?? 1) + 1,
    is_primary: true,
    status: "active" as const,
    merged_into_id: null,
    updated_by: userId,
  };

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .update(patch as never)
    .eq("id", primary.id)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Merge failed." };
  }

  await demoteDuplicateEntries(client, primary.id, [duplicate.id], userId);

  const merged = data as AIKnowledgeEntry;
  if (merged.intent_key) {
    await upsertIntentPrimaryEntry(client, merged.intent_key, merged.id, userId);
  }

  const health = computeKnowledgeHealth(merged, [merged]);
  await client
    .from("ai_knowledge_entries")
    .update({ health_status: health.level } as never)
    .eq("id", merged.id);

  return { ok: true, row: merged };
}
