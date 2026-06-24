import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeQuestionForDedup } from "./keyword-generator";
import type {
  AIKnowledgeEntry,
  KnowledgeSearchMatch,
  UnansweredSource,
} from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function substringScore(query: string, candidate: string): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.includes(q) || q.includes(c)) return 0.85;
  return 0;
}

function scoreCandidate(query: string, queryTokens: Set<string>, candidate: string): number {
  const sub = substringScore(query, candidate);
  const jac = jaccard(queryTokens, tokenSet(candidate));
  return Math.max(sub, jac);
}

function scoreEntry(query: string, entry: AIKnowledgeEntry): number {
  const queryTokens = tokenSet(query);
  const fields = [
    entry.question,
    ...entry.keywords,
    ...entry.search_phrases,
    ...entry.alternative_wording,
    ...entry.synonyms ?? [],
    ...entry.related_terms,
  ];

  let best = 0;
  for (const field of fields) {
    best = Math.max(best, scoreCandidate(query, queryTokens, field));
  }

  const priorityBoost =
    entry.priority === "critical"
      ? 0.08
      : entry.priority === "high"
        ? 0.05
        : entry.priority === "low"
          ? -0.02
          : 0;

  return Math.min(1, best + priorityBoost);
}

export function rankKnowledgeEntries(
  query: string,
  entries: AIKnowledgeEntry[]
): KnowledgeSearchMatch[] {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(query, entry) }))
    .filter((m) => m.score >= MATCH_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
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
  const queryTokens = tokenSet(query);
  const matchedKeywords: string[] = [];
  const matchedPhrases: string[] = [];

  for (const kw of entry.keywords) {
    if (scoreCandidate(query, queryTokens, kw) >= 0.35) matchedKeywords.push(kw);
  }
  for (const phrase of entry.search_phrases) {
    if (scoreCandidate(query, queryTokens, phrase) >= 0.35) matchedPhrases.push(phrase);
  }
  for (const alt of entry.alternative_wording) {
    if (scoreCandidate(query, queryTokens, alt) >= 0.5) matchedPhrases.push(alt);
  }
  for (const syn of entry.synonyms ?? []) {
    if (scoreCandidate(query, queryTokens, syn) >= 0.35) matchedKeywords.push(syn);
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
