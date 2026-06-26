import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  rankKnowledgeEntries,
  scoreEntryWithMatches,
} from "./knowledge-search";
import { resolveKnowledgeMatch, resolveKnowledgeMatchSync } from "./knowledge-retrieval";
import { scoreEntry } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface AITestMatchResult {
  matched: boolean;
  confidence: number;
  entry: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  answerPreview: string | null;
  category: string | null;
  keywordScore: number;
  semanticScore: number | null;
  finalScore: number;
  semanticAvailable: boolean;
}

export interface TestKnowledgeQueryOptions {
  keywordOnly?: boolean;
  semanticScores?: Map<string, number>;
}

function buildTestResult(
  query: string,
  match: ReturnType<typeof resolveKnowledgeMatchSync> | null,
  semanticAvailable: boolean
): AITestMatchResult {
  if (!match) {
    return {
      matched: false,
      confidence: 0,
      entry: null,
      matchedKeywords: [],
      matchedPhrases: [],
      answerPreview: null,
      category: null,
      keywordScore: 0,
      semanticScore: null,
      finalScore: 0,
      semanticAvailable,
    };
  }

  const keywordScore = match.keywordScore ?? match.score;
  const semanticScore = match.semanticScore ?? null;
  const finalScore = match.finalScore ?? match.score;
  const matched = finalScore >= MATCH_SCORE_THRESHOLD;

  const detail = scoreEntryWithMatches(query, match.entry);
  const preview =
    match.entry.answer.length > 280
      ? `${match.entry.answer.slice(0, 280).trim()}…`
      : match.entry.answer;

  return {
    matched,
    confidence: Math.round(finalScore * 100),
    entry: matched ? match.entry : null,
    matchedKeywords: detail.matchedKeywords,
    matchedPhrases: detail.matchedPhrases,
    answerPreview: matched ? preview : null,
    category: matched ? match.entry.category : null,
    keywordScore,
    semanticScore,
    finalScore,
    semanticAvailable,
  };
}

function buildNoMatchFallback(
  query: string,
  entries: AIKnowledgeEntry[],
  semanticAvailable: boolean
): AITestMatchResult {
  const topEntry = [...entries].sort(
    (a, b) => scoreEntry(query, b) - scoreEntry(query, a)
  )[0];
  const fallbackDetail = topEntry
    ? scoreEntryWithMatches(query, topEntry)
    : null;

  return {
    matched: false,
    confidence: Math.round((fallbackDetail?.score ?? 0) * 100),
    entry: null,
    matchedKeywords: fallbackDetail?.matchedKeywords ?? [],
    matchedPhrases: fallbackDetail?.matchedPhrases ?? [],
    answerPreview: null,
    category: null,
    keywordScore: fallbackDetail?.score ?? 0,
    semanticScore: null,
    finalScore: fallbackDetail?.score ?? 0,
    semanticAvailable,
  };
}

export function testKnowledgeQuery(
  query: string,
  entries: AIKnowledgeEntry[],
  options?: TestKnowledgeQueryOptions
): AITestMatchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return buildTestResult(trimmed, null, false);
  }

  const match = resolveKnowledgeMatchSync(trimmed, entries, {
    keywordOnly:
      options?.keywordOnly ??
      !(options?.semanticScores && options.semanticScores.size > 0),
    semanticScores: options?.semanticScores,
  });

  if (!match || (match.finalScore ?? match.score) < MATCH_SCORE_THRESHOLD) {
    return buildNoMatchFallback(trimmed, entries, Boolean(options?.semanticScores));
  }

  return buildTestResult(trimmed, match, Boolean(options?.semanticScores));
}

export async function testKnowledgeQueryAsync(
  query: string,
  entries: AIKnowledgeEntry[],
  supabase?: SupabaseClient<Database>,
  options?: TestKnowledgeQueryOptions
): Promise<AITestMatchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return buildTestResult(trimmed, null, false);
  }

  const match = await resolveKnowledgeMatch(trimmed, entries, supabase, options);
  const semanticAvailable = match?.semanticScore !== null && match?.semanticScore !== undefined;

  if (!match || (match.finalScore ?? match.score) < MATCH_SCORE_THRESHOLD) {
    const fallback = buildNoMatchFallback(trimmed, entries, semanticAvailable);
    if (match) {
      fallback.keywordScore = match.keywordScore ?? match.score;
      fallback.semanticScore = match.semanticScore ?? null;
      fallback.finalScore = match.finalScore ?? match.score;
      fallback.confidence = Math.round((match.finalScore ?? match.score) * 100);
    }
    return fallback;
  }

  return buildTestResult(trimmed, match, semanticAvailable);
}

export function rankAllForTest(query: string, entries: AIKnowledgeEntry[]) {
  return rankKnowledgeEntries(query, entries);
}
