import type { QualityCriterionKey } from "./knowledge-quality-rules";
import {
  QUALITY_CRITERION_LABELS,
  QUALITY_CRITERION_MAX_POINTS,
  QUALITY_CRITERION_WEIGHTS,
  QUALITY_PASS_THRESHOLD,
  resolvePipelineStatus,
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

export interface CriterionDeduction {
  reason: string;
  points: number;
}

export interface CriterionBreakdownItem {
  key: QualityCriterionKey;
  label: string;
  earned: number;
  max: number;
  percent: number;
  deductions: CriterionDeduction[];
}

export interface CalibrationAdjustment {
  rule: string;
  weight: number;
  originalScore: number;
  adjustedScore: number;
  reason: string;
}

export interface CoverageMapEntry {
  concept: string;
  covered: boolean;
  sourceQuestion?: string;
}

export interface KnowledgeQualityReport {
  criteria: QualityCriterionScores;
  breakdown: CriterionBreakdownItem[];
  duplicateRiskPercent: number;
  duplicateFalsePositive: boolean;
  overallQuality: number;
  grade: string;
  visualTier: QualityVisualTier;
  reviewerConfidence: number;
  issues: string[];
  primaryFailureReason: string | null;
  improvementsApplied: string[];
  attempts: number;
  passed: boolean;
  status: QualityPipelineStatus;
  coverageMap: CoverageMapEntry[];
  calibrationAdjustments?: CalibrationAdjustment[];
}

export interface QualityCategoryAverages {
  questionQuality: number;
  duplicateDetection: number;
  curriculumCoverage: number;
  answerQuality: number;
  retrievalQuality: number;
  writingStandard: number;
  humanReadability: number;
  knowledgeHealth: number;
}

export interface QualityPipelineMetrics {
  averageQualityScore: number;
  highestScore: number;
  lowestScore: number;
  averageGrade: string;
  averageByCategory: QualityCategoryAverages;
  mostCommonFailureReason: string | null;
  duplicateFalsePositives: number;
  averageImprovementGain: number;
  lessonsAutoImproved: number;
  lessonsAutoRejected: number;
  duplicateRate: number;
  averageRetrievalScore: number;
  averageAnswerQuality: number;
  averageReadability: number;
  averageConfidence: number;
  topWeakModules: Array<{ moduleId: string; count: number }>;
  readyCount: number;
  needsImprovementCount: number;
  blockedCount: number;
  rejectedCount: number;
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

export function buildCriterionBreakdown(
  criteria: QualityCriterionScores,
  deductions: Partial<Record<QualityCriterionKey, CriterionDeduction[]>> = {}
): CriterionBreakdownItem[] {
  return (Object.keys(criteria) as QualityCriterionKey[]).map((key) => {
    const max = QUALITY_CRITERION_MAX_POINTS[key];
    const percent = criteria[key];
    const earned = Math.round((percent / 100) * max * 10) / 10;
    return {
      key,
      label: QUALITY_CRITERION_LABELS[key],
      earned,
      max,
      percent,
      deductions: deductions[key] ?? [],
    };
  });
}

export function computeReviewerConfidence(
  criteria: QualityCriterionScores,
  overallQuality: number,
  duplicateRiskPercent: number,
  issues: string[]
): number {
  const values = Object.values(criteria);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length);
  const consistencyBonus = variance < 80 ? 6 : variance < 150 ? 3 : 0;
  const issuePenalty = Math.min(12, issues.length * 1.5);
  const dupPenalty = duplicateRiskPercent >= 70 ? 8 : duplicateRiskPercent >= 40 ? 4 : 0;

  return Math.max(
    40,
    Math.min(
      99,
      Math.round(overallQuality * 0.55 + mean * 0.25 + consistencyBonus - issuePenalty - dupPenalty + 8)
    )
  );
}

export function formatQualityReportSummary(report: KnowledgeQualityReport): string {
  const lines = report.breakdown.map(
    (item) => `${item.label}:\n${item.earned} / ${item.max}`
  );
  lines.push(`Final:\n${report.overallQuality}`);
  lines.push(`Grade:\n${report.grade}`);
  lines.push(`Confidence:\n${report.reviewerConfidence}%`);
  return lines.join("\n\n");
}

export function buildQualityReport(params: {
  criteria: QualityCriterionScores;
  duplicateRiskPercent: number;
  duplicateFalsePositive?: boolean;
  issues: string[];
  deductions?: Partial<Record<QualityCriterionKey, CriterionDeduction[]>>;
  improvementsApplied: string[];
  attempts: number;
  coverageMap: CoverageMapEntry[];
  forceRejected?: boolean;
  calibrationAdjustments?: CalibrationAdjustment[];
}): KnowledgeQualityReport {
  const breakdown = buildCriterionBreakdown(params.criteria, params.deductions ?? {});

  const overallQuality = Math.round(
    breakdown.reduce((sum, item) => sum + item.earned, 0)
  );

  const status = resolvePipelineStatus(overallQuality, params.forceRejected ?? false);
  const passed = overallQuality >= QUALITY_PASS_THRESHOLD && status === "ready";

  const failureCounts = new Map<string, number>();
  for (const item of breakdown) {
    for (const d of item.deductions) {
      failureCounts.set(d.reason, (failureCounts.get(d.reason) ?? 0) + 1);
    }
  }
  const primaryFailureReason =
    [...failureCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const reviewerConfidence = computeReviewerConfidence(
    params.criteria,
    overallQuality,
    params.duplicateRiskPercent,
    params.issues
  );

  return {
    criteria: params.criteria,
    breakdown,
    duplicateRiskPercent: params.duplicateRiskPercent,
    duplicateFalsePositive: params.duplicateFalsePositive ?? false,
    overallQuality,
    grade: scoreToLetterGrade(overallQuality),
    visualTier: scoreToVisualTier(overallQuality),
    reviewerConfidence,
    issues: params.issues,
    primaryFailureReason,
    improvementsApplied: params.improvementsApplied,
    attempts: params.attempts,
    passed,
    status,
    coverageMap: params.coverageMap,
    calibrationAdjustments: params.calibrationAdjustments,
  };
}

function averageCategory(reports: KnowledgeQualityReport[]): QualityCategoryAverages {
  if (reports.length === 0) {
    return buildEmptyCriteria();
  }
  const keys = Object.keys(buildEmptyCriteria()) as Array<keyof QualityCriterionScores>;
  const totals = buildEmptyCriteria();
  for (const report of reports) {
    for (const key of keys) {
      totals[key] += report.criteria[key];
    }
  }
  const n = reports.length;
  return {
    questionQuality: Math.round(totals.questionQuality / n),
    duplicateDetection: Math.round(totals.duplicateDetection / n),
    curriculumCoverage: Math.round(totals.curriculumCoverage / n),
    answerQuality: Math.round(totals.answerQuality / n),
    retrievalQuality: Math.round(totals.retrievalQuality / n),
    writingStandard: Math.round(totals.writingStandard / n),
    humanReadability: Math.round(totals.humanReadability / n),
    knowledgeHealth: Math.round(totals.knowledgeHealth / n),
  };
}

export function aggregateQualityMetrics(
  reports: KnowledgeQualityReport[],
  moduleId?: string,
  improvementGains: number[] = []
): QualityPipelineMetrics {
  if (reports.length === 0) {
    return {
      averageQualityScore: 0,
      highestScore: 0,
      lowestScore: 0,
      averageGrade: "—",
      averageByCategory: buildEmptyCriteria(),
      mostCommonFailureReason: null,
      duplicateFalsePositives: 0,
      averageImprovementGain: 0,
      lessonsAutoImproved: 0,
      lessonsAutoRejected: 0,
      duplicateRate: 0,
      averageRetrievalScore: 0,
      averageAnswerQuality: 0,
      averageReadability: 0,
      averageConfidence: 0,
      topWeakModules: [],
      readyCount: 0,
      needsImprovementCount: 0,
      blockedCount: 0,
      rejectedCount: 0,
    };
  }

  const scores = reports.map((r) => r.overallQuality);
  const failureReasons = new Map<string, number>();

  const sum = reports.reduce(
    (acc, r) => {
      acc.quality += r.overallQuality;
      acc.confidence += r.reviewerConfidence;
      acc.retrieval += r.criteria.retrievalQuality;
      acc.answer += r.criteria.answerQuality;
      acc.readability += r.criteria.humanReadability;
      acc.dup += r.duplicateRiskPercent;
      if (r.attempts > 0) acc.improved++;
      if (r.status === "rejected") acc.rejected++;
      if (r.status === "ready") acc.ready++;
      else if (r.status === "needs_human_improvement") acc.needsImprovement++;
      if (r.duplicateFalsePositive) acc.falseDup++;
      if (r.primaryFailureReason) {
        failureReasons.set(
          r.primaryFailureReason,
          (failureReasons.get(r.primaryFailureReason) ?? 0) + 1
        );
      }
      return acc;
    },
    {
      quality: 0,
      confidence: 0,
      retrieval: 0,
      answer: 0,
      readability: 0,
      dup: 0,
      improved: 0,
      rejected: 0,
      ready: 0,
      needsImprovement: 0,
      falseDup: 0,
    }
  );

  const n = reports.length;
  const avgGain =
    improvementGains.length > 0
      ? Math.round(improvementGains.reduce((a, b) => a + b, 0) / improvementGains.length)
      : 0;

  return {
    averageQualityScore: Math.round(sum.quality / n),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    averageGrade: scoreToLetterGrade(sum.quality / n),
    averageByCategory: averageCategory(reports),
    mostCommonFailureReason:
      [...failureReasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    duplicateFalsePositives: sum.falseDup,
    averageImprovementGain: avgGain,
    lessonsAutoImproved: sum.improved,
    lessonsAutoRejected: sum.rejected,
    duplicateRate: Math.round(sum.dup / n),
    averageRetrievalScore: Math.round(sum.retrieval / n),
    averageAnswerQuality: Math.round(sum.answer / n),
    averageReadability: Math.round(sum.readability / n),
    averageConfidence: Math.round(sum.confidence / n),
    topWeakModules: moduleId
      ? [{ moduleId, count: sum.needsImprovement + sum.rejected }]
      : [],
    readyCount: sum.ready,
    needsImprovementCount: sum.needsImprovement,
    blockedCount: sum.needsImprovement,
    rejectedCount: sum.rejected,
  };
}

export function reportCacheKey(draft: {
  question: string;
  answer: string;
  keywords: string[];
}): string {
  return `${draft.question.trim().toLowerCase()}|${draft.answer.length}|${draft.keywords.slice(0, 5).join(",")}`;
}

export { QUALITY_CRITERION_WEIGHTS };
