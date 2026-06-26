import {
  buildClarificationFromCandidates,
  formatClarificationAnswer,
  type ClarificationResult,
} from "./clarification";
import {
  expandQueryWithSession,
  type PublicSessionContext,
} from "./public-session-memory";
import {
  rankAllEntriesScored,
  rankKnowledgeEntriesScored,
  type RankedKnowledgeEntry,
} from "./knowledge-scoring";
import { resolveEntryIntent } from "./intent-registry";
import { CLARIFICATION_MIN_SCORE } from "./retrieval-config";
import type { AIKnowledgeEntry, KnowledgeSearchMatch, UnansweredMatchDebug } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface ZeroCostRetrievalResult {
  type: "match" | "clarification" | "no_match";
  match: KnowledgeSearchMatch | null;
  clarification: ClarificationResult | null;
  candidates: RankedKnowledgeEntry[];
  expandedQuery: string;
  matchedIntentKey: string | null;
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
  };

  if (!trimmed || entries.length === 0) return empty;

  const expandedQuery = session
    ? expandQueryWithSession(trimmed, session)
    : trimmed;

  const context = { allEntries: entries, session };
  const ranked = rankAllEntriesScored(expandedQuery, entries, context);
  const candidates = ranked.slice(0, 5);
  const best = ranked[0];

  if (!best || best.score < CLARIFICATION_MIN_SCORE) {
    return { ...empty, candidates, expandedQuery };
  }

  if (best.score >= MATCH_SCORE_THRESHOLD) {
    const strong = rankKnowledgeEntriesScored(expandedQuery, entries, context);
    const winner = strong[0] ?? best;
    return {
      type: "match",
      match: toSearchMatch(winner),
      clarification: null,
      candidates,
      expandedQuery,
      matchedIntentKey: winner.breakdown.matchedIntentKey,
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
      matchedIntentKey: best.breakdown.matchedIntentKey,
    };
  }

  return { ...empty, candidates, expandedQuery };
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
  };
}
