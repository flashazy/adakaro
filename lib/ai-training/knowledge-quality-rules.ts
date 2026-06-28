/**
 * Knowledge Quality Engine — rules, thresholds, and patterns.
 */

export const QUALITY_PASS_THRESHOLD = 90;
export const MAX_AUTO_IMPROVE_ATTEMPTS = 3;

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

export type QualityCriterionKey = keyof typeof QUALITY_CRITERION_WEIGHTS;

export const QUALITY_CRITERION_LABELS: Record<QualityCriterionKey, string> = {
  questionQuality: "Question Quality",
  duplicateDetection: "Duplicate Risk",
  curriculumCoverage: "Coverage",
  answerQuality: "Answer Quality",
  retrievalQuality: "Retrieval",
  writingStandard: "Writing Standard",
  humanReadability: "Human Readability",
  knowledgeHealth: "Knowledge Health",
};

export type QualityVisualTier = "excellent" | "ready" | "needs_improvement" | "reject";

export const QUALITY_TIER_STYLES: Record<
  QualityVisualTier,
  { label: string; className: string; min: number }
> = {
  excellent: {
    label: "Excellent",
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
  reject: {
    label: "Reject",
    className: "bg-red-100 text-red-800 ring-red-200",
    min: 0,
  },
};

/** Vague or poor question patterns. */
export const VAGUE_QUESTION_PATTERNS = [
  /^tell me about\b/i,
  /^what else\b/i,
  /^anything else\b/i,
  /^more info\b/i,
  /^explain adakaro\b/i,
  /^adakaro\?$/i,
  /\?\s*$/,
];

export const WEAK_QUESTION_PATTERNS = [
  /^what is it\b/i,
  /^how does it work\?$/i,
  /^why\?$/i,
  /^can it\b/i,
];

/** Coverage concept buckets for curriculum gap analysis. */
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
  /\bplease note that\b/i,
  /\bit is important to note\b/i,
  /\bin conclusion\b/i,
  /\bthis entry\b/i,
  /\bknowledge base\b/i,
];

export const MIN_RETRIEVAL_COUNTS = {
  keywords: 4,
  synonyms: 2,
  search_phrases: 2,
  alternative_wording: 1,
  related_terms: 2,
} as const;

export function mapTopicToCoverageConcept(topicTag: string, intentLabel: string): string {
  return COVERAGE_CONCEPT_MAP[topicTag] ?? intentLabel ?? topicTag;
}

export function scoreToVisualTier(score: number): QualityVisualTier {
  if (score >= 95) return "excellent";
  if (score >= 90) return "ready";
  if (score >= 80) return "needs_improvement";
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
