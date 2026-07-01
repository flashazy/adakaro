/**
 * Enterprise Knowledge Authoring — readiness checks, fix-all orchestration.
 */

import {
  generateKnowledgeMetadataSync,
  type KnowledgeMetadataInput,
  type MetadataField,
} from "./knowledge-metadata-generator";
import {
  autoFixProfessionalLanguage,
  autoFixTimelessWording,
  improveAnswerStructure,
  type AnswerImproveAction,
  improveAnswer,
} from "./knowledge-language-improver";
import {
  validateKnowledgeWritingStandard,
  type KnowledgeWritingDraft,
  type WritingStandardValidation,
} from "./knowledge-writing-standard";
import { validateMetadataDraft } from "./knowledge-metadata-validator";
import { prioritizeRelatedLessons, buildCurriculumPlannerContext, getLessonPrerequisites, IDENTITY_FOLLOW_UP_QUESTIONS, mergePriorityLessonSuggestions, scoreDependencyFollowUp } from "./knowledge-curriculum-planner";
import { formatEnterpriseDependencyHint, isKnowledgeCovered } from "./prerequisite-resolver";
import { normalizeMetadataBundle } from "./normalize-metadata";
import { normalizeText } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";

export interface EnterpriseReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  hint?: string;
}

export interface EnterpriseReadinessResult {
  ready: boolean;
  confidenceScore: number;
  checks: EnterpriseReadinessCheck[];
  writingValidation: WritingStandardValidation;
  metadataValid: boolean;
  metadataErrors: string[];
  blockers: string[];
}

export interface FixAllQualityResult {
  answer: string;
  metadata: {
    keywords: string[];
    synonyms: string[];
    search_phrases: string[];
    alternative_wording: string[];
    related_terms: string[];
  };
  readiness: EnterpriseReadinessResult;
  iterations: number;
}

export interface PostSaveRecommendation {
  question: string;
  reason: string;
  supportingReasons: string[];
  dependentLessonCount: number;
  priorityScore: number;
  priorityLevel: string;
  starRating: number;
  inDatabase: boolean;
  entryId: string | null;
}

function metadataFromDraft(draft: KnowledgeWritingDraft) {
  return {
    keywords: draft.keywords,
    synonyms: draft.synonyms,
    search_phrases: draft.search_phrases,
    alternative_wording: draft.alternative_wording,
    related_terms: draft.related_terms,
  };
}

export function assessEnterpriseReadiness(input: {
  draft: KnowledgeWritingDraft;
  duplicateCheck?: {
    exactMatch?: { entry: { id: string; question?: string } } | null;
    nearDuplicateMatch?: { entry: { id: string; question: string } } | null;
  } | null;
  metadataBaseline?: { question: string; answer: string } | null;
  editingEntryId?: string | null;
  allEntries?: AIKnowledgeEntry[];
}): EnterpriseReadinessResult {
  const { draft, duplicateCheck, metadataBaseline, editingEntryId, allEntries = [] } = input;
  const writingValidation = validateKnowledgeWritingStandard(draft);
  const metadataCheck = validateMetadataDraft(metadataFromDraft(draft), draft.question);

  const metadataSynced =
    !metadataBaseline ||
    (metadataBaseline.question.trim() === draft.question.trim() &&
      metadataBaseline.answer.trim() === draft.answer.trim());

  const hasExactDuplicate = Boolean(
    duplicateCheck?.exactMatch &&
      (!editingEntryId || duplicateCheck.exactMatch.entry.id !== editingEntryId)
  );

  const plannerContext = buildCurriculumPlannerContext({ entries: allEntries });
  const prerequisites = getLessonPrerequisites(
    draft.question,
    plannerContext,
    editingEntryId ?? undefined
  );
  const missingPrerequisites = prerequisites.filter((p) => !p.completed);
  const dependencyPassed = missingPrerequisites.length === 0;

  const nearDuplicateCoversTopic =
    duplicateCheck?.nearDuplicateMatch &&
    (!editingEntryId || duplicateCheck.nearDuplicateMatch.entry.id !== editingEntryId);

  const checks: EnterpriseReadinessCheck[] = [
    ...writingValidation.checklist.map((c) => ({
      id: c.id,
      label: c.label,
      passed: c.passed,
      required: c.required,
      hint: c.hint,
    })),
    {
      id: "metadata-valid",
      label: "Metadata validation",
      passed: metadataCheck.valid,
      required: true,
      hint: metadataCheck.errors[0],
    },
    {
      id: "metadata-synced",
      label: "Metadata matches question & answer",
      passed: metadataSynced,
      required: true,
      hint: "Regenerate metadata after editing question or answer.",
    },
    {
      id: "duplicate-analysis",
      label: "Duplicate analysis clear",
      passed: !hasExactDuplicate,
      required: true,
      hint: hasExactDuplicate
        ? "Resolve exact duplicate before saving."
        : nearDuplicateCoversTopic
          ? `Existing lesson covers this topic: "${duplicateCheck!.nearDuplicateMatch!.entry.question}". Update that entry instead of creating a new one.`
          : undefined,
    },
    {
      id: "dependency-analysis",
      label: "Dependency analysis",
      passed: dependencyPassed,
      required: prerequisites.length > 0,
      hint: formatEnterpriseDependencyHint(missingPrerequisites),
    },
    {
      id: "ai-validation",
      label: "AI validation passed",
      passed: writingValidation.passed && metadataCheck.valid,
      required: true,
    },
  ];

  const requiredChecks = checks.filter((c) => c.required);
  const ready = requiredChecks.every((c) => c.passed);
  const passedCount = requiredChecks.filter((c) => c.passed).length;
  const confidenceScore = Math.round((passedCount / Math.max(1, requiredChecks.length)) * 100);

  const blockers = checks
    .filter((c) => c.required && !c.passed)
    .map((c) => c.hint ? `${c.label}: ${c.hint}` : c.label);

  return {
    ready,
    confidenceScore,
    checks,
    writingValidation,
    metadataValid: metadataCheck.valid,
    metadataErrors: metadataCheck.errors,
    blockers,
  };
}

