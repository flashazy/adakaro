import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { isPaidEmbeddingsEnabled, isZeroCostRetrievalEnabled } from "./retrieval-config";
import {
  rankKnowledgeEntriesScored,
  type RankedKnowledgeEntry,
  rankKeywordCandidates,
} from "./knowledge-scoring";
import {
  buildMatchDebugPayload,
  resolveZeroCostRetrieval,
  type ZeroCostRetrievalResult,
} from "./zero-cost-retrieval";
import type { PublicSessionContext } from "./public-session-memory";
import type { AIKnowledgeEntry, KnowledgeSearchMatch } from "./types";

export type { ZeroCostRetrievalResult };

export interface ResolveKnowledgeMatchOptions {
  session?: PublicSessionContext;
  /** @deprecated Paid semantic path — only when PAID_EMBEDDINGS_ENABLED=true */
  semanticScores?: Map<string, number>;
  keywordOnly?: boolean;
}

function zeroCostMatch(
  query: string,
  entries: AIKnowledgeEntry[],
  session?: PublicSessionContext
): ZeroCostRetrievalResult {
  return resolveZeroCostRetrieval(query, entries, session);
}

function legacyKeywordMatch(
  query: string,
  entries: AIKnowledgeEntry[]
): KnowledgeSearchMatch | null {
  const ranked = rankKnowledgeEntriesScored(query, entries);
  const best = ranked[0];
  if (!best) return null;

  return {
    entry: best.entry,
    score: best.score,
    keywordScore: best.score,
    semanticScore: null,
    finalScore: best.score,
    matchedIntentKey: best.breakdown.matchedIntentKey,
  };
}

async function resolveWithLiveSemantic(
  query: string,
  entries: AIKnowledgeEntry[],
  supabase: SupabaseClient<Database>
): Promise<KnowledgeSearchMatch | null> {
  const { SEMANTIC_FALLBACK_THRESHOLD } = await import("./embedding-config");
  const {
    generateEmbedding,
    isEmbeddingConfigured,
    loadEmbeddingsForEntryIds,
    semanticScoresFromEmbeddings,
    semanticSearchAllActive,
  } = await import("./embeddings");
  const { rerankWithSemanticScores, pickBestSemanticFallback } = await import(
    "./knowledge-semantic-rerank"
  );
  const { MATCH_SCORE_THRESHOLD } = await import("./types");

  if (!isEmbeddingConfigured()) return null;

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return null;

  const keywordCandidates = rankKeywordCandidates(query, entries);

  if (keywordCandidates.length > 0) {
    const candidateIds = keywordCandidates.map((c) => c.entry.id);
    const storedEmbeddings = await loadEmbeddingsForEntryIds(
      supabase,
      candidateIds
    );

    if (storedEmbeddings.size > 0) {
      const semanticScores = semanticScoresFromEmbeddings(
        queryEmbedding,
        storedEmbeddings
      );
      const reranked = rerankWithSemanticScores({
        keywordCandidates,
        semanticScoresByEntryId: semanticScores,
      });
      if (reranked[0]) return reranked[0];
    }

    if (keywordCandidates.some((c) => c.score >= MATCH_SCORE_THRESHOLD)) {
      const best = keywordCandidates[0]!;
      return {
        entry: best.entry,
        score: best.score,
        keywordScore: best.score,
        semanticScore: null,
        finalScore: best.score,
      };
    }
  }

  const fallbackScores = await semanticSearchAllActive(
    supabase,
    queryEmbedding,
    SEMANTIC_FALLBACK_THRESHOLD,
    10
  );

  return pickBestSemanticFallback(
    entries,
    fallbackScores,
    SEMANTIC_FALLBACK_THRESHOLD
  );
}

export function resolveKnowledgeMatchSync(
  query: string,
  entries: AIKnowledgeEntry[],
  options?: ResolveKnowledgeMatchOptions
): ZeroCostRetrievalResult {
  return zeroCostMatch(query, entries, options?.session);
}

export async function resolveKnowledgeMatch(
  query: string,
  entries: AIKnowledgeEntry[],
  supabase?: SupabaseClient<Database>,
  options?: ResolveKnowledgeMatchOptions
): Promise<ZeroCostRetrievalResult> {
  if (isZeroCostRetrievalEnabled()) {
    return zeroCostMatch(query, entries, options?.session);
  }

  if (
    isPaidEmbeddingsEnabled() &&
    supabase &&
    !options?.keywordOnly
  ) {
    try {
      const semanticMatch = await resolveWithLiveSemantic(
        query,
        entries,
        supabase
      );
      if (semanticMatch) {
        return {
          type: "match",
          match: semanticMatch,
          clarification: null,
          candidates: [],
          expandedQuery: query,
          matchedIntentKey: semanticMatch.matchedIntentKey ?? null,
          reasonSignals: [],
          selectionSummary: null,
        };
      }
    } catch (error) {
      console.error("[ai-training] paid semantic retrieval failed:", error);
    }
  }

  const legacy = legacyKeywordMatch(query, entries);
  if (legacy) {
    return {
      type: "match",
      match: legacy,
      clarification: null,
      candidates: [],
      expandedQuery: query,
      matchedIntentKey: legacy.matchedIntentKey ?? null,
      reasonSignals: [],
      selectionSummary: null,
    };
  }

  return zeroCostMatch(query, entries, options?.session);
}

export function getKeywordCandidatesForTest(
  query: string,
  entries: AIKnowledgeEntry[]
): RankedKnowledgeEntry[] {
  return rankKeywordCandidates(query, entries);
}

export { buildMatchDebugPayload };
