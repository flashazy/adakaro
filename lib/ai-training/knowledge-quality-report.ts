import type { QualityCriterionKey } from "./knowledge-quality-rules";
import {
  QUALITY_CRITERION_LABELS,
  QUALITY_PASS_THRESHOLD,
  scoreToLetterGrade,
  scoreToVisualTier,
  type QualityVisualTier,
} from "./knowledge-quality-rules";

export type QualityPipelineStatus = "ready" | "needs_human_improvement" | "rejected";

export interface QualityCriterionScores {
  questionQuality: number;
  duplicateDetection: number;
  curriculumCoverage: number;
  answerQuality: number;
  retrievalQuality: number;
  writingStandard: number;
  humanReadability: number;
  knowledgeHealth: number;
}

export interface CoverageMapEntry {
  concept: string;
  covered: boolean;
  sourceQuestion?: string;
}

export interface KnowledgeQualityReport {
  criteria: QualityCriterionScores;
  duplicateRiskPercent: number;
  overallQuality: number;
  grade: string;
  visualTier: QualityVisualTier;
  issues: string[];
  improvementsApplied: string[];
  attempts: number;
  passed: boolean;
  status: QualityPipelineStatus;
  coverageMap: CoverageMapEntry[];
}

export interface QualityPipelineMetrics {
  averageQualityScore: number;
  averageGrade: string;
  lessonsAutoImproved: number;
  lessonsAutoRejected: number;
  duplicateRate: number;
  averageRetrievalScore: number;
  averageAnswerQuality: number;
  averageReadability: number;
  topWeakModules: Array<{ moduleId: string; count: number }>;
  readyCount: number;
  blockedCount: number;
}

export function buildEmptyCriteria(): QualityCriterionScores {
  return {
    questionQuality: 0,
    duplicateDetection: 0,
    curriculumCoverage: 0,
    answerQuality: 0,
    retrievalQuality: 0,
    writingStandard: 0,
    humanReadability: 0,
    knowledgeHealth: 0,
  };
}

export function formatQualityReportSummary(report: KnowledgeQualityReport): string {
  const lines = (Object.keys(report.criteria) as QualityCriterionKey[]).map((key) => {
    const label = QUALITY_CRITERION_LABELS[key];
    const value =
      key === "duplicateDetection"
        ? report.duplicateRiskPercent
        : report.criteria[key];
    return `${label}\n${value}`;
  });
  lines.push(`Overall Quality\n${report.overallQuality}`);
  lines.push(`Grade\n${report.grade}`);
  return lines.join("\n\n");
}

export function buildQualityReport(params: {
  criteria: QualityCriterionScores;
  duplicateRiskPercent: number;
  issues: string[];
  improvementsApplied: string[];
  attempts: number;
  coverageMap: CoverageMapEntry[];
  forceRejected?: boolean;
}): KnowledgeQualityReport {
  const overallQuality = Math.round(
    Object.entries(params.criteria).reduce((sum, [key, value]) => {
      const weight =
        key === "questionQuality"
          ? 0.15
          : key === "duplicateDetection"
            ? 0.15
            : key === "curriculumCoverage"
              ? 0.15
              : key === "answerQuality"
                ? 0.2
                : key === "retrievalQuality"
                  ? 0.1
                  : key === "writingStandard"
                    ? 0.1
                    : key === "humanReadability"
                      ? 0.1
                      : 0.05;
      return sum + value * weight;
    }, 0)
  );

  const passed = overallQuality >= QUALITY_PASS_THRESHOLD && !params.forceRejected;
  let status: QualityPipelineStatus = "ready";
  if (params.forceRejected || params.criteria.duplicateDetection < 50) {
    status = "rejected";
  } else if (!passed) {
    status = "needs_human_improvement";
  }

  return {
    criteria: params.criteria,
    duplicateRiskPercent: params.duplicateRiskPercent,
    overallQuality,
    grade: scoreToLetterGrade(overallQuality),
    visualTier: scoreToVisualTier(overallQuality),
    issues: params.issues,
    improvementsApplied: params.improvementsApplied,
    attempts: params.attempts,
    passed,
    status,
    coverageMap: params.coverageMap,
  };
}

export function aggregateQualityMetrics(
  reports: KnowledgeQualityReport[],
  moduleId?: string
): QualityPipelineMetrics {
  if (reports.length === 0) {
    return {
      averageQualityScore: 0,
      averageGrade: "—",
      lessonsAutoImproved: 0,
      lessonsAutoRejected: 0,
      duplicateRate: 0,
      averageRetrievalScore: 0,
      averageAnswerQuality: 0,
      averageReadability: 0,
      topWeakModules: [],
      readyCount: 0,
      blockedCount: 0,
    };
  }

  const sum = reports.reduce(
    (acc, r) => {
      acc.quality += r.overallQuality;
      acc.retrieval += r.criteria.retrievalQuality;
      acc.answer += r.criteria.answerQuality;
      acc.readability += r.criteria.humanReadability;
      acc.dup += r.duplicateRiskPercent;
      if (r.attempts > 1) acc.improved++;
      if (r.status === "rejected") acc.rejected++;
      if (r.status === "ready") acc.ready++;
      else acc.blocked++;
      return acc;
    },
    { quality: 0, retrieval: 0, answer: 0, readability: 0, dup: 0, improved: 0, rejected: 0, ready: 0, blocked: 0 }
  );

  const n = reports.length;
  return {
    averageQualityScore: Math.round(sum.quality / n),
    averageGrade: scoreToLetterGrade(sum.quality / n),
    lessonsAutoImproved: sum.improved,
    lessonsAutoRejected: sum.rejected,
    duplicateRate: Math.round(sum.dup / n),
    averageRetrievalScore: Math.round(sum.retrieval / n),
    averageAnswerQuality: Math.round(sum.answer / n),
    averageReadability: Math.round(sum.readability / n),
    topWeakModules: moduleId ? [{ moduleId, count: sum.blocked }] : [],
    readyCount: sum.ready,
    blockedCount: sum.blocked,
  };
}

export function reportCacheKey(draft: {
  question: string;
  answer: string;
  keywords: string[];
}): string {
  return `${draft.question.trim().toLowerCase()}|${draft.answer.length}|${draft.keywords.slice(0, 5).join(",")}`;
}
