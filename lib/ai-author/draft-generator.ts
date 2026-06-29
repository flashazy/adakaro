/**
 * AI Knowledge Author V3 — Enterprise Knowledge Intelligence Engine (fully offline).
 */

import { buildQuestionContext } from "./context-engine";
import { composeDraft, populateSectionsFromFacts } from "./draft-composer";
import { extractFactsFromLessons } from "./fact-extractor";
import { buildFallbackPool, filterFacts } from "./fact-filter";
import { averageFactConfidence, scoreFacts } from "./fact-scorer";
import { getSectionPlan } from "./intent-router";
import { rankLessons, selectTopLessons } from "./lesson-ranker";
import { buildPipelineTrace } from "./pipeline-trace";
import { buildDraftGenerationContext } from "./related-content";
import { buildReasoningReport } from "./reasoning-report";
import { buildRejectionSummary } from "./fact-explainer";
import {
  calculateConfidence,
  detectConflicts,
  hasPlaceholderIssue,
  polishDraft,
  templateFamilyLabel,
  validateDraft,
} from "./quality-validator";
import type {
  DraftDiagnostics,
  DraftGenerationContext,
  DraftGenerationRequest,
  DraftGenerationResult,
  KnowledgeDraftEngine,
  ScoredFact,
} from "./types";
import { FACT_SCORE_THRESHOLD } from "./types";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

interface PipelineOptions {
  /** Reserved for placeholder-only rebuilds — never raises fact threshold. */
  placeholderRebuild?: boolean;
}

function groupFactsByLesson(facts: ScoredFact[]): Map<string, ScoredFact[]> {
  const map = new Map<string, ScoredFact[]>();
  for (const fact of facts) {
    const list = map.get(fact.sourceEntryId) ?? [];
    list.push(fact);
    map.set(fact.sourceEntryId, list);
  }
  return map;
}

function buildSelectedLessonScores(
  selectedLessons: Array<{ entry: { id: string }; score: number }>
): Map<string, number> {
  return new Map(selectedLessons.map((lesson) => [lesson.entry.id, lesson.score]));
}

function runPipeline(context: DraftGenerationContext, _options: PipelineOptions = {}) {
  const questionContext = buildQuestionContext(context);
  const sectionPlan = getSectionPlan(
    questionContext.route.intent,
    context.request.structure
  );

  const allRanked = rankLessons(
    questionContext,
    context.publishedEntries,
    context.request.excludeEntryId
  );
  const selectedLessons = selectTopLessons(allRanked);
  const selectedLessonIds = new Set(selectedLessons.map((l) => l.entry.id));
  const selectedLessonScores = buildSelectedLessonScores(selectedLessons);

  const extractedFacts = extractFactsFromLessons(selectedLessons);
  const scoredFacts = scoreFacts(extractedFacts, questionContext, { selectedLessonScores });
  const { kept, discarded } = filterFacts(scoredFacts, questionContext, FACT_SCORE_THRESHOLD, {
    selectedLessonIds,
  });
  const fallbackFacts = buildFallbackPool(discarded);

  let { sections, factsUsed, duplicatesRemoved, sectionPopulation } =
    populateSectionsFromFacts({
      questionContext,
      primaryFacts: kept,
      fallbackFacts,
      structure: context.request.structure,
    });

  const usedFactIds = new Set(factsUsed.map((f) => f.id));
  const conflicts = detectConflicts(scoredFacts);

  if (kept.length > 0 && factsUsed.length === 0) {
    const emergency = populateSectionsFromFacts({
      questionContext,
      primaryFacts: kept,
      structure: context.request.structure,
    });
    for (const fact of emergency.factsUsed) {
      if (!usedFactIds.has(fact.id)) {
        factsUsed.push(fact);
        usedFactIds.add(fact.id);
      }
    }
    if (emergency.sections.length > 0 && sections.length === 0) {
      sections.push(...emergency.sections);
    }
  }

  let draft = composeDraft({
    questionContext,
    sections,
    factsUsed,
    keptFacts: kept,
    structure: context.request.structure,
  });

  draft = polishDraft(draft);

  const validation = validateDraft({
    draft,
    sections,
    intent: questionContext.route.intent,
    conflicts,
    acceptedFactsCount: kept.length,
  });

  const factsByLesson = groupFactsByLesson(scoredFacts);

  const pipelineTrace = buildPipelineTrace({
    questionContext,
    allRanked,
    selectedLessons,
    extractedCount: extractedFacts.length,
    scoredFacts,
    kept,
    discarded,
    usedFactIds,
    sectionsGenerated: sections.length,
    draftLength: draft.length,
    validation,
    duplicatesRemoved,
    factsByLesson,
    threshold: FACT_SCORE_THRESHOLD,
  });

  return {
    questionContext,
    sectionPlan,
    allRanked,
    selectedLessons,
    extractedFacts,
    scoredFacts,
    kept,
    discarded,
    sections,
    factsUsed,
    usedFactIds,
    duplicatesRemoved,
    sectionPopulation,
    conflicts,
    draft,
    validation,
    factsByLesson,
    pipelineTrace,
  };
}

