/**
 * Reviewer Intelligence — assist reviewers during lesson review (Phase 9).
 */

import { computeQuestionSimilarity } from "./knowledge-duplicates";
import { getGraphNeighborsForEntry } from "./knowledge-graph-builder";
import { generateKeywordsFromQuestion } from "./keyword-generator";
import type { ReviewerIntelligenceHints } from "./knowledge-intelligence-types";
import type { GeneratedLessonDraft } from "./lesson-generator-types";
import type { AIKnowledgeEntry } from "./types";

export function buildReviewerIntelligenceHints(
  draft: GeneratedLessonDraft | AIKnowledgeEntry,
  existingEntries: AIKnowledgeEntry[],
  relatedDrafts: Array<Pick<GeneratedLessonDraft, "question" | "intentLabel">> = []
): ReviewerIntelligenceHints {
  const isDraft = "qualityReport" in draft;
  const question = draft.question;
  const answer = draft.answer;
  const keywords = draft.keywords;
  const qualityReport = isDraft ? (draft as GeneratedLessonDraft).qualityReport : undefined;

  const potentialDuplicates: ReviewerIntelligenceHints["potentialDuplicates"] = [];
  for (const entry of existingEntries) {
    const { similarity, classification } = computeQuestionSimilarity(question, entry);
    if (similarity >= 0.65) {
      potentialDuplicates.push({
        question: entry.question,
        similarity: Math.round(similarity * 100),
        entryId: entry.id,
      });
    }
  }
  potentialDuplicates.sort((a, b) => b.similarity - a.similarity);

  const suggestedKw = generateKeywordsFromQuestion(question, draft.category);
  const missingKeywords = suggestedKw.keywords.filter(
    (k) => !keywords.some((existing) => existing.toLowerCase() === k.toLowerCase())
  );

  const neighbors = getGraphNeighborsForEntry(draft as AIKnowledgeEntry, existingEntries);
  const missingRelatedLessons = neighbors
    .slice(0, 5)
    .map((n) => n.question)
    .filter((q) => q !== question);

  const weakEvidence: string[] = [];
  if (answer.length < 100) weakEvidence.push("Answer may be too brief for factual verification");
  if (keywords.length < 4) weakEvidence.push("Keyword set is thin for reliable retrieval");
  if (!answer.includes("**")) weakEvidence.push("Missing structured sections");

  const confidenceExplanation =
    qualityReport?.confidenceReasons ??
    (isDraft
      ? [`Estimated confidence: ${(draft as GeneratedLessonDraft).estimatedConfidence}%`]
      : []);

  const suggestedImprovements: string[] = [];
  if (qualityReport?.primaryFailureReason) {
    suggestedImprovements.push(qualityReport.primaryFailureReason);
  }
  for (const d of qualityReport?.scoreExplanation.minorDeductions ?? []) {
    suggestedImprovements.push(d.replace(/^−\s*/, ""));
  }
  if (missingKeywords.length > 0) {
    suggestedImprovements.push(`Add keywords: ${missingKeywords.slice(0, 4).join(", ")}`);
  }

  const prerequisiteLessons = existingEntries
    .filter((e) => {
      const mod = "curriculumModule" in draft ? draft.curriculumModule : draft.curriculum_module;
      return e.curriculum_module === mod;
    })
    .slice(0, 3)
    .map((e) => e.question);

  const dependentLessons = neighbors.slice(0, 3).map((n) => n.question);

  const oneClickActions = [
    { id: "add-keywords", label: "Add suggested keywords", action: "add_keywords" },
    { id: "check-dup", label: "Compare duplicates", action: "compare_duplicates" },
    { id: "regenerate", label: "Regenerate answer", action: "regenerate" },
  ];
  if (qualityReport && qualityReport.overallQuality < 90) {
    oneClickActions.unshift({
      id: "improve-weak",
      label: "Auto-improve weak areas",
      action: "auto_improve",
    });
  }

  return {
    potentialDuplicates: potentialDuplicates.slice(0, 5),
    missingRelatedLessons,
    missingKeywords: missingKeywords.slice(0, 8),
    weakEvidence,
    confidenceExplanation,
    coverageContribution: isDraft
      ? (draft as GeneratedLessonDraft).coverageContribution
      : Math.min(100, keywords.length * 8),
    suggestedImprovements: suggestedImprovements.slice(0, 6),
    prerequisiteLessons,
    dependentLessons,
    relatedCurriculum: [
      "intentLabel" in draft
        ? draft.intentLabel
        : (draft.intent_key ?? draft.category),
      ...("topicTag" in draft && draft.topicTag ? [draft.topicTag] : []),
    ],
    expectedRetrievalGain: Math.min(25, missingKeywords.length * 3 + (weakEvidence.length === 0 ? 10 : 0)),
    oneClickActions,
  };
}
