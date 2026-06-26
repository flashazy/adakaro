import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { phraseAlreadyExists } from "./learning-quality";
import type { AIKnowledgeEntry } from "./types";
import type { DraftLearningSuggestion, LearningSuggestionRow } from "./learning-types";
import type { LearningSuggestionType } from "./learning-types";

export async function applyApprovedSuggestion(
  client: SupabaseClient<Database>,
  suggestion: LearningSuggestionRow,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (suggestion.status !== "pending") {
    return { ok: false, error: "Suggestion is not pending." };
  }

  const now = new Date().toISOString();

  try {
    switch (suggestion.suggestion_type) {
      case "search_phrase":
      case "alternative_wording":
      case "synonym":
      case "keyword":
      case "related_intent":
        await applyEntryFieldSuggestion(client, suggestion);
        break;
      case "intent_trigger":
      case "intent_negative":
        await applyIntentOverrideSuggestion(client, suggestion);
        break;
      case "new_entry":
        return {
          ok: false,
          error: "Create the knowledge entry manually, then approve related phrase suggestions.",
        };
      default:
        return { ok: false, error: "Unknown suggestion type." };
    }

    await client
      .from("ai_learning_suggestions")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: now,
        applied_at: now,
      } as never)
      .eq("id", suggestion.id);

    return { ok: true };
  } catch (error) {
    console.error("[learning] apply suggestion:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to apply suggestion.",
    };
  }
}

async function applyEntryFieldSuggestion(
  client: SupabaseClient<Database>,
  suggestion: LearningSuggestionRow
): Promise<void> {
  if (!suggestion.target_entry_id) {
    throw new Error("Missing target entry.");
  }

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .select("*")
    .eq("id", suggestion.target_entry_id)
    .single();

  if (error || !data) throw new Error("Target entry not found.");

  const entry = data as AIKnowledgeEntry;
  const text = suggestion.suggested_text.trim();
  const patch: Record<string, unknown> = {};

  const fieldMap: Record<
    Exclude<LearningSuggestionType, "new_entry" | "intent_trigger" | "intent_negative">,
    keyof AIKnowledgeEntry
  > = {
    search_phrase: "search_phrases",
    alternative_wording: "alternative_wording",
    synonym: "synonyms",
    keyword: "keywords",
    related_intent: "related_intents",
  };

  const field = fieldMap[suggestion.suggestion_type as keyof typeof fieldMap];
  if (!field) throw new Error("Unsupported entry suggestion type.");

  const current = (entry[field] as string[]) ?? [];
  if (phraseAlreadyExists(text, current)) return;

  patch[field] = [...current, text];

  const { error: updateError } = await client
    .from("ai_knowledge_entries")
    .update(patch as never)
    .eq("id", entry.id);

  if (updateError) throw updateError;
}

async function applyIntentOverrideSuggestion(
  client: SupabaseClient<Database>,
  suggestion: LearningSuggestionRow
): Promise<void> {
  if (!suggestion.target_intent_key) {
    throw new Error("Missing target intent.");
  }

  const text = suggestion.suggested_text.trim();
  const isTrigger = suggestion.suggestion_type === "intent_trigger";

  const { data: existing } = await client
    .from("ai_intent_learning_overrides")
    .select("*")
    .eq("intent_key", suggestion.target_intent_key)
    .maybeSingle();

  const row = existing as {
    trigger_phrases?: string[];
    negative_phrases?: string[];
  } | null;

  const triggerPhrases = row?.trigger_phrases ?? [];
  const negativePhrases = row?.negative_phrases ?? [];

  const payload = {
    intent_key: suggestion.target_intent_key,
    trigger_phrases: isTrigger
      ? phraseAlreadyExists(text, triggerPhrases)
        ? triggerPhrases
        : [...triggerPhrases, text]
      : triggerPhrases,
    negative_phrases: !isTrigger
      ? phraseAlreadyExists(text, negativePhrases)
        ? negativePhrases
        : [...negativePhrases, text]
      : negativePhrases,
  };

  const { error } = await client
    .from("ai_intent_learning_overrides")
    .upsert(payload as never, { onConflict: "intent_key" });

  if (error) throw error;
}

export function mergeEntryWithSuggestionPreview(
  entry: AIKnowledgeEntry,
  suggestion: DraftLearningSuggestion
): AIKnowledgeEntry {
  const text = suggestion.suggested_text.trim();
  const clone = { ...entry };

  switch (suggestion.suggestion_type) {
    case "search_phrase":
      clone.search_phrases = [...clone.search_phrases, text];
      break;
    case "alternative_wording":
      clone.alternative_wording = [...clone.alternative_wording, text];
      break;
    case "synonym":
      clone.synonyms = [...(clone.synonyms ?? []), text];
      break;
    case "keyword":
      clone.keywords = [...clone.keywords, text];
      break;
    case "related_intent":
      clone.related_intents = [...(clone.related_intents ?? []), text];
      break;
    default:
      break;
  }

  return clone;
}

export async function getAdminLearningClient(
  supabase: SupabaseClient<Database>
): Promise<SupabaseClient<Database>> {
  try {
    return createAdminClient();
  } catch {
    return supabase;
  }
}
