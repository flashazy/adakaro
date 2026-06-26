import type { AIKnowledgeEntry } from "./types";
import {
  rankKnowledgeEntries,
  scoreEntryWithMatches,
} from "./knowledge-search";
import { scoreEntry } from "./knowledge-scoring";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface AITestMatchResult {
  matched: boolean;
  confidence: number;
  entry: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  answerPreview: string | null;
  category: string | null;
}

export function testKnowledgeQuery(
  query: string,
  entries: AIKnowledgeEntry[]
): AITestMatchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      matched: false,
      confidence: 0,
      entry: null,
      matchedKeywords: [],
      matchedPhrases: [],
      answerPreview: null,
      category: null,
    };
  }

  const ranked = rankKnowledgeEntries(trimmed, entries);
  const bestRanked = ranked[0];

  if (!bestRanked || bestRanked.score < MATCH_SCORE_THRESHOLD) {
    const topEntry = [...entries].sort(
      (a, b) => scoreEntry(trimmed, b) - scoreEntry(trimmed, a)
    )[0];
    const fallbackDetail = topEntry
      ? scoreEntryWithMatches(trimmed, topEntry)
      : null;

    return {
      matched: false,
      confidence: Math.round((fallbackDetail?.score ?? 0) * 100),
      entry: null,
      matchedKeywords: fallbackDetail?.matchedKeywords ?? [],
      matchedPhrases: fallbackDetail?.matchedPhrases ?? [],
      answerPreview: null,
      category: null,
    };
  }

  const bestDetail = scoreEntryWithMatches(trimmed, bestRanked.entry);
  const preview =
    bestRanked.entry.answer.length > 280
      ? `${bestRanked.entry.answer.slice(0, 280).trim()}…`
      : bestRanked.entry.answer;

  return {
    matched: true,
    confidence: Math.round(bestRanked.score * 100),
    entry: bestRanked.entry,
    matchedKeywords: bestDetail.matchedKeywords,
    matchedPhrases: bestDetail.matchedPhrases,
    answerPreview: preview,
    category: bestRanked.entry.category,
  };
}

export function rankAllForTest(query: string, entries: AIKnowledgeEntry[]) {
  return rankKnowledgeEntries(query, entries);
}
