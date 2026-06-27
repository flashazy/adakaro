import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  rankKnowledgeEntries,
  scoreEntryWithMatches,
} from "./knowledge-search";
import { rankAllEntriesScored } from "./knowledge-scoring";
import { normalizeQuestionForDedup } from "./keyword-generator";
import { resolveKnowledgeMatchSync } from "./knowledge-retrieval";
import { formatClarificationResponse } from "./zero-cost-retrieval";
import {
  buildAdvancedTestDebug,
  buildRetrievalObservability,
  type AdvancedTestDebug,
  type RetrievalMethod,
  type ResponseSource,
  type DisplayHealthStatus,
} from "./retrieval-observability";
import {
  buildEnterpriseConsoleDebug,
  buildVersionTimeline,
  type EnterpriseConsoleDebug,
} from "./test-observability-console";
import type { IntentReasonSignal } from "./intent-reasoning";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";
import type { PublicSessionContext } from "./public-session-memory";
import type { ZeroCostRetrievalResult } from "./zero-cost-retrieval";

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
  matchedIntent: string | null;
  matchedCategory: string | null;
  matchedEntryId: string | null;
  matchedQuestion: string | null;
  retrievalMethod: RetrievalMethod | null;
  matchScore: number;
  matchedSearchPhrase: string | null;
  knowledgeVersion: number | null;
  isPrimaryEntry: boolean;
  healthStatus: DisplayHealthStatus | null;
  retrievalExplanation: string;
  responseSource: ResponseSource;
  noMatchReason: string | null;
  advanced: AdvancedTestDebug;
  console: EnterpriseConsoleDebug;
}

export interface TestKnowledgeQueryOptions {
  session?: PublicSessionContext;
  loadEntriesMs?: number;
  versionHistory?: Array<{
    id: string;
    version_number: number;
    question: string;
    created_at: string;
  }>;
}

interface BuildTestContext {
  query: string;
  retrievalResult: ZeroCostRetrievalResult;
  entries: AIKnowledgeEntry[];
  timings: {
    loadEntriesMs: number;
    queryProcessingMs: number;
    retrievalMs: number;
    rankingMs: number;
    observabilityMs: number;
    answerPreviewMs: number;
  };
  versionHistory?: TestKnowledgeQueryOptions["versionHistory"];
}

function withObservability(
  base: Omit<
    AITestMatchResult,
    | "matchedIntent"
    | "matchedCategory"
    | "matchedEntryId"
    | "matchedQuestion"
    | "retrievalMethod"
    | "matchScore"
    | "matchedSearchPhrase"
    | "knowledgeVersion"
    | "isPrimaryEntry"
    | "healthStatus"
    | "retrievalExplanation"
    | "responseSource"
    | "noMatchReason"
    | "advanced"
    | "console"
  >,
  ctx: BuildTestContext,
  entry: AIKnowledgeEntry | null,
  detail?: { matchedKeywords: string[]; matchedPhrases: string[] }
): AITestMatchResult {
  const { query, retrievalResult, entries, timings, versionHistory } = ctx;

  const observability = buildRetrievalObservability(query, entry, retrievalResult, {
    matchedKeywords: detail?.matchedKeywords ?? base.matchedKeywords,
    matchedPhrases: detail?.matchedPhrases ?? base.matchedPhrases,
    semanticScore: retrievalResult.match?.semanticScore,
    allEntries: entries,
  });

  const merged = {
    ...base,
    matchedIntentKey:
      observability.matchedIntentKey ?? base.matchedIntentKey,
    matchedIntentName:
      observability.matchedIntentName ?? base.matchedIntentName,
    category: observability.matchedCategory ?? base.category,
    matchedIntent: observability.matchedIntent,
    matchedCategory: observability.matchedCategory,
    matchedEntryId: observability.matchedEntryId,
    matchedQuestion: observability.matchedQuestion,
    retrievalMethod: observability.retrievalMethod,
    matchScore: observability.matchScore,
    matchedSearchPhrase: observability.matchedSearchPhrase,
    knowledgeVersion: observability.knowledgeVersion,
    isPrimaryEntry: observability.isPrimaryEntry,
    healthStatus: observability.healthStatus,
    retrievalExplanation: observability.retrievalExplanation,
    responseSource: observability.responseSource,
    noMatchReason: observability.noMatchReason,
  };

  const obsStart = performance.now();
  const advanced = buildAdvancedTestDebug(query, retrievalResult, entries, {
    matched: merged.matched,
    confidencePercent: merged.confidence,
    winnerEntryId: merged.matchedEntryId,
    winnerEntry: merged.entry,
    matchedKeywords: merged.matchedKeywords,
    matchedPhrases: merged.matchedPhrases,
  });
  const observabilityBuildMs = performance.now() - obsStart;

  const totalMs =
    timings.loadEntriesMs +
    timings.queryProcessingMs +
    timings.retrievalMs +
    timings.rankingMs +
    observabilityBuildMs +
    timings.answerPreviewMs;

  const console = buildEnterpriseConsoleDebug({
    query,
    entries,
    retrievalResult,
    advanced,
    matched: merged.matched,
    needsClarification: merged.needsClarification,
    confidencePercent: merged.confidence,
    winner: merged.entry,
    matchedKeywords: merged.matchedKeywords,
    matchedPhrases: merged.matchedPhrases,
    performance: {
      totalMs: Math.round(totalMs),
      loadEntriesMs: Math.round(timings.loadEntriesMs),
      queryProcessingMs: Math.round(timings.queryProcessingMs),
      retrievalMs: Math.round(timings.retrievalMs),
      rankingMs: Math.round(timings.rankingMs),
      observabilityMs: Math.round(observabilityBuildMs),
      answerPreviewMs: Math.round(timings.answerPreviewMs),
    },
    versionTimeline: buildVersionTimeline(
      merged.entry,
      versionHistory ?? []
    ),
  });

  return { ...merged, advanced, console };
}

