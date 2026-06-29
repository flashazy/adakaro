/**
 * Curriculum Recommender — suggests next lessons to maximize knowledge base quality.
 */

import type { QuestionContext } from "./context-engine";
import type { KnowledgeGapItem, ScoredFact, SuggestedLesson } from "./types";

const FOUNDATION_LESSONS: SuggestedLesson[] = [
  {
    question: "Why choose Adakaro?",
    importance: 98,
    priority: "critical",
    businessImpact: "Conversion and positioning for new schools",
    searchDemand: 92,
    coverageIncrease: 18,
  },
  {
    question: "Who is Adakaro built for?",
    importance: 96,
    priority: "critical",
    businessImpact: "Audience clarity for onboarding",
    searchDemand: 88,
    coverageIncrease: 16,
  },
  {
    question: "What can Adakaro do?",
    importance: 94,
    priority: "high",
    businessImpact: "Feature discovery and module adoption",
    searchDemand: 90,
    coverageIncrease: 15,
  },
  {
    question: "How does Adakaro compare to spreadsheets?",
    importance: 94,
    priority: "high",
    businessImpact: "Competitive differentiation",
    searchDemand: 72,
    coverageIncrease: 12,
  },
  {
    question: "How much does Adakaro cost?",
    importance: 91,
    priority: "high",
    businessImpact: "Pricing transparency reduces sales friction",
    searchDemand: 85,
    coverageIncrease: 14,
  },
  {
    question: "How do I get started with Adakaro?",
    importance: 89,
    priority: "normal",
    businessImpact: "Activation and time-to-value",
    searchDemand: 78,
    coverageIncrease: 11,
  },
];

function gapToLesson(gap: KnowledgeGapItem, index: number): SuggestedLesson {
  const importance = Math.max(60, 95 - index * 4);
  return {
    question: `Who are ${gap.topic.toLowerCase()} in Adakaro?`,
    priority: importance >= 90 ? "critical" : importance >= 75 ? "high" : "normal",
    businessImpact: `Fills missing ${gap.category.toLowerCase()} coverage`,
    searchDemand: Math.max(40, importance - 10),
    coverageIncrease: Math.min(20, 8 + index),
    importance,
    status: "recommended",
  };
}

function questionSpecificSuggestions(
  questionContext: QuestionContext,
  gaps: KnowledgeGapItem[]
): SuggestedLesson[] {
  const suggestions: SuggestedLesson[] = [];
  const q = questionContext.question.trim().toLowerCase();

  if (questionContext.route.expectedAnswerType === "audience") {
    for (const gap of gaps.filter((g) => !g.covered).slice(0, 4)) {
      suggestions.push({
        question:
          gap.topic === "Countries supported"
            ? "Which countries does Adakaro support?"
            : gap.topic === "School size"
              ? "What school sizes does Adakaro support?"
              : `How does Adakaro help ${gap.topic.toLowerCase()}?`,
        priority: gap.category === "Audience" ? "high" : "normal",
        businessImpact: `Addresses missing ${gap.topic.toLowerCase()} information`,
        searchDemand: 70,
        coverageIncrease: 10,
        importance: 85,
        status: "recommended",
      });
    }
  }

  if (/\bcompare\b|\bspreadsheet\b|\bexcel\b/i.test(q)) {
    suggestions.push({
      question: "How does Adakaro compare to spreadsheets?",
      priority: "high",
      businessImpact: "Competitive positioning",
      searchDemand: 72,
      coverageIncrease: 12,
      importance: 94,
      status: "recommended",
    });
  }

  return suggestions;
}

export function recommendLessons(input: {
  questionContext: QuestionContext;
  gaps: KnowledgeGapItem[];
  publishedQuestions: Set<string>;
  currentQuestion: string;
  allFacts: ScoredFact[];
}): SuggestedLesson[] {
  const suggestions: SuggestedLesson[] = [];
  const normalizedCurrent = input.currentQuestion.trim().toLowerCase();

  for (const foundation of FOUNDATION_LESSONS) {
    const normalized = foundation.question.toLowerCase();
    if (normalized === normalizedCurrent) {
      suggestions.push({ ...foundation, status: "in_progress" });
      continue;
    }
    if (!input.publishedQuestions.has(normalized)) {
      suggestions.push({ ...foundation, status: "recommended" });
    }
  }

  for (const [index, gap] of input.gaps.filter((g) => !g.covered).entries()) {
    if (index >= 3) break;
    suggestions.push(gapToLesson(gap, index));
  }

  suggestions.push(...questionSpecificSuggestions(input.questionContext, input.gaps));

  const seen = new Set<string>();
  const deduped: SuggestedLesson[] = [];
  for (const s of suggestions.sort((a, b) => b.importance - a.importance)) {
    const key = s.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  return deduped.slice(0, 8);
}

export function computeKnowledgeHealth(input: {
  coverageOverall: number;
  gapCount: number;
  confidenceOverall: number;
  recommendedLessons: SuggestedLesson[];
}): { overall: number; gapCount: number; recommendedLessons: SuggestedLesson[] } {
  const overall = Math.round(
    input.coverageOverall * 0.4 + input.confidenceOverall * 0.35 + Math.max(0, 100 - input.gapCount * 8) * 0.25
  );

  return {
    overall: Math.min(100, overall),
    gapCount: input.gapCount,
    recommendedLessons: input.recommendedLessons,
  };
}
