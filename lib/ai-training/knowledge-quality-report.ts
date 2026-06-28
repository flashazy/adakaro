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

export interface ScoreExplanation {
  strengths: string[];
  minorDeductions: string[];
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
  confidenceReasons: string[];
  scoreExplanation: ScoreExplanation;
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

export const CRITERION_TOOLTIPS: Record<QualityCriterionKey, string> = {
  questionQuality: "Clarity, usefulness, and natural phrasing for school administrators.",
  duplicateDetection: "Whether this lesson duplicates an existing question or intent.",
  curriculumCoverage: "How meaningfully this lesson contributes to module curriculum.",
  answerQuality: "Correctness, completeness, structure, and professional tone.",
  retrievalQuality: "Keywords, synonyms, and search phrases for accurate retrieval.",
  writingStandard: "Adherence to the Adakaro Knowledge Writing Standard.",
  humanReadability: "Natural consultant-style language — not robotic AI phrasing.",
  knowledgeHealth: "Category, priority, and metadata completeness.",
};

export function computeReviewerConfidence(
  criteria: QualityCriterionScores,
  overallQuality: number,
  duplicateRiskPercent: number,
  issues: string[]
): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];

  const factualBase =
    criteria.retrievalQuality * 0.3 +
    criteria.answerQuality * 0.35 +
    criteria.duplicateDetection * 0.2 +
    criteria.knowledgeHealth * 0.15;

  let confidence: number;
  if (overallQuality >= 95) {
    confidence = 92 + Math.min(7, Math.round(((factualBase - 82) / 18) * 7));
  } else if (overallQuality >= 90) {
    confidence = 85 + Math.min(10, Math.round(((factualBase - 72) / 28) * 10));
  } else if (overallQuality >= 80) {
    confidence = 70 + Math.min(14, Math.round(((factualBase - 58) / 42) * 14));
  } else if (overallQuality >= 65) {
    confidence = 55 + Math.min(15, Math.round(((factualBase - 45) / 55) * 15));
  } else {
    confidence = Math.max(40, Math.min(69, Math.round(factualBase * 0.62)));
  }

  if (criteria.retrievalQuality < 88) {
    reasons.push("Limited source diversity in retrieval metadata");
    confidence -= 2;
  }
  if (criteria.retrievalQuality < 75) {
    reasons.push("Few supporting keywords for factual lookup");
  }
  if (duplicateRiskPercent >= 40 && !issues.some((i) => i.includes("Different intent"))) {
    reasons.push("Similar phrasing found in existing knowledge");
    confidence -= 3;
  }
  if (issues.some((i) => /brief|concise|partial/i.test(i))) {
    reasons.push("Answer inferred from partial curriculum coverage");
    confidence -= 2;
  }
  if (criteria.answerQuality < 88) {
    reasons.push("Answer completeness could be stronger for verification");
  }
  if (criteria.duplicateDetection >= 95 && duplicateRiskPercent < 15) {
    reasons.push("No duplicate detected — high retrieval confidence");
  }

  if (overallQuality >= 95) {
    confidence = Math.max(92, Math.min(99, confidence));
  } else if (overallQuality >= 90) {
    confidence = Math.max(85, Math.min(95, confidence));
  } else if (overallQuality >= 80) {
    confidence = Math.max(70, Math.min(84, confidence));
  } else if (overallQuality >= 65) {
    confidence = Math.max(55, Math.min(69, confidence));
  } else {
    confidence = Math.max(40, Math.min(69, confidence));
  }

  if (reasons.length === 0 && overallQuality >= 90) {
    reasons.push("Strong retrieval metadata and answer structure");
  }

  return { confidence: Math.round(confidence), reasons: [...new Set(reasons)].slice(0, 4) };
}

export function buildScoreExplanation(
  report: Pick<
    KnowledgeQualityReport,
    "breakdown" | "criteria" | "duplicateRiskPercent" | "duplicateFalsePositive" | "confidenceReasons"
  >
): ScoreExplanation {
  const strengths: string[] = [];
  const minorDeductions: string[] = [];

  if (report.criteria.answerQuality >= 88) strengths.push("Strong answer quality");
  if (report.criteria.curriculumCoverage >= 88) strengths.push("Good curriculum alignment");
  if (report.duplicateRiskPercent < 25 || report.duplicateFalsePositive) {
    strengths.push("No duplicate detected");
  }
  if (report.criteria.humanReadability >= 88) strengths.push("Clear, natural wording");
  if (report.criteria.writingStandard >= 88) strengths.push("Complete structured format");
  if (report.criteria.questionQuality >= 88) strengths.push("Useful, admin-ready question");

  for (const item of report.breakdown) {
    for (const d of item.deductions) {
      if (d.points <= 8) {
        minorDeductions.push(`− ${d.reason}`);
      }
    }
  }

  for (const reason of report.confidenceReasons) {
    if (/limited|few|partial|could be/i.test(reason)) {
      minorDeductions.push(`− Confidence reduced: ${reason.toLowerCase()}`);
    }
  }

  return {
    strengths: [...new Set(strengths)].slice(0, 6),
    minorDeductions: [...new Set(minorDeductions)].slice(0, 5),
  };
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

  const { confidence: reviewerConfidence, reasons: confidenceReasons } =
    computeReviewerConfidence(
      params.criteria,
      overallQuality,
      params.duplicateRiskPercent,
      params.issues
    );

  const partialReport = {
    breakdown,
    criteria: params.criteria,
    duplicateRiskPercent: params.duplicateRiskPercent,
    duplicateFalsePositive: params.duplicateFalsePositive ?? false,
    confidenceReasons,
  };
  const scoreExplanation = buildScoreExplanation(partialReport);

  return {
    criteria: params.criteria,
    breakdown,
    duplicateRiskPercent: params.duplicateRiskPercent,
    duplicateFalsePositive: params.duplicateFalsePositive ?? false,
    overallQuality,
    grade: scoreToLetterGrade(overallQuality),
    visualTier: scoreToVisualTier(overallQuality),
    reviewerConfidence,
    confidenceReasons,
    scoreExplanation,
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
