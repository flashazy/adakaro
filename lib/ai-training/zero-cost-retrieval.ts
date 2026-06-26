import {
  buildClarificationFromCandidates,
  formatClarificationAnswer,
  type ClarificationResult,
} from "./clarification";
import {
  applyIntentReasoning,
  buildRelatedIntentClarification,
  type IntentReasonSignal,
} from "./intent-reasoning";
import {
  expandQueryWithSession,
  type PublicSessionContext,
} from "./public-session-memory";
import {
  rankAllEntriesScored,
  type RankedKnowledgeEntry,
} from "./knowledge-scoring";
import { resolveEntryIntent } from "./intent-registry";
import { CLARIFICATION_AMBIGUITY_GAP, CLARIFICATION_MIN_SCORE } from "./retrieval-config";
import type { AIKnowledgeEntry, KnowledgeSearchMatch, UnansweredMatchDebug } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface ZeroCostRetrievalResult {
  type: "match" | "clarification" | "no_match";
  match: KnowledgeSearchMatch | null;
  clarification: ClarificationResult | null;
  candidates: RankedKnowledgeEntry[];
  expandedQuery: string;
  matchedIntentKey: string | null;
  reasonSignals: IntentReasonSignal[];
  selectionSummary: string | null;
}

function toSearchMatch(ranked: RankedKnowledgeEntry): KnowledgeSearchMatch {
  return {
    entry: ranked.entry,
    score: ranked.score,
    keywordScore: ranked.score,
    semanticScore: null,
    finalScore: ranked.score,
    matchedIntentKey: ranked.breakdown.matchedIntentKey,
  };
}

function buildRelatedClarification(
  ranked: RankedKnowledgeEntry[]
): ClarificationResult | null {
  if (ranked.length < 2) return null;

  const topScore = ranked[0]!.score;
  const secondScore = ranked[1]!.score;
  if (topScore - secondScore >= CLARIFICATION_AMBIGUITY_GAP) return null;

  const topIntents = ranked.slice(0, 3).map((c) => {
    return resolveEntryIntent(c.entry).intent_key;
  }).filter(Boolean) as string[];

  const message = buildRelatedIntentClarification(topIntents);
  if (!message) return null;

  const options = ranked.slice(0, 3).map((c) => {
    const intent = resolveEntryIntent(c.entry);
    return {
      intentKey: intent.intent_key,
      intentName: intent.intent_name ?? c.entry.question,
      question: c.entry.question,
      entryId: c.entry.id,
    };
  });

  return {
    message,
    options,
    topScore: ranked[0]?.score ?? 0,
  };
}

export function resolveZeroCostRetrieval(
  query: string,
  entries: AIKnowledgeEntry[],
  session?: PublicSessionContext
): ZeroCostRetrievalResult {
  const trimmed = query.trim();
  const empty: ZeroCostRetrievalResult = {
    type: "no_match",
    match: null,
    clarification: null,
    candidates: [],
    expandedQuery: trimmed,
    matchedIntentKey: null,
    reasonSignals: [],
    selectionSummary: null,
  };

  if (!trimmed || entries.length === 0) return empty;

  const expandedQuery = session
    ? expandQueryWithSession(trimmed, session)
    : trimmed;

  const context = { allEntries: entries, session };
  const baseRanked = rankAllEntriesScored(expandedQuery, entries, context);
  const reasoning = applyIntentReasoning(trimmed, baseRanked, session);
  const ranked = reasoning.ranked;
  const candidates = ranked.slice(0, 5);
  const best = ranked[0];

  if (!best || best.score < CLARIFICATION_MIN_SCORE) {
    return {
      ...empty,
      candidates,
      expandedQuery,
      reasonSignals: reasoning.signals,
      selectionSummary: reasoning.selectionSummary,
    };
  }

  if (best.score >= MATCH_SCORE_THRESHOLD) {
    const winner = best;
    return {
      type: "match",
      match: toSearchMatch(winner),
      clarification: null,
      candidates,
      expandedQuery,
      matchedIntentKey: resolveEntryIntent(winner.entry).intent_key,
      reasonSignals: reasoning.signals,
      selectionSummary: reasoning.selectionSummary,
    };
  }

  const relatedClarification = buildRelatedClarification(ranked);
  if (relatedClarification) {
    return {
      type: "clarification",
      match: null,
      clarification: relatedClarification,
      candidates,
      expandedQuery,
      matchedIntentKey: resolveEntryIntent(best.entry).intent_key,
      reasonSignals: reasoning.signals,
      selectionSummary: reasoning.selectionSummary,
    };
  }

  const clarification = buildClarificationFromCandidates(ranked);
  if (clarification) {
    return {
      type: "clarification",
      match: null,
      clarification,
      candidates,
      expandedQuery,
      matchedIntentKey: resolveEntryIntent(best.entry).intent_key,
      reasonSignals: reasoning.signals,
      selectionSummary: reasoning.selectionSummary,
    };
  }

  return {
    ...empty,
    candidates,
    expandedQuery,
    reasonSignals: reasoning.signals,
    selectionSummary: reasoning.selectionSummary,
  };
}

export function formatClarificationResponse(
  clarification: ClarificationResult
): string {
  return formatClarificationAnswer(clarification);
}

export function buildMatchDebugPayload(
  query: string,
  result: ZeroCostRetrievalResult
): UnansweredMatchDebug {
  return {
    query,
    expandedQuery: result.expandedQuery,
    topScore: result.candidates[0]?.score ?? 0,
    matchedIntentKey: result.matchedIntentKey,
    candidates: result.candidates.slice(0, 3).map((c) => ({
      entryId: c.entry.id,
      question: c.entry.question,
      intentKey: resolveEntryIntent(c.entry).intent_key,
      score: c.score,
    })),
    resultType: result.type,
    reasonSignals: result.reasonSignals.slice(0, 8).map((s) => s.detail),
    selectionSummary: result.selectionSummary ?? undefined,
  };
}

export type { IntentReasonSignal };
