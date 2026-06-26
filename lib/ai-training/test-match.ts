import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  rankKnowledgeEntries,
  scoreEntryWithMatches,
} from "./knowledge-search";
import { resolveKnowledgeMatchSync } from "./knowledge-retrieval";
import { resolveEntryIntent } from "./intent-registry";
import { formatClarificationResponse } from "./zero-cost-retrieval";
import type { IntentReasonSignal } from "./intent-reasoning";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";
import type { PublicSessionContext } from "./public-session-memory";

export interface AITestMatchResult {
  matched: boolean;
  confidence: number;
  entry: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  answerPreview: string | null;
  category: string | null;
  matchedIntentKey: string | null;
  matchedIntentName: string | null;
  finalScore: number;
  needsClarification: boolean;
  clarificationMessage: string | null;
  retrievalMode: "zero_cost";
  reasonSignals: IntentReasonSignal[];
  selectionSummary: string | null;
}

export interface TestKnowledgeQueryOptions {
  session?: PublicSessionContext;
}

function buildTestResult(
  query: string,
  result: ReturnType<typeof resolveKnowledgeMatchSync>
): AITestMatchResult {
  const baseSignals = result.reasonSignals ?? [];
  const baseSummary = result.selectionSummary ?? null;

  if (result.type === "clarification" && result.clarification) {
    return {
      matched: false,
      confidence: Math.round(result.clarification.topScore * 100),
      entry: null,
      matchedKeywords: [],
      matchedPhrases: [],
      answerPreview: null,
      category: null,
      matchedIntentKey: result.matchedIntentKey,
      matchedIntentName: null,
      finalScore: result.clarification.topScore,
      needsClarification: true,
      clarificationMessage: formatClarificationResponse(result.clarification),
      retrievalMode: "zero_cost",
      reasonSignals: baseSignals,
      selectionSummary: baseSummary,
    };
  }

  if (result.type === "match" && result.match) {
    const finalScore = result.match.finalScore ?? result.match.score;
    const detail = scoreEntryWithMatches(query, result.match.entry);
    const intent = resolveEntryIntent(result.match.entry);
    const preview =
      result.match.entry.answer.length > 280
        ? `${result.match.entry.answer.slice(0, 280).trim()}…`
        : result.match.entry.answer;

    return {
      matched: finalScore >= MATCH_SCORE_THRESHOLD,
      confidence: Math.round(finalScore * 100),
      entry: result.match.entry,
      matchedKeywords: detail.matchedKeywords,
      matchedPhrases: detail.matchedPhrases,
      answerPreview: preview,
      category: result.match.entry.category,
      matchedIntentKey: intent.intent_key,
      matchedIntentName: intent.intent_name,
      finalScore,
      needsClarification: false,
      clarificationMessage: null,
      retrievalMode: "zero_cost",
      reasonSignals: baseSignals,
      selectionSummary: baseSummary,
    };
  }

  const top = result.candidates[0];
  const fallbackDetail = top
    ? scoreEntryWithMatches(query, top.entry)
    : null;

  return {
    matched: false,
    confidence: Math.round((top?.score ?? 0) * 100),
    entry: null,
    matchedKeywords: fallbackDetail?.matchedKeywords ?? [],
    matchedPhrases: fallbackDetail?.matchedPhrases ?? [],
    answerPreview: null,
    category: null,
    matchedIntentKey: top?.breakdown.matchedIntentKey ?? null,
    matchedIntentName: top
      ? resolveEntryIntent(top.entry).intent_name
      : null,
    finalScore: top?.score ?? 0,
    needsClarification: false,
    clarificationMessage: null,
    retrievalMode: "zero_cost",
    reasonSignals: baseSignals,
    selectionSummary: baseSummary,
  };
}

export function testKnowledgeQuery(
  query: string,
  entries: AIKnowledgeEntry[],
  options?: TestKnowledgeQueryOptions
): AITestMatchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return buildTestResult(trimmed, {
      type: "no_match",
      match: null,
      clarification: null,
      candidates: [],
      expandedQuery: "",
      matchedIntentKey: null,
      reasonSignals: [],
      selectionSummary: null,
    });
  }

  const result = resolveKnowledgeMatchSync(trimmed, entries, {
    session: options?.session,
  });

  return buildTestResult(trimmed, result);
}

export async function testKnowledgeQueryAsync(
  query: string,
  entries: AIKnowledgeEntry[],
  _supabase?: SupabaseClient<Database>,
  options?: TestKnowledgeQueryOptions
): Promise<AITestMatchResult> {
  return testKnowledgeQuery(query, entries, options);
}

export function rankAllForTest(query: string, entries: AIKnowledgeEntry[]) {
  return rankKnowledgeEntries(query, entries);
}
