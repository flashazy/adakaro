import type { CurriculumAnalysis } from "./lesson-generator";
import type { GeneratedLessonDraft } from "./lesson-generator";
import {
  aggregateQualityMetrics,
  buildQualityReport,
  reportCacheKey,
  type KnowledgeQualityReport,
  type QualityPipelineMetrics,
} from "./knowledge-quality-report";
import {
  MAX_AUTO_IMPROVE_ATTEMPTS,
  QUALITY_PASS_THRESHOLD,
  mapTopicToCoverageConcept,
} from "./knowledge-quality-rules";
import {
  improveLessonDraft,
  scoreLessonDraft,
  type QualityScoringContext,
} from "./knowledge-quality-scorer";
import { validateGeneratedLesson } from "./lesson-generation-validator";
import type { AIKnowledgeEntry } from "./types";

export interface QualityEngineBatchResult {
  readyLessons: GeneratedLessonDraft[];
  blockedLessons: GeneratedLessonDraft[];
  rejectedLessons: GeneratedLessonDraft[];
  metrics: QualityPipelineMetrics;
  reports: KnowledgeQualityReport[];
}

const evaluationCache = new Map<string, KnowledgeQualityReport>();

export function clearQualityEvaluationCache(): void {
  evaluationCache.clear();
}

function buildScoringContext(
  analysis: CurriculumAnalysis,
  existingEntries: AIKnowledgeEntry[],
  batchDrafts: GeneratedLessonDraft[],
  excludeId?: string
): QualityScoringContext {
  const coveredConcepts = new Set<string>();
  for (const topic of analysis.coveredTopics) {
    coveredConcepts.add(mapTopicToCoverageConcept(topic, topic));
  }
  for (const entry of existingEntries) {
    coveredConcepts.add(
      mapTopicToCoverageConcept(entry.question.slice(0, 24), entry.intent_name ?? "")
    );
  }
  for (const draft of batchDrafts) {
    if (draft.id === excludeId) continue;
    coveredConcepts.add(mapTopicToCoverageConcept(draft.topicTag, draft.intentLabel));
  }

  return {
    existingEntries,
    batchDrafts: batchDrafts.filter((d) => d.id !== excludeId),
    analysis,
    coveredConcepts,
  };
}

export function processDraftThroughQualityEngine(
  draft: GeneratedLessonDraft,
  context: QualityScoringContext,
  category: string
): { draft: GeneratedLessonDraft; report: KnowledgeQualityReport } {
  let current = { ...draft };
  const improvementsApplied: string[] = [];
  let attempts = 0;
  let report: KnowledgeQualityReport;

  while (attempts <= MAX_AUTO_IMPROVE_ATTEMPTS) {
    const cacheKey = reportCacheKey(current);
    const cached = evaluationCache.get(cacheKey);
    report = cached
      ? { ...cached, attempts, improvementsApplied: [...improvementsApplied] }
      : scoreLessonDraft(current, {
          ...context,
          batchDrafts: [...context.batchDrafts, current],
        });

    report = {
      ...report,
      attempts,
      improvementsApplied: [...improvementsApplied],
    };

    if (!cached) {
      evaluationCache.set(cacheKey, report);
    }

    if (report.passed && report.status === "ready") {
      break;
    }

    if (report.status === "rejected" || attempts >= MAX_AUTO_IMPROVE_ATTEMPTS) {
      break;
    }

    if (report.overallQuality < QUALITY_PASS_THRESHOLD) {
      const improved = improveLessonDraft(current, report, category);
      if (improved.improvements.length === 0) break;
      current = improved.draft;
      improvementsApplied.push(...improved.improvements);
    } else {
      break;
    }

    attempts++;
  }

  const validation = validateGeneratedLesson(
    current,
    context.existingEntries,
    context.batchDrafts as GeneratedLessonDraft[]
  );

  const finalReport: KnowledgeQualityReport = {
    ...report!,
    attempts,
    improvementsApplied,
    passed: report!.overallQuality >= QUALITY_PASS_THRESHOLD && report!.status !== "rejected",
    status:
      report!.status === "rejected"
        ? "rejected"
        : report!.overallQuality >= QUALITY_PASS_THRESHOLD
          ? "ready"
          : "needs_human_improvement",
  };

  const enriched: GeneratedLessonDraft = {
    ...current,
    duplicateRisk: validation.duplicateRisk,
    duplicateReason: validation.duplicateReason,
    scores: validation.scores,
    overallGrade: validation.overallGrade,
    coverageContribution: validation.coverageContribution,
    estimatedConfidence: finalReport.overallQuality,
    qualityReport: finalReport,
    qualityStatus: finalReport.status,
    improvementAttempts: attempts,
  };

  return { draft: enriched, report: finalReport };
}

export function processBatchThroughQualityEngine(
  drafts: GeneratedLessonDraft[],
  analysis: CurriculumAnalysis,
  existingEntries: AIKnowledgeEntry[],
  category: string
): QualityEngineBatchResult {
  const readyLessons: GeneratedLessonDraft[] = [];
  const blockedLessons: GeneratedLessonDraft[] = [];
  const rejectedLessons: GeneratedLessonDraft[] = [];
  const reports: KnowledgeQualityReport[] = [];

  for (const draft of drafts) {
    const context = buildScoringContext(analysis, existingEntries, drafts, draft.id);
    const { draft: processed, report } = processDraftThroughQualityEngine(
      draft,
      context,
      category
    );
    reports.push(report);

    if (report.status === "ready") {
      readyLessons.push(processed);
    } else if (report.status === "rejected") {
      rejectedLessons.push(processed);
    } else {
      blockedLessons.push(processed);
    }
  }

  const metrics = aggregateQualityMetrics(reports, analysis.moduleId);

  return {
    readyLessons,
    blockedLessons,
    rejectedLessons,
    metrics,
    reports,
  };
}

export function isEligibleForApprovalQueue(report: KnowledgeQualityReport | undefined): boolean {
  if (!report) return false;
  return report.status === "ready" && report.overallQuality >= QUALITY_PASS_THRESHOLD;
}

export { aggregateQualityMetrics, QUALITY_PASS_THRESHOLD };
