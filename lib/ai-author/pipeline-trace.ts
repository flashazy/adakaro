/**
 * Pipeline Trace — developer-only end-to-end fact lifecycle logging.
 */

import { explainLessonRankings } from "./ranking-explainer";
import { buildRejectionSummary } from "./fact-explainer";
import { averageFactConfidence } from "./fact-scorer";
import type { QuestionContext } from "./context-engine";
import type {
  DraftValidationResult,
  FactTraceEntry,
  PipelineDebugTrace,
  RankedLesson,
  ScoredFact,
} from "./types";
import { FACT_SCORE_THRESHOLD } from "./types";

export interface BuildPipelineTraceInput {
  questionContext: QuestionContext;
  allRanked: RankedLesson[];
  selectedLessons: RankedLesson[];
  extractedCount: number;
  scoredFacts: ScoredFact[];
  kept: ScoredFact[];
  discarded: ScoredFact[];
  usedFactIds: Set<string>;
  sectionsGenerated: number;
  draftLength: number;
  validation: DraftValidationResult;
  duplicatesRemoved: number;
  factsByLesson: Map<string, ScoredFact[]>;
  threshold?: number;
}

export function buildPipelineTrace(input: BuildPipelineTraceInput): PipelineDebugTrace {
  const threshold = input.threshold ?? FACT_SCORE_THRESHOLD;
  const keptIds = new Set(input.kept.map((f) => f.id));
  const selectedIds = new Set(input.selectedLessons.map((l) => l.entry.id));

  const lessonRankings = explainLessonRankings({
    allRanked: input.allRanked,
    selectedLessons: input.selectedLessons,
    questionContext: input.questionContext,
    factsByLesson: input.factsByLesson,
    usedFactIds: input.usedFactIds,
  });

  const lessonTraces = lessonRankings.map((lesson) => ({
    question: lesson.question,
    entryId: lesson.entryId,
    score: lesson.score,
    selected: lesson.selected,
    selectionReasons: lesson.reasons,
  }));

  const factTraces: FactTraceEntry[] = input.scoredFacts.map((fact) => {
    const accepted = keptIds.has(fact.id);
    const used = input.usedFactIds.has(fact.id);
    const breakdown = fact.scoreBreakdown ?? {
      semantic: fact.topicScore,
      entity: 0,
      intent: fact.intentScore,
      evidence: 0,
      published: 0,
      lessonProvenance: selectedIds.has(fact.sourceEntryId) ? 40 : 0,
      penalties: 0,
      final: fact.relevanceScore,
    };

    return {
      id: fact.id,
      rawText: fact.text,
      sourceQuestion: fact.sourceQuestion,
      sourceEntryId: fact.sourceEntryId,
      detectedEntity: fact.detectedEntity ?? input.questionContext.route.entity,
      detectedIntent: fact.detectedIntent ?? input.questionContext.route.intent,
      sectionHint: fact.sectionHint,
      scores: breakdown,
      accepted,
      used,
      rejectionCategory: accepted ? null : (fact.rejectionCategory ?? "low_confidence"),
      rejectionReason:
        fact.discardReason ??
        (accepted ? "Accepted — passed scoring and filter." : "Rejected during filter."),
      threshold,
    };
  });

  const explainedForSummary = factTraces.map((trace) => ({
    id: trace.id,
    text: trace.rawText,
    sourceQuestion: trace.sourceQuestion,
    sourceEntryId: trace.sourceEntryId,
    score: trace.scores.final,
    used: trace.used,
    accepted: trace.accepted,
    reason: trace.rejectionReason,
    rejectionCategory: trace.rejectionCategory,
  }));

  const topRejectionReasons = buildRejectionSummary({
    explainedFacts: explainedForSummary,
    duplicatesRemoved: input.duplicatesRemoved,
  });

  const factsAccepted = input.kept.length;
  const factsRejected = input.discarded.length;
  const acceptanceRate =
    input.extractedCount > 0
      ? Math.round((factsAccepted / input.extractedCount) * 100)
      : 0;

  let composerWarning: string | undefined;
  if (factsAccepted > 0 && input.sectionsGenerated === 0) {
    composerWarning =
      "Developer warning: accepted facts exist but no sections were generated for DraftComposer.";
  }

  const validationResult = input.validation.valid
    ? "Valid"
    : input.validation.issues.map((i) => i.message).join("; ");

  return {
    lessonsRead: input.allRanked.length,
    lessonsSelected: input.selectedLessons.length,
    factsExtracted: input.extractedCount,
    factsAccepted,
    factsRejected,
    factsUsed: input.usedFactIds.size,
    sectionsGenerated: input.sectionsGenerated,
    draftLength: input.draftLength,
    validationResult,
    acceptanceRate,
    averageConfidence: averageFactConfidence(input.kept),
    topRejectionReasons,
    composerWarning,
    lessonTraces,
    factTraces,
  };
}
