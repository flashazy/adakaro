/**
 * Reasoning Report — aggregates all explainable engine decisions.
 */

import { analyzeCoverage } from "./coverage-analyzer";
import { computeKnowledgeHealth, recommendLessons } from "./curriculum-recommender";
import {
  buildExplainedFacts,
  buildFactConfidenceReasons,
  buildSectionConfidence,
} from "./fact-explainer";
import { detectKnowledgeGaps, gapCount } from "./knowledge-gap-detector";
import { explainLessonRankings } from "./ranking-explainer";
import type { QuestionContext } from "./context-engine";
import type {
  DraftGenerationContext,
  DraftSection,
  DraftValidationResult,
  KnowledgeConflict,
  KnowledgeGraphNode,
  RankedLesson,
  ReasoningReport,
  ScoredFact,
} from "./types";

function buildKnowledgeGraph(context: DraftGenerationContext): KnowledgeGraphNode[] {
  const nodes: KnowledgeGraphNode[] = [];

  for (const entry of context.prerequisiteEntries) {
    nodes.push({
      type: "prerequisite",
      question: entry.question,
      entryId: entry.id,
    });
  }

  for (const entry of context.relatedEntries) {
    nodes.push({
      type: "companion",
      question: entry.question,
      entryId: entry.id,
    });
  }

  for (const entry of context.graphNeighborEntries) {
    nodes.push({
      type: "related",
      question: entry.question,
      entryId: entry.id,
    });
  }

  for (const entry of context.dependencyEntries) {
    if (!nodes.some((n) => n.entryId === entry.id)) {
      nodes.push({
        type: "child",
        question: entry.question,
        entryId: entry.id,
      });
    }
  }

  const publishedQuestions = new Set(
    context.publishedEntries.map((e) => e.question.toLowerCase())
  );
  const foundationQuestions = [
    "What is Adakaro?",
    "Why choose Adakaro?",
    "Who is Adakaro built for?",
  ];
  for (const q of foundationQuestions) {
    if (!publishedQuestions.has(q.toLowerCase())) {
      nodes.push({ type: "missing", question: q });
    }
  }

  if (context.request.question.trim()) {
    const parent = context.prerequisiteEntries[0];
    if (parent) {
      nodes.push({ type: "parent", question: parent.question, entryId: parent.id });
    }
  }

  return nodes.slice(0, 20);
}

export function buildReasoningReport(input: {
  questionContext: QuestionContext;
  context: DraftGenerationContext;
  allRanked: RankedLesson[];
  selectedLessons: RankedLesson[];
  allScored: ScoredFact[];
  kept: ScoredFact[];
  discarded: ScoredFact[];
  usedFactIds: Set<string>;
  sections: DraftSection[];
  sectionPlan: string[];
  confidenceOverall: number;
  validation: DraftValidationResult;
  factsByLesson: Map<string, ScoredFact[]>;
  conflicts?: KnowledgeConflict[];
  duplicatesRemoved?: number;
}): ReasoningReport {
  const gaps = detectKnowledgeGaps({
    questionContext: input.questionContext,
    allFacts: input.allScored,
    sectionPlan: input.sectionPlan,
  });

  const filledSections = input.sections.map((s) => s.title);
  const coverage = analyzeCoverage({
    questionContext: input.questionContext,
    gaps,
    sectionPlan: input.sectionPlan,
    filledSections,
  });

  const explainedFacts = buildExplainedFacts({
    allScored: input.allScored,
    kept: input.kept,
    discarded: input.discarded,
    usedFactIds: input.usedFactIds,
    context: input.questionContext,
    conflicts: input.conflicts,
    duplicateCount: input.duplicatesRemoved,
  });

  const sectionConfidence = buildSectionConfidence({
    sections: input.sections,
    explainedFacts,
    sectionPlan: input.sectionPlan,
  });

  const factConfidenceReasons = buildFactConfidenceReasons({
    context: input.questionContext,
    explainedFacts,
    sectionConfidence,
  });

  const publishedQuestions = new Set(
    input.context.publishedEntries.map((e) => e.question.toLowerCase())
  );

  const suggestedLessons = recommendLessons({
    questionContext: input.questionContext,
    gaps,
    publishedQuestions,
    currentQuestion: input.context.request.question,
    allFacts: input.allScored,
  });

  const knowledgeHealth = computeKnowledgeHealth({
    coverageOverall: coverage.overall,
    gapCount: gapCount(gaps),
    confidenceOverall: input.confidenceOverall,
    recommendedLessons: suggestedLessons,
  });

  const lessonRankings = explainLessonRankings({
    allRanked: input.allRanked,
    selectedLessons: input.selectedLessons,
    questionContext: input.questionContext,
    factsByLesson: input.factsByLesson,
    usedFactIds: input.usedFactIds,
  });

  const validationNotes = input.validation.issues.map((i) => i.message);
  if (input.validation.rebuildReason) {
    validationNotes.unshift(input.validation.rebuildReason);
  } else if (input.validation.rebuilt) {
    validationNotes.unshift("Draft was automatically rebuilt after quality validation failed.");
  }

  return {
    lessonRankings,
    facts: explainedFacts,
    knowledgeGaps: gaps,
    suggestedLessons,
    coverage,
    sectionConfidence,
    factConfidenceReasons,
    knowledgeGraph: buildKnowledgeGraph(input.context),
    knowledgeHealth,
    validationNotes,
  };
}