export function fixAllQualityIssues(input: {
  category: string;
  question: string;
  answer: string;
  metadata?: Partial<Record<MetadataField, string[]>>;
  maxIterations?: number;
  allEntries?: AIKnowledgeEntry[];
  editingEntryId?: string | null;
}): FixAllQualityResult {
  const maxIterations = input.maxIterations ?? 3;
  let answer = input.answer;
  let metadata = normalizeMetadataBundle({
    keywords: input.metadata?.keywords ?? [],
    synonyms: input.metadata?.synonyms ?? [],
    search_phrases: input.metadata?.search_phrases ?? [],
    alternative_wording: input.metadata?.alternative_wording ?? [],
    related_terms: input.metadata?.related_terms ?? [],
  });

  let iterations = 0;
  let readiness: EnterpriseReadinessResult;

  do {
    iterations++;
    answer = autoFixTimelessWording(autoFixProfessionalLanguage(answer));
    answer = improveAnswerStructure(answer, input.question);

    const generated = generateKnowledgeMetadataSync({
      category: input.category,
      question: input.question,
      answer,
    });

    metadata = normalizeMetadataBundle({
      keywords: generated.keywords,
      synonyms: generated.synonyms,
      search_phrases: generated.search_phrases,
      alternative_wording: generated.alternative_wording,
      related_terms: generated.related_terms,
    });

    readiness = assessEnterpriseReadiness({
      draft: {
        category: input.category,
        question: input.question,
        answer,
        priority: "normal",
        ...metadata,
      },
      metadataBaseline: { question: input.question, answer },
      allEntries: input.allEntries ?? [],
      editingEntryId: input.editingEntryId ?? null,
    });
  } while (!readiness.ready && iterations < maxIterations);

  return { answer, metadata, readiness, iterations };
}

export function buildPostSaveRecommendations(
  savedEntry: Pick<AIKnowledgeEntry, "id" | "question" | "category">,
  allEntries: AIKnowledgeEntry[]
): PostSaveRecommendation[] {
  const context = buildCurriculumPlannerContext({ entries: allEntries });
  const suggestions = prioritizeRelatedLessons(
    savedEntry.question,
    [],
    context,
    { category: savedEntry.category, excludeId: savedEntry.id }
  );

  const normSaved = normalizeText(savedEntry.question);
  if (normSaved.includes("what is adakaro") || normSaved.includes("who is adakaro")) {
    for (const followUp of IDENTITY_FOLLOW_UP_QUESTIONS) {
      if (normalizeText(followUp) === normSaved) continue;
      suggestions.push(
        scoreDependencyFollowUp(followUp, savedEntry.question.trim(), context, {
          category: savedEntry.category,
          excludeId: savedEntry.id,
        })
      );
    }
  }

  return mergePriorityLessonSuggestions(suggestions)
    .filter(
      (s) =>
        (!s.inDatabase || s.entryId !== savedEntry.id) &&
        !isKnowledgeCovered(s.question, allEntries, {
          excludeId: savedEntry.id,
          category: savedEntry.category,
        })
    )
    .slice(0, 8)
    .map((s) => ({
      question: s.question,
      reason: s.reason,
      supportingReasons: s.requiredBy ?? [],
      dependentLessonCount: s.dependentLessonCount ?? 0,
      priorityScore: s.priorityScore,
      priorityLevel: s.priorityLevel,
      starRating: s.starRating,
      inDatabase: s.inDatabase,
      entryId: s.entryId,
    }));
}

export { type AnswerImproveAction, improveAnswer };
