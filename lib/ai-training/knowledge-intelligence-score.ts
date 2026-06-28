/**
 * Knowledge Intelligence Scorecard (Phase 13).
 */

import { validateKnowledgeWritingStandard } from "./knowledge-writing-standard";
import { computeKnowledgeStrength, strengthToScore } from "./knowledge-strength";
import type { IntelligenceScorecard } from "./knowledge-intelligence-types";
import type { AIKnowledgeEntry } from "./types";

export function computeEntryScorecard(
  entry: AIKnowledgeEntry,
  options?: {
    qualityScore?: number;
    confidence?: number;
    coverageContribution?: number;
    dependencyHealth?: number;
  }
): IntelligenceScorecard {
  const strength = computeKnowledgeStrength(entry);
  const writing = validateKnowledgeWritingStandard({
    category: entry.category,
    question: entry.question,
    answer: entry.answer,
    keywords: entry.keywords,
    search_phrases: entry.search_phrases,
    alternative_wording: entry.alternative_wording,
    synonyms: entry.synonyms,
    related_terms: entry.related_terms,
    priority: entry.priority,
    intent_key: entry.intent_key,
  });

  const knowledgeQuality =
    options?.qualityScore ??
    (writing.requiredPassed ? 88 : 72) - writing.issues.length * 4;

  const keywordRichness = Math.min(
    100,
    entry.keywords.length * 8 +
      entry.synonyms.length * 6 +
      entry.search_phrases.length * 6 +
      entry.alternative_wording.length * 5
  );

  const daysSinceUpdate =
    (Date.now() - new Date(entry.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const freshness = daysSinceUpdate < 14 ? 98 : daysSinceUpdate < 60 ? 85 : daysSinceUpdate < 120 ? 70 : 50;

  const usageScore = Math.min(100, Math.log10(entry.usage_count + 1) * 35 + 30);

  const scorecard: IntelligenceScorecard = {
    knowledgeQuality: Math.round(knowledgeQuality),
    reviewerConfidence: options?.confidence ?? Math.min(95, Math.round(knowledgeQuality * 0.92)),
    knowledgeStrength: strengthToScore(strength),
    coverageContribution: options?.coverageContribution ?? Math.min(100, entry.keywords.length * 10),
    retrievalReadiness: Math.round(keywordRichness * 0.85 + (entry.search_phrases.length > 0 ? 15 : 0)),
    freshness: Math.round(freshness),
    dependencyHealth: options?.dependencyHealth ?? (entry.related_intents?.length ? 85 : 65),
    keywordRichness: Math.round(keywordRichness),
    aiReliability: Math.round((knowledgeQuality + usageScore) / 2),
    learningValue: Math.round(usageScore * 0.6 + keywordRichness * 0.4),
    composite: 0,
  };

  scorecard.composite = Math.round(
    scorecard.knowledgeQuality * 0.2 +
      scorecard.reviewerConfidence * 0.15 +
      scorecard.knowledgeStrength * 0.1 +
      scorecard.retrievalReadiness * 0.15 +
      scorecard.freshness * 0.1 +
      scorecard.aiReliability * 0.15 +
      scorecard.learningValue * 0.15
  );

  return scorecard;
}

export function aggregateScorecard(entries: AIKnowledgeEntry[]): IntelligenceScorecard {
  if (entries.length === 0) {
    return {
      knowledgeQuality: 0,
      reviewerConfidence: 0,
      knowledgeStrength: 0,
      coverageContribution: 0,
      retrievalReadiness: 0,
      freshness: 0,
      dependencyHealth: 0,
      keywordRichness: 0,
      aiReliability: 0,
      learningValue: 0,
      composite: 0,
    };
  }
  const cards = entries.map((e) => computeEntryScorecard(e));
  const keys = Object.keys(cards[0]) as Array<keyof IntelligenceScorecard>;
  const avg = {} as IntelligenceScorecard;
  for (const key of keys) {
    avg[key] = Math.round(cards.reduce((s, c) => s + c[key], 0) / cards.length);
  }
  return avg;
}

export function scorecardToRadarData(
  scorecard: IntelligenceScorecard
): Array<{ axis: string; value: number }> {
  return [
    { axis: "Quality", value: scorecard.knowledgeQuality },
    { axis: "Confidence", value: scorecard.reviewerConfidence },
    { axis: "Strength", value: scorecard.knowledgeStrength },
    { axis: "Coverage", value: scorecard.coverageContribution },
    { axis: "Retrieval", value: scorecard.retrievalReadiness },
    { axis: "Freshness", value: scorecard.freshness },
    { axis: "Dependencies", value: scorecard.dependencyHealth },
    { axis: "Keywords", value: scorecard.keywordRichness },
    { axis: "Reliability", value: scorecard.aiReliability },
    { axis: "Learning", value: scorecard.learningValue },
  ];
}
