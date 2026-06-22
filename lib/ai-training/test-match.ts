import type { AIKnowledgeEntry } from "./types";
import {
  rankKnowledgeEntries,
  scoreEntryWithMatches,
} from "./knowledge-search";
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

  const ranked = entries
    .map((entry) => scoreEntryWithMatches(trimmed, entry))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < MATCH_SCORE_THRESHOLD) {
    return {
      matched: false,
      confidence: Math.round((best?.score ?? 0) * 100),
      entry: null,
      matchedKeywords: best?.matchedKeywords ?? [],
      matchedPhrases: best?.matchedPhrases ?? [],
      answerPreview: null,
      category: null,
    };
  }

  const preview =
    best.entry.answer.length > 280
      ? `${best.entry.answer.slice(0, 280).trim()}…`
      : best.entry.answer;

  return {
    matched: true,
    confidence: Math.round(best.score * 100),
    entry: best.entry,
    matchedKeywords: best.matchedKeywords,
    matchedPhrases: best.matchedPhrases,
    answerPreview: preview,
    category: best.entry.category,
  };
}

export function rankAllForTest(query: string, entries: AIKnowledgeEntry[]) {
  return rankKnowledgeEntries(query, entries);
}
