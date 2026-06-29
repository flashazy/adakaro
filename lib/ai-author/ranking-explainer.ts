/**
 * Ranking Explainer — human-readable reasons for lesson scores.
 */

import type {
  LessonRankingExplanation,
  RankedLesson,
  RankingFactorBreakdown,
  ScoredFact,
} from "./types";
import type { QuestionContext } from "./context-engine";

function explainBreakdown(
  breakdown: RankingFactorBreakdown,
  questionContext: QuestionContext,
  entryQuestion: string
): string[] {
  const reasons: string[] = [];
  const intent = questionContext.route.intent;

  if (breakdown.intentMatch >= 60) reasons.push(`${capitalize(intent)} intent match`);
  if (breakdown.entityMatch >= 80) reasons.push("Same entity");
  if (breakdown.topicOverlap >= 55) reasons.push("High topic overlap");
  if (breakdown.questionType >= 85) reasons.push("Matching question type");
  if (breakdown.sectionRelevance >= 60) reasons.push("Relevant section structure");
  if (breakdown.categoryRelevance >= 75) reasons.push("Same category");
  if (breakdown.dependencyRelationship >= 85) reasons.push("Prerequisite lesson");
  else if (breakdown.dependencyRelationship >= 70) reasons.push("Related dependency");
  if (breakdown.metadataRelevance >= 50) reasons.push("Metadata overlap");
  if (breakdown.publishedConfidence >= 75) reasons.push("High published confidence");
  if (breakdown.coverageContribution >= 80) reasons.push("Foundation lesson");

  const q = entryQuestion.toLowerCase();
  if (intent === "identity" && /what is adakaro|who is adakaro|built for/.test(q)) {
    reasons.push("High audience relevance");
  }
  if (intent === "identity" && /archive|pricing|import/.test(q)) {
    reasons.push("Unrelated to identity question");
  }
  if (intent === "pricing" && /cost|pricing|free/.test(q)) {
    reasons.push("Direct pricing relevance");
  }

  if (reasons.length === 0) {
    if (breakdown.topicOverlap >= 30) reasons.push("Partial topic overlap");
    else reasons.push("Low contextual relevance");
  }

  return [...new Set(reasons)];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function explainLessonRankings(input: {
  allRanked: RankedLesson[];
  selectedLessons: RankedLesson[];
  questionContext: QuestionContext;
  factsByLesson: Map<string, ScoredFact[]>;
  usedFactIds: Set<string>;
}): LessonRankingExplanation[] {
  const selectedIds = new Set(input.selectedLessons.map((l) => l.entry.id));

  return input.allRanked.map((ranked) => {
    const lessonFacts = input.factsByLesson.get(ranked.entry.id) ?? [];
    const used = lessonFacts.filter((f) => input.usedFactIds.has(f.id));
    const discarded = lessonFacts.filter((f) => f.discarded);

    const confidence =
      used.length > 0
        ? Math.round(used.reduce((s, f) => s + f.relevanceScore, 0) / used.length)
        : lessonFacts.length > 0
          ? Math.round(
              lessonFacts.reduce((s, f) => s + f.relevanceScore, 0) / lessonFacts.length
            )
          : 0;

    return {
      question: ranked.entry.question,
      entryId: ranked.entry.id,
      score: ranked.score,
      selected: selectedIds.has(ranked.entry.id),
      reasons: explainBreakdown(ranked.breakdown, input.questionContext, ranked.entry.question),
      factsExtracted: lessonFacts.length,
      factsUsed: used.length,
      factsDiscarded: discarded.length,
      confidence,
      breakdown: ranked.breakdown,
    };
  });
}