export class EnterpriseKnowledgeDraftEngine implements KnowledgeDraftEngine {
  generate(context: DraftGenerationContext): DraftGenerationResult {
    let pipeline = runPipeline(context);
    let validation = pipeline.validation;

    if (hasPlaceholderIssue(validation)) {
      pipeline = runPipeline(context, { placeholderRebuild: true });
      validation = validateDraft({
        draft: pipeline.draft,
        sections: pipeline.sections,
        intent: pipeline.questionContext.route.intent,
        conflicts: pipeline.conflicts,
        acceptedFactsCount: pipeline.kept.length,
      });
      validation = {
        ...validation,
        rebuilt: true,
        rebuildReason: "Auto-rebuilt due to placeholder detection.",
      };
      pipeline = { ...pipeline, validation };
    }

    const coverageOverall =
      pipeline.sections.length > 0
        ? Math.round(
            (pipeline.sections.filter((s) => s.content.trim().length > 0).length /
              Math.max(1, pipeline.sectionPlan.length)) *
              100
          )
        : 0;

    const confidence = calculateConfidence({
      questionContext: pipeline.questionContext,
      sections: pipeline.sections,
      factsUsed: pipeline.factsUsed,
      sectionPlan: pipeline.sectionPlan,
      coverageOverall,
    });

    const reasoning = buildReasoningReport({
      questionContext: pipeline.questionContext,
      context,
      allRanked: pipeline.allRanked,
      selectedLessons: pipeline.selectedLessons,
      allScored: pipeline.scoredFacts,
      kept: pipeline.kept,
      discarded: pipeline.discarded,
      usedFactIds: pipeline.usedFactIds,
      sections: pipeline.sections,
      sectionPlan: pipeline.sectionPlan,
      confidenceOverall: confidence.overall,
      validation,
      factsByLesson: pipeline.factsByLesson,
      conflicts: pipeline.conflicts,
      duplicatesRemoved: pipeline.duplicatesRemoved,
    });

    confidence.coverage = reasoning.coverage.overall;

    const rejectionSummary = buildRejectionSummary({
      explainedFacts: reasoning.facts,
      duplicatesRemoved: pipeline.duplicatesRemoved,
    });

    const sourcesUsed = [...new Set(pipeline.factsUsed.map((f) => f.sourceQuestion))];

    const diagnostics: DraftDiagnostics = {
      lessonsRead: context.publishedEntries.length,
      lessonsSelected: pipeline.selectedLessons.length,
      lessonsDiscarded: context.publishedEntries.length - pipeline.selectedLessons.length,
      factsExtracted: pipeline.extractedFacts.length,
      factsAccepted: pipeline.kept.length,
      factsRejected: pipeline.discarded.length,
      factsUsed: pipeline.factsUsed.length,
      factsDiscarded: pipeline.discarded.length,
      duplicatesRemoved: pipeline.duplicatesRemoved,
      rejectionSummary,
      sectionPopulation: pipeline.sectionPopulation.filter((s) => s.factCount > 0),
      rankedLessons: pipeline.allRanked.slice(0, 12).map((r) => ({
        question: r.entry.question,
        score: r.score,
        selected: pipeline.selectedLessons.some((s) => s.entry.id === r.entry.id),
      })),
      conflicts: pipeline.conflicts,
      confidence,
      validation,
    };

    return {
      draft: pipeline.draft,
      sections: pipeline.sections,
      sourcesUsed,
      confidence: confidence.overall,
      templateFamily: templateFamilyLabel(pipeline.questionContext),
      diagnostics,
      reasoning,
      pipelineTrace: pipeline.pipelineTrace,
    };
  }
}

/** @deprecated V2 name */
export class ContextualReasoningDraftEngine extends EnterpriseKnowledgeDraftEngine {}

/** @deprecated V1 name */
export class RuleBasedKnowledgeDraftEngine extends EnterpriseKnowledgeDraftEngine {}

let defaultEngine: KnowledgeDraftEngine = new EnterpriseKnowledgeDraftEngine();

export function setKnowledgeDraftEngine(engine: KnowledgeDraftEngine): void {
  defaultEngine = engine;
}

export function getKnowledgeDraftEngine(): KnowledgeDraftEngine {
  return defaultEngine;
}

export function generateDraftFromContext(context: DraftGenerationContext): DraftGenerationResult {
  return getKnowledgeDraftEngine().generate(context);
}

export function generateDraft(
  request: DraftGenerationRequest,
  allEntries: AIKnowledgeEntry[]
): DraftGenerationResult {
  const context = buildDraftGenerationContext(request, allEntries);
  return generateDraftFromContext(context);
}

export {
  type DraftGenerationRequest,
  type DraftGenerationResult,
  type KnowledgeDraftEngine,
};
