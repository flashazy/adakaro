/**
 * Lesson Ranker V3 — weighted contextual ranking with wide score separation.
 */

import { normalizeText } from "@/lib/ai-training/knowledge-scoring";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";
import type { QuestionContext } from "./context-engine";
import type { AuthorIntent, RankedLesson, RankingFactorBreakdown } from "./types";
import { LESSON_RANK_MAX, LESSON_RANK_THRESHOLD } from "./types";

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter((t) => setB.has(t)).length;
  return Math.round((matches / Math.max(a.length, b.length)) * 100);
}

function categorySimilarity(questionCategory: string, entryCategory: string): number {
  const a = questionCategory.trim().toLowerCase();
  const b = entryCategory.trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

function dependencyScore(
  entry: AIKnowledgeEntry,
  prerequisiteQuestions: string[],
  relatedQuestions: string[]
): number {
  const q = normalizeText(entry.question);
  const prereq = prerequisiteQuestions.map((p) => normalizeText(p));
  const related = relatedQuestions.map((r) => normalizeText(r));
  if (prereq.includes(q)) return 100;
  if (related.includes(q)) return 85;
  return 0;
}

function metadataScore(
  entry: AIKnowledgeEntry,
  keywords: string[],
  relatedTerms: string[]
): number {
  const metaTokens = [
    ...entry.keywords,
    ...entry.synonyms,
    ...entry.search_phrases,
    ...entry.related_terms,
    ...keywords,
    ...relatedTerms,
  ].flatMap((t) => tokenize(t));

  const questionTokens = tokenize(keywords.join(" "));
  if (questionTokens.length === 0) return 0;
  return overlapScore(questionTokens, metaTokens);
}

function questionTypeScore(
  intent: AuthorIntent,
  entry: AIKnowledgeEntry
): number {
  const q = entry.question.toLowerCase();
  switch (intent) {
    case "identity":
      if (/^what is\b|^who is\b|^why choose\b/.test(q)) return 95;
      if (/built for|audience|who uses/.test(q)) return 92;
      return 20;
    case "capabilities":
      if (/what can|what does|features|modules/.test(q)) return 95;
      return 25;
    case "process":
      if (/^how do i|^how to|^how can/.test(q)) return 95;
      return 20;
    case "pricing":
      if (/cost|pricing|price|free plan|subscription/.test(q)) return 95;
      return 15;
    default:
      return 50;
  }
}

function sectionRelevanceScore(
  intent: AuthorIntent,
  entry: AIKnowledgeEntry
): number {
  const answer = entry.answer.toLowerCase();
  const headings = (entry.answer.match(/\*\*([^*]+)\*\*/g) ?? []).map((h) =>
    h.replace(/\*\*/g, "").toLowerCase()
  );

  const intentSections: Record<AuthorIntent, string[]> = {
    identity: ["overview", "audience", "purpose", "key facts"],
    capabilities: ["overview", "capabilities", "modules", "benefits"],
    process: ["overview", "requirements", "steps", "expected result"],
    pricing: ["overview", "plans", "limits", "billing"],
    finance: ["overview", "how it works", "configuration"],
    general: ["overview", "purpose", "key facts"],
  };

  const expected = intentSections[intent] ?? intentSections.general;
  const matches = expected.filter((s) =>
    headings.some((h) => h.includes(s)) || answer.includes(s)
  ).length;

  return Math.round((matches / Math.max(1, expected.length)) * 100);
}

function publishedConfidenceScore(entry: AIKnowledgeEntry): number {
  let score = 55;
  if (entry.keywords.length >= 2) score += 15;
  if (entry.search_phrases.length >= 1) score += 10;
  if (entry.answer.length >= 120) score += 15;
  if (entry.priority === "high" || entry.priority === "critical") score += 10;
  if ((entry.usage_count ?? 0) > 5) score += 5;
  return Math.min(100, score);
}

function coverageContributionScore(
  intent: AuthorIntent,
  entry: AIKnowledgeEntry
): number {
  const cat = entry.category.toLowerCase();
  const intentCategories: Record<AuthorIntent, string[]> = {
    identity: ["about adakaro", "general"],
    capabilities: ["about adakaro", "attendance", "finance", "student management"],
    process: ["getting started", "student management", "admissions"],
    pricing: ["pricing"],
    finance: ["finance", "school administration"],
    general: [],
  };
  const relevant = intentCategories[intent] ?? [];
  if (relevant.includes(cat)) return 90;
  if (relevant.some((r) => cat.includes(r) || r.includes(cat))) return 60;
  return 15;
}

function applyIntentPenalties(
  score: number,
  intent: AuthorIntent,
  entry: AIKnowledgeEntry
): number {
  const q = entry.question.toLowerCase();
  const cat = entry.category.toLowerCase();

  if (intent === "identity") {
    if (/archive|import|excel|promotion|invoice|subscription cost/.test(q)) return Math.min(score, 8);
    if (cat === "pricing") return Math.min(score, 12);
    if (/what is adakaro|who is adakaro|built for|why choose/.test(q)) return Math.min(100, score + 35);
  }

  if (intent === "capabilities") {
    if (cat === "pricing") return Math.min(score, 10);
    if (/what can|what does|modules/.test(q)) return Math.min(100, score + 30);
  }

  if (intent === "pricing") {
    if (cat === "pricing" || /cost|pricing|free/.test(q)) return Math.min(100, score + 25);
    if (/archive|attendance step/.test(q)) return Math.min(score, 5);
  }

  if (intent === "process") {
    if (/^how do i|^how to/.test(q)) return Math.min(100, score + 30);
    if (cat === "about adakaro" && !/^how/.test(q)) return Math.min(score, 20);
  }

  return score;
}

function finalizeLessonScore(rawScore: number, rankIndex: number, maxRaw: number): number {
  if (rankIndex === 0) {
    return Math.min(100, Math.max(rawScore + 12, 88));
  }

  const gapFromTop = maxRaw - rawScore;

  // Keep closely related lessons selectable (e.g. two pricing lessons).
  if (gapFromTop < 12) {
    return Math.max(35, Math.round(rawScore));
  }

  if (rawScore < 20) return Math.max(2, Math.round(rawScore * 0.25));
  if (rawScore < 40) return Math.round(8 + rawScore * 0.35);
  return Math.round(20 + rawScore * 0.55);
}

export function rankLessons(
  questionContext: QuestionContext,
  entries: AIKnowledgeEntry[],
  excludeEntryId?: string
): RankedLesson[] {
  const questionTokens = tokenize(questionContext.question);
  const entity = normalizeText(questionContext.route.entity);
  const intent = questionContext.route.intent;

  const rawRanked: Array<{ entry: AIKnowledgeEntry; rawScore: number; breakdown: RankingFactorBreakdown }> = [];

  for (const entry of entries) {
    if (excludeEntryId && entry.id === excludeEntryId) continue;

    const entryTokens = tokenize(
      `${entry.question} ${entry.keywords.join(" ")} ${entry.intent_name ?? ""}`
    );
    const answerTokens = tokenize(entry.answer);

    const intentMatch = overlapScore(questionTokens, entryTokens);
    const entityMatch =
      entity && normalizeText(entry.question + entry.answer).includes(entity) ? 95 : 0;
    const topicOverlap = Math.max(
      overlapScore(questionTokens, answerTokens),
      overlapScore(questionTokens, entryTokens)
    );
    const questionType = questionTypeScore(intent, entry);
    const sectionRelevance = sectionRelevanceScore(intent, entry);
    const categoryRelevance = categorySimilarity(questionContext.category, entry.category);
    const dependencyRelationship = dependencyScore(
      entry,
      questionContext.prerequisiteQuestions,
      questionContext.relatedQuestions
    );
    const metadataRelevance = metadataScore(
      entry,
      questionContext.metadataKeywords,
      questionContext.metadataRelatedTerms
    );
    const publishedConfidence = publishedConfidenceScore(entry);
    const coverageContribution = coverageContributionScore(intent, entry);

    let rawScore = Math.round(
      intentMatch * 0.18 +
        entityMatch * 0.12 +
        topicOverlap * 0.14 +
        questionType * 0.16 +
        sectionRelevance * 0.1 +
        categoryRelevance * 0.1 +
        dependencyRelationship * 0.08 +
        metadataRelevance * 0.04 +
        publishedConfidence * 0.04 +
        coverageContribution * 0.04
    );

    rawScore = applyIntentPenalties(rawScore, intent, entry);

    rawRanked.push({
      entry,
      rawScore: Math.max(0, Math.min(100, rawScore)),
      breakdown: {
        intentMatch,
        entityMatch,
        topicOverlap,
        questionType,
        sectionRelevance,
        categoryRelevance,
        dependencyRelationship,
        metadataRelevance,
        publishedConfidence,
        coverageContribution,
      },
    });
  }

  rawRanked.sort((a, b) => b.rawScore - a.rawScore);
  const maxRaw = rawRanked[0]?.rawScore ?? 0;

  return rawRanked.map((r, i) => ({
    entry: r.entry,
    score: finalizeLessonScore(r.rawScore, i, maxRaw),
    breakdown: r.breakdown,
    legacyBreakdown: {
      intent: r.breakdown.intentMatch,
      entity: r.breakdown.entityMatch,
      keywords: r.breakdown.metadataRelevance,
      category: r.breakdown.categoryRelevance,
      dependency: r.breakdown.dependencyRelationship,
      metadata: r.breakdown.metadataRelevance,
      topic: r.breakdown.topicOverlap,
    },
  }));
}

export function selectTopLessons(
  ranked: RankedLesson[],
  options?: { minScore?: number; maxCount?: number }
): RankedLesson[] {
  const minScore = options?.minScore ?? LESSON_RANK_THRESHOLD;
  const maxCount = options?.maxCount ?? LESSON_RANK_MAX;

  return ranked.filter((r) => r.score >= minScore).slice(0, maxCount);
}
