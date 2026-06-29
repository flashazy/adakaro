import { computeQuestionSimilarity } from "./knowledge-duplicates";
import { inferIntentWithConfidence } from "./intent-registry";
import { computeEntryQuality } from "./scoring";
import { validateKnowledgeWritingStandard } from "./knowledge-writing-standard";
import type { AIKnowledgeEntry, KnowledgePriority } from "./types";
import type { GeneratedLessonDraft, LessonQualityScores } from "./lesson-generator-types";

export type QualityGrade = "A+" | "A" | "B" | "C" | "Needs Review";

export type DuplicateRiskLevel = "none" | "low" | "medium" | "high";

export function scoreToGrade(score: number): QualityGrade {
  if (score >= 95) return "A+";
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "Needs Review";
}

export function computeDuplicateRisk(
  draft: Pick<GeneratedLessonDraft, "question" | "intentLabel">,
  existingEntries: AIKnowledgeEntry[],
  allDrafts: Array<Pick<GeneratedLessonDraft, "question" | "intentLabel">>
): { level: DuplicateRiskLevel; reason: string | null; similarity: number } {
  let maxSim = 0;
  let reason: string | null = null;

  for (const entry of existingEntries) {
    const { similarity, classification, reasons } = computeQuestionSimilarity(
      draft.question,
      entry
    );
    if (similarity > maxSim) {
      maxSim = similarity;
      reason = reasons[0] ?? classification;
    }
  }

  for (const other of allDrafts) {
    if (other.question === draft.question) continue;
    const pseudoEntry = {
      id: "draft",
      question: other.question,
      category: "General",
      keywords: [],
      search_phrases: [],
      alternative_wording: [],
      synonyms: [],
      related_terms: [],
      answer: "",
      priority: "normal" as KnowledgePriority,
      usage_count: 0,
      last_used_at: null,
      status: "active" as const,
      created_by: null,
      created_at: "",
      updated_at: "",
    };
    const { similarity } = computeQuestionSimilarity(draft.question, pseudoEntry);
    if (similarity > maxSim) {
      maxSim = similarity;
      reason = "Similar to another generated draft";
    }
  }

  let level: DuplicateRiskLevel = "none";
  if (maxSim >= 0.95) {
    level = "high";
  } else if (maxSim >= 0.72) {
    level = "medium";
  } else if (maxSim >= 0.45) {
    level = "low";
  }

  for (const entry of existingEntries) {
    const { similarity, scores, classification } = computeQuestionSimilarity(
      draft.question,
      entry
    );
    if (
      similarity >= 0.7 &&
      scores.intentSimilarity < 0.85 &&
      classification !== "different_intent"
    ) {
      return {
        level: "low",
        reason: "Related topic but different intent",
        similarity: Math.round(similarity * 100) / 100,
      };
    }
  }

  return {
    level,
    reason,
    similarity: Math.round(maxSim * 100) / 100,
  };
}

export function validateGeneratedLesson(
  draft: Omit<GeneratedLessonDraft, "scores" | "duplicateRisk" | "duplicateReason" | "overallGrade" | "coverageContribution" | "estimatedConfidence">,
  existingEntries: AIKnowledgeEntry[],
  allDrafts: GeneratedLessonDraft[] = []
): {
  scores: LessonQualityScores;
  duplicateRisk: DuplicateRiskLevel;
  duplicateReason: string | null;
  overallGrade: QualityGrade;
  coverageContribution: number;
  estimatedConfidence: number;
} {
  const writing = validateKnowledgeWritingStandard({
    category: draft.category,
    question: draft.question,
    answer: draft.answer,
    keywords: draft.keywords,
    search_phrases: draft.search_phrases,
    alternative_wording: draft.alternative_wording,
    synonyms: draft.synonyms,
    related_terms: draft.related_terms,
    priority: draft.priority,
    intent_key: draft.intentKey,
  });

  const pseudoEntry: AIKnowledgeEntry = {
    id: "validation",
    category: draft.category,
    question: draft.question,
    keywords: draft.keywords,
    search_phrases: draft.search_phrases,
    alternative_wording: draft.alternative_wording,
    synonyms: draft.synonyms,
    related_terms: draft.related_terms,
    answer: draft.answer,
    priority: draft.priority,
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    intent_key: draft.intentKey,
  };

  const quality = computeEntryQuality(pseudoEntry);
  const intentInference = inferIntentWithConfidence(draft.question, draft.category);
  const intentScore = draft.intentKey
    ? 95
    : intentInference
      ? Math.round(intentInference.confidence * 100)
      : 50;

  const retrievalScore = Math.round(
    (Math.min(draft.keywords.length / 6, 1) * 25 +
      Math.min(draft.search_phrases.length / 3, 1) * 25 +
      Math.min(draft.synonyms.length / 3, 1) * 20 +
      Math.min(draft.related_terms.length / 3, 1) * 15 +
      (draft.answer.length >= 120 ? 15 : draft.answer.length >= 80 ? 10 : 5)) *
      (100 / 100)
  );

  const knowledgeScore = quality.score;
  const writingScore = writing.requiredPassed
    ? 90 - writing.issues.length * 15 - writing.warnings.length * 5
    : 55;

  const dup = computeDuplicateRisk(draft, existingEntries, allDrafts);
  const duplicatePenalty =
    dup.level === "high" ? 30 : dup.level === "medium" ? 15 : dup.level === "low" ? 5 : 0;

  const coverageContribution = draft.intentLabel
    ? 8 + (writing.requiredPassed ? 4 : 0)
    : 4;

  const overall =
    knowledgeScore * 0.25 +
    writingScore * 0.25 +
    retrievalScore * 0.2 +
    intentScore * 0.2 +
    coverageContribution * 0.1 -
    duplicatePenalty;

  const estimatedConfidence = Math.round(
    Math.min(98, Math.max(40, overall + (dup.level === "none" ? 5 : 0)))
  );

  const scores: LessonQualityScores = {
    knowledgeScore: Math.round(knowledgeScore),
    writingScore: Math.round(Math.max(0, writingScore)),
    retrievalScore: Math.round(retrievalScore),
    intentScore: Math.round(intentScore),
    coverageScore: Math.round(coverageContribution * 10),
    duplicateRiskPercent: Math.round(dup.similarity * 100),
    overallScore: Math.round(Math.max(0, Math.min(100, overall))),
  };

  return {
    scores,
    duplicateRisk: dup.level,
    duplicateReason: dup.reason,
    overallGrade: scoreToGrade(scores.overallScore),
    coverageContribution,
    estimatedConfidence,
  };
}

export function shouldSkipDuplicate(risk: DuplicateRiskLevel): boolean {
  return risk === "high" || risk === "medium";
}
