import {
  KEYWORD_CANDIDATE_MIN_FOR_LIFT,
  KEYWORD_WEIGHT,
  KEYWORD_WEAK_THRESHOLD,
  SEMANTIC_FALLBACK_THRESHOLD,
  SEMANTIC_HIGH_CONFIDENCE,
  SEMANTIC_MIN_FOR_WEAK_KEYWORD,
  SEMANTIC_WEIGHT,
} from "./embedding-config";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import type { AIKnowledgeEntry, KnowledgeSearchMatch } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export function combineRetrievalScores(
  keywordScore: number,
  semanticScore: number,
  options?: { semanticOnly?: boolean }
): number {
  if (options?.semanticOnly && keywordScore === 0) {
    return semanticScore;
  }

  const blended = keywordScore * KEYWORD_WEIGHT + semanticScore * SEMANTIC_WEIGHT;

  if (
    semanticScore >= SEMANTIC_HIGH_CONFIDENCE &&
    keywordScore < MATCH_SCORE_THRESHOLD
  ) {
    return Math.max(blended, semanticScore * 0.85);
  }

  return blended;
}

export function passesRetrievalThreshold(
  keywordScore: number,
  semanticScore: number | null,
  finalScore: number
): boolean {
  if (keywordScore === 0 && semanticScore !== null) {
    return semanticScore >= SEMANTIC_FALLBACK_THRESHOLD;
  }

  if (finalScore < MATCH_SCORE_THRESHOLD) return false;

  if (keywordScore < KEYWORD_WEAK_THRESHOLD) {
    if (semanticScore === null) return false;
    if (semanticScore < SEMANTIC_MIN_FOR_WEAK_KEYWORD) return false;
  }

  return true;
}

export interface SemanticRerankInput {
  keywordCandidates: RankedKnowledgeEntry[];
  semanticScoresByEntryId: Map<string, number>;
}

export function rerankWithSemanticScores(
  input: SemanticRerankInput
): KnowledgeSearchMatch[] {
  const { keywordCandidates, semanticScoresByEntryId } = input;

  const ranked = keywordCandidates
    .map((candidate) => {
      const keywordScore = candidate.score;
      const semanticScore =
        semanticScoresByEntryId.get(candidate.entry.id) ?? null;

      const finalScore =
        semanticScore !== null
          ? combineRetrievalScores(keywordScore, semanticScore)
          : keywordScore;

      const match: KnowledgeSearchMatch = {
        entry: candidate.entry,
        score: finalScore,
        keywordScore,
        semanticScore,
        finalScore,
      };

      return match;
    })
    .sort((a, b) => {
      const finalDiff = (b.finalScore ?? b.score) - (a.finalScore ?? a.score);
      if (Math.abs(finalDiff) > 0.005) return finalDiff;

      const semanticDiff = (b.semanticScore ?? 0) - (a.semanticScore ?? 0);
      if (Math.abs(semanticDiff) > 0.005) return semanticDiff;

      return b.keywordScore! - a.keywordScore!;
    });

  return ranked.filter((match) =>
    passesRetrievalThreshold(
      match.keywordScore ?? match.score,
      match.semanticScore ?? null,
      match.finalScore ?? match.score
    )
  );
}

export function canSemanticLift(
  keywordScore: number,
  semanticScore: number
): boolean {
  return (
    semanticScore >= SEMANTIC_HIGH_CONFIDENCE &&
    keywordScore >= KEYWORD_CANDIDATE_MIN_FOR_LIFT
  );
}

export function buildSemanticOnlyMatch(
  entry: AIKnowledgeEntry,
  semanticScore: number
): KnowledgeSearchMatch {
  const keywordScore = 0;
  const finalScore = combineRetrievalScores(keywordScore, semanticScore, {
    semanticOnly: true,
  });

  return {
    entry,
    score: finalScore,
    keywordScore,
    semanticScore,
    finalScore,
  };
}

export function pickBestSemanticFallback(
  entries: AIKnowledgeEntry[],
  semanticScoresByEntryId: Map<string, number>,
  threshold: number
): KnowledgeSearchMatch | null {
  let best: KnowledgeSearchMatch | null = null;

  for (const entry of entries) {
    const semanticScore = semanticScoresByEntryId.get(entry.id);
    if (semanticScore === undefined || semanticScore < threshold) continue;

    const candidate = buildSemanticOnlyMatch(entry, semanticScore);
    if (
      !best ||
      (candidate.finalScore ?? 0) > (best.finalScore ?? best.score)
    ) {
      best = candidate;
    }
  }

  if (!best) return null;

  return passesRetrievalThreshold(
    best.keywordScore ?? 0,
    best.semanticScore ?? null,
    best.finalScore ?? best.score
  )
    ? best
    : null;
}
