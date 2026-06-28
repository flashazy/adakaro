/**
 * Knowledge Quality Engine — rules, thresholds, and patterns.
 * Calibrated for experienced human reviewer behaviour (not perfectionism).
 */

export const QUALITY_PASS_THRESHOLD = 90;
export const QUALITY_HUMAN_REVIEW_THRESHOLD = 80;
export const QUALITY_REJECT_THRESHOLD = 65;
export const MAX_AUTO_IMPROVE_ATTEMPTS = 3;
export const CALIBRATION_MODE_ENV = "ADAKARO_QUALITY_CALIBRATION_MODE";

/** Weighted criteria (must sum to 1). */
export const QUALITY_CRITERION_WEIGHTS = {
  questionQuality: 0.15,
  duplicateDetection: 0.15,
  curriculumCoverage: 0.15,
  answerQuality: 0.2,
  retrievalQuality: 0.1,
  writingStandard: 0.1,
  humanReadability: 0.1,
  knowledgeHealth: 0.05,
} as const;

/** Max points per criterion on a 100-point scale (matches weights). */
export const QUALITY_CRITERION_MAX_POINTS: Record<keyof typeof QUALITY_CRITERION_WEIGHTS, number> = {
  questionQuality: 15,
  duplicateDetection: 15,
  curriculumCoverage: 15,
  answerQuality: 20,
  retrievalQuality: 10,
  writingStandard: 10,
  humanReadability: 10,
  knowledgeHealth: 5,
};

export type QualityCriterionKey = keyof typeof QUALITY_CRITERION_WEIGHTS;

export const QUALITY_CRITERION_LABELS: Record<QualityCriterionKey, string> = {
  questionQuality: "Question Quality",
  duplicateDetection: "Duplicate Detection",
  curriculumCoverage: "Coverage",
  answerQuality: "Answer Quality",
  retrievalQuality: "Retrieval",
  writingStandard: "Writing Standard",
  humanReadability: "Human Readability",
  knowledgeHealth: "Knowledge Health",
};

export type QualityVisualTier =
  | "excellent"
  | "ready"
  | "needs_improvement"
  | "human_review"
  | "reject";

export const QUALITY_TIER_STYLES: Record<
  QualityVisualTier,
  { label: string; className: string; min: number }
> = {
  excellent: {
    label: "Exceptional",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    min: 95,
  },
  ready: {
    label: "Ready",
    className: "bg-green-100 text-green-800 ring-green-200",
    min: 90,
  },
  needs_improvement: {
    label: "Needs Improvement",
    className: "bg-amber-100 text-amber-800 ring-amber-200",
    min: 80,
  },
  human_review: {
    label: "Human Review",
    className: "bg-orange-100 text-orange-800 ring-orange-200",
    min: 65,
  },
  reject: {
    label: "Reject",
    className: "bg-red-100 text-red-800 ring-red-200",
    min: 0,
  },
};

/** Truly vague questions — NOT general question marks. */
export const VAGUE_QUESTION_PATTERNS = [
  /^tell me about\b/i,
  /^what else\b/i,
  /^anything else\b/i,
  /^more info\b/i,
  /^explain adakaro\b/i,
  /^adakaro\?$/i,
];

export const WEAK_QUESTION_PATTERNS = [
  /^what is it\b/i,
  /^how does it work\?$/i,
  /^why\?$/i,
  /^can it\b/i,
];

/** Curriculum-relevant question stems that real admins ask. */
export const USEFUL_QUESTION_PATTERNS = [
  /^(what|how|can|does|is|are|who|why|when|where)\b/i,
  /\badakaro\b/i,
  /\b(school|teacher|parent|attendance|report|fee|student|secure|cloud|scale|pricing)\b/i,
];

export const COVERAGE_CONCEPT_MAP: Record<string, string> = {
  "platform-overview": "Identity",
  capabilities: "Capabilities",
  audience: "Target audience",
  users: "Target audience",
  benefits: "Benefits",
  origin: "History",
  problems: "Capabilities",
  differentiation: "Benefits",
  simplification: "Capabilities",
  cloud: "Technology",
  security: "Security",
  scale: "Deployment",
  "large-schools": "Deployment",
  "multi-school": "Deployment",
  devices: "Technology",
  spreadsheets: "Comparison",
  customization: "Deployment",
  offline: "Technology",
  modules: "Capabilities",
  administrators: "Target audience",
  cost: "Pricing",
  "free-plan": "Pricing",
  "pricing-model": "Pricing",
  "per-student": "Pricing",
  "billing-cycle": "Pricing",
  tiers: "Pricing",
  "billing-start": "Pricing",
  "free-limit": "Pricing",
};

export const ROBOTIC_PHRASES = [
  /\bas an ai\b/i,
  /\bi am unable to\b/i,
  /\bit is important to note\b/i,
  /\bin conclusion\b/i,
  /\bthis entry\b/i,
  /\bknowledge base\b/i,
];

/** Soft minimums — partial credit below these. */
export const MIN_RETRIEVAL_COUNTS = {
  keywords: 3,
  synonyms: 1,
  search_phrases: 1,
  alternative_wording: 1,
  related_terms: 1,
} as const;

export const IDEAL_RETRIEVAL_COUNTS = {
  keywords: 5,
  synonyms: 2,
  search_phrases: 2,
  alternative_wording: 2,
  related_terms: 2,
} as const;

export function mapTopicToCoverageConcept(topicTag: string, intentLabel: string): string {
  return COVERAGE_CONCEPT_MAP[topicTag] ?? intentLabel ?? topicTag;
}

export function scoreToVisualTier(score: number): QualityVisualTier {
  if (score >= 95) return "excellent";
  if (score >= 90) return "ready";
  if (score >= 80) return "needs_improvement";
  if (score >= 65) return "human_review";
  return "reject";
}

export function scoreToLetterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "Needs Review";
}

export function resolvePipelineStatus(
  overallQuality: number,
  forceRejected: boolean
): "ready" | "needs_human_improvement" | "rejected" {
  if (forceRejected || overallQuality < QUALITY_REJECT_THRESHOLD) return "rejected";
  if (overallQuality >= QUALITY_PASS_THRESHOLD) return "ready";
  return "needs_human_improvement";
}

export function isCalibrationModeEnabled(flag?: boolean): boolean {
  if (flag === true) return true;
  if (typeof process !== "undefined" && process.env?.[CALIBRATION_MODE_ENV] === "1") {
    return true;
  }
  return false;
}
