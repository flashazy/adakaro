import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { SEMANTIC_FALLBACK_THRESHOLD } from "./embedding-config";
import {
  rankKeywordCandidates,
  rankKnowledgeEntriesScored,
  type RankedKnowledgeEntry,
} from "./knowledge-scoring";
import {
  pickBestSemanticFallback,
  rerankWithSemanticScores,
} from "./knowledge-semantic-rerank";
import type { AIKnowledgeEntry, KnowledgeSearchMatch } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface ResolveKnowledgeMatchOptions {
  /** Inject semantic scores for tests (entry id → score). */
  semanticScores?: Map<string, number>;
  /** Skip live embedding API and database lookups. */
  keywordOnly?: boolean;
}

function keywordOnlyMatch(
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
  };
}

function resolveWithInjectedSemanticScores(
  query: string,
  entries: AIKnowledgeEntry[],
  semanticScores: Map<string, number>
): KnowledgeSearchMatch | null {
  const keywordCandidates = rankKeywordCandidates(query, entries);

  if (keywordCandidates.length > 0) {
    const reranked = rerankWithSemanticScores({
      keywordCandidates,
      semanticScoresByEntryId: semanticScores,
    });
    if (reranked[0]) return reranked[0];
  }

  return pickBestSemanticFallback(
    entries,
    semanticScores,
    SEMANTIC_FALLBACK_THRESHOLD
  );
}

async function resolveWithLiveSemantic(
  query: string,
  entries: AIKnowledgeEntry[],
  supabase: SupabaseClient<Database>
): Promise<KnowledgeSearchMatch | null> {
  const {
    generateEmbedding,
    isEmbeddingConfigured,
    loadEmbeddingsForEntryIds,
    semanticScoresFromEmbeddings,
    semanticSearchAllActive,
  } = await import("./embeddings");

  if (!isEmbeddingConfigured()) return null;

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return null;

  const keywordCandidates = rankKeywordCandidates(query, entries);
  const hasStrongKeywordCandidate = keywordCandidates.some(
    (c) => c.score >= MATCH_SCORE_THRESHOLD
  );

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

    if (hasStrongKeywordCandidate) {
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

  if (fallbackScores.size === 0) return null;

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
): KnowledgeSearchMatch | null {
  const trimmed = query.trim();
  if (!trimmed || entries.length === 0) return null;

  if (options?.semanticScores?.size) {
    return resolveWithInjectedSemanticScores(
      trimmed,
      entries,
      options.semanticScores
    );
  }

  return keywordOnlyMatch(trimmed, entries);
}

export async function resolveKnowledgeMatch(
  query: string,
  entries: AIKnowledgeEntry[],
  supabase?: SupabaseClient<Database>,
  options?: ResolveKnowledgeMatchOptions
): Promise<KnowledgeSearchMatch | null> {
  const trimmed = query.trim();
  if (!trimmed || entries.length === 0) return null;

  if (options?.keywordOnly) {
    return keywordOnlyMatch(trimmed, entries);
  }

  if (options?.semanticScores?.size) {
    return resolveWithInjectedSemanticScores(
      trimmed,
      entries,
      options.semanticScores
    );
  }

  if (supabase) {
    try {
      const semanticMatch = await resolveWithLiveSemantic(
        trimmed,
        entries,
        supabase
      );
      if (semanticMatch) return semanticMatch;
    } catch (error) {
      console.error("[ai-training] semantic retrieval failed:", error);
    }
  }

  return keywordOnlyMatch(trimmed, entries);
}

export function getKeywordCandidatesForTest(
  query: string,
  entries: AIKnowledgeEntry[]
): RankedKnowledgeEntry[] {
  return rankKeywordCandidates(query, entries);
}