function buildTestResult(
  ctx: BuildTestContext
): AITestMatchResult {
  const { query, retrievalResult, entries } = ctx;
  const baseSignals = retrievalResult.reasonSignals ?? [];
  const baseSummary = retrievalResult.selectionSummary ?? null;

  if (retrievalResult.type === "clarification" && retrievalResult.clarification) {
    const topEntry = retrievalResult.candidates[0]?.entry ?? null;
    const detail = topEntry ? scoreEntryWithMatches(query, topEntry) : null;

    return withObservability(
      {
        matched: false,
        confidence: Math.round(retrievalResult.clarification.topScore * 100),
        entry: null,
        matchedKeywords: detail?.matchedKeywords ?? [],
        matchedPhrases: detail?.matchedPhrases ?? [],
        answerPreview: null,
        category: topEntry?.category ?? null,
        matchedIntentKey: retrievalResult.matchedIntentKey,
        matchedIntentName: null,
        finalScore: retrievalResult.clarification.topScore,
        needsClarification: true,
        clarificationMessage: formatClarificationResponse(
          retrievalResult.clarification
        ),
        retrievalMode: "zero_cost",
        reasonSignals: baseSignals,
        selectionSummary: baseSummary,
      },
      ctx,
      null,
      detail ?? undefined
    );
  }

  if (retrievalResult.type === "match" && retrievalResult.match) {
    const finalScore =
      retrievalResult.match.finalScore ?? retrievalResult.match.score;
    const detail = scoreEntryWithMatches(query, retrievalResult.match.entry);
    const previewStart = performance.now();
    const preview =
      retrievalResult.match.entry.answer.length > 280
        ? `${retrievalResult.match.entry.answer.slice(0, 280).trim()}…`
        : retrievalResult.match.entry.answer;
    ctx.timings.answerPreviewMs = performance.now() - previewStart;

    return withObservability(
      {
        matched: finalScore >= MATCH_SCORE_THRESHOLD,
        confidence: Math.round(finalScore * 100),
        entry: retrievalResult.match.entry,
        matchedKeywords: detail.matchedKeywords,
        matchedPhrases: detail.matchedPhrases,
        answerPreview: preview,
        category: retrievalResult.match.entry.category,
        matchedIntentKey: null,
        matchedIntentName: null,
        finalScore,
        needsClarification: false,
        clarificationMessage: null,
        retrievalMode: "zero_cost",
        reasonSignals: baseSignals,
        selectionSummary: baseSummary,
      },
      ctx,
      retrievalResult.match.entry,
      detail
    );
  }

  const top = retrievalResult.candidates[0];
  const fallbackDetail = top
    ? scoreEntryWithMatches(query, top.entry)
    : null;

  return withObservability(
    {
      matched: false,
      confidence: Math.round((top?.score ?? 0) * 100),
      entry: null,
      matchedKeywords: fallbackDetail?.matchedKeywords ?? [],
      matchedPhrases: fallbackDetail?.matchedPhrases ?? [],
      answerPreview: null,
      category: top?.entry.category ?? null,
      matchedIntentKey: top?.breakdown.matchedIntentKey ?? null,
      matchedIntentName: null,
      finalScore: top?.score ?? 0,
      needsClarification: false,
      clarificationMessage: null,
      retrievalMode: "zero_cost",
      reasonSignals: baseSignals,
      selectionSummary: baseSummary,
    },
    ctx,
    null,
    fallbackDetail ?? undefined
  );
}

export function testKnowledgeQuery(
  query: string,
  entries: AIKnowledgeEntry[],
  options?: TestKnowledgeQueryOptions
): AITestMatchResult {
  const emptyResult: ZeroCostRetrievalResult = {
    type: "no_match",
    match: null,
    clarification: null,
    candidates: [],
    expandedQuery: "",
    matchedIntentKey: null,
    reasonSignals: [],
    selectionSummary: null,
  };

  const timings = {
    loadEntriesMs: options?.loadEntriesMs ?? 0,
    queryProcessingMs: 0,
    retrievalMs: 0,
    rankingMs: 0,
    observabilityMs: 0,
    answerPreviewMs: 0,
  };

  const qpStart = performance.now();
  const trimmed = query.trim();
  if (trimmed) normalizeQuestionForDedup(trimmed);
  timings.queryProcessingMs = performance.now() - qpStart;

  if (!trimmed) {
    return buildTestResult({
      query: trimmed,
      retrievalResult: emptyResult,
      entries,
      timings,
      versionHistory: options?.versionHistory,
    });
  }

  const retrievalStart = performance.now();
  const retrievalResult = resolveKnowledgeMatchSync(trimmed, entries, {
    session: options?.session,
  });
  timings.retrievalMs = performance.now() - retrievalStart;

  const rankingStart = performance.now();
  rankAllEntriesScored(trimmed, entries, { allEntries: entries });
  timings.rankingMs = performance.now() - rankingStart;

  return buildTestResult({
    query: trimmed,
    retrievalResult,
    entries,
    timings,
    versionHistory: options?.versionHistory,
  });
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
