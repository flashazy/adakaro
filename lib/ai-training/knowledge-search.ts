import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeQuestionForDedup } from "./keyword-generator";
import {
  rankKnowledgeEntriesScored,
  scoreCandidate,
  scoreEntry,
  scoreEntryBreakdown,
} from "./knowledge-scoring";
import type {
  AIKnowledgeEntry,
  KnowledgeSearchMatch,
  UnansweredSource,
} from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export {
  MATCH_SCORE_THRESHOLD,
  scoreCandidate,
  scoreEntry,
  scoreEntryBreakdown,
} from "./knowledge-scoring";

export function rankKnowledgeEntries(
  query: string,
  entries: AIKnowledgeEntry[]
): KnowledgeSearchMatch[] {
  return rankKnowledgeEntriesScored(query, entries).map(({ entry, score }) => ({
    entry,
    score,
  }));
}

export function scoreEntryWithMatches(
  query: string,
  entry: AIKnowledgeEntry
): {
  entry: AIKnowledgeEntry;
  score: number;
  matchedKeywords: string[];
  matchedPhrases: string[];
} {
  const matchedKeywords: string[] = [];
  const matchedPhrases: string[] = [];

  for (const kw of entry.keywords) {
    if (scoreCandidate(query, kw) >= 0.35) matchedKeywords.push(kw);
  }
  for (const phrase of entry.search_phrases) {
    if (scoreCandidate(query, phrase) >= 0.35) matchedPhrases.push(phrase);
  }
  for (const alt of entry.alternative_wording) {
    if (scoreCandidate(query, alt) >= 0.45) matchedPhrases.push(alt);
  }
  for (const syn of entry.synonyms ?? []) {
    if (scoreCandidate(query, syn) >= 0.35) matchedKeywords.push(syn);
  }

  return {
    entry,
    score: scoreEntry(query, entry),
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 8),
    matchedPhrases: [...new Set(matchedPhrases)].slice(0, 6),
  };
}

async function getAdminSupabase(
  supabase: SupabaseClient<Database>
): Promise<SupabaseClient<Database>> {
  try {
    return createAdminClient();
  } catch {
    return supabase;
  }
}

export async function loadActiveKnowledgeEntries(
  supabase: SupabaseClient<Database>
): Promise<AIKnowledgeEntry[]> {
  const client = await getAdminSupabase(supabase);
  const { data, error } = await client
    .from("ai_knowledge_entries")
    .select("*")
    .eq("status", "active")
    .neq("category", "needs_review")
    .order("priority", { ascending: false });

  if (error) {
    console.error("[ai-training] load entries:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...(row as AIKnowledgeEntry),
    synonyms: (row as AIKnowledgeEntry).synonyms ?? [],
  }));
}

export async function searchKnowledgeEntries(
  supabase: SupabaseClient<Database>,
  query: string
): Promise<KnowledgeSearchMatch | null> {
  const entries = await loadActiveKnowledgeEntries(supabase);
  const ranked = rankKnowledgeEntries(query, entries);
  return ranked[0] ?? null;
}

export async function recordKnowledgeUsage(
  supabase: SupabaseClient<Database>,
  entryId: string,
  query: string,
  score: number,
  source = "public_ai"
): Promise<void> {
  const client = await getAdminSupabase(supabase);

  const { error: logError } = await client
    .from("ai_knowledge_usage_logs")
    .insert({
      knowledge_entry_id: entryId,
      query_text: query,
      match_score: score,
      source,
    } as never);

  if (logError) {
    console.error("[ai-training] usage log:", logError);
  }

  const { data: current } = await client
    .from("ai_knowledge_entries")
    .select("usage_count")
    .eq("id", entryId)
    .maybeSingle();

  const usageCount = ((current as { usage_count?: number } | null)?.usage_count ?? 0) + 1;

  const { error: updateError } = await client
    .from("ai_knowledge_entries")
    .update({
      usage_count: usageCount,
      last_used_at: new Date().toISOString(),
    } as never)
    .eq("id", entryId);

  if (updateError) {
    console.error("[ai-training] usage update:", updateError);
  }
}

export async function logUnansweredQuestion(
  supabase: SupabaseClient<Database>,
  question: string,
  source: UnansweredSource = "public_ai"
): Promise<void> {
  const client = await getAdminSupabase(supabase);
  const normalized = normalizeQuestionForDedup(question);
  if (!normalized) return;

  const { data: existing } = await client
    .from("ai_unanswered_questions")
    .select("id, occurrences")
    .eq("normalized_question", normalized)
    .eq("source", source)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const row = existing as { id: string; occurrences: number };
    await client
      .from("ai_unanswered_questions")
      .update({
        occurrences: row.occurrences + 1,
        last_seen_at: now,
        status: "pending",
      } as never)
      .eq("id", row.id);
    return;
  }

  await client.from("ai_unanswered_questions").insert({
    question: question.trim(),
    normalized_question: normalized,
    source,
    status: "pending",
    first_seen_at: now,
    last_seen_at: now,
  } as never);
}

export function formatKnowledgeAnswer(entry: AIKnowledgeEntry): string {
  const lines = entry.answer.trim().split("\n");
  const hasHeading = lines[0]?.startsWith("**");
  if (hasHeading) {
    return entry.answer.trim();
  }
  return `**${entry.question.replace(/\?+$/, "")}**\n\n${entry.answer.trim()}`;
}
