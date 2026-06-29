/**
 * Fact Scorer — multi-signal scoring with lesson provenance for selected published lessons.
 */

import { normalizeText } from "@/lib/ai-training/knowledge-scoring";
import type { QuestionContext } from "./context-engine";
import { containsPlaceholderContent } from "./placeholder-guard";
import type { AuthorIntent, ExtractedFact, FactScoreBreakdown, ScoredFact } from "./types";

const INTENT_TOPIC_KEYWORDS: Record<AuthorIntent, string[]> = {
  identity: [
    "school",
    "administrator",
    "teacher",
    "parent",
    "audience",
    "built",
    "platform",
    "management",
    "adakaro",
    "users",
    "who",
    "purpose",
    "designed",
  ],
  capabilities: [
    "module",
    "feature",
    "capability",
    "attendance",
    "finance",
    "report",
    "portal",
    "enrollment",
    "student",
    "supports",
    "provides",
    "includes",
    "enables",
  ],
  process: [
    "step",
    "configure",
    "setup",
    "import",
    "upload",
    "create",
    "enable",
    "open",
    "navigate",
    "click",
    "select",
    "required",
  ],
  pricing: [
    "price",
    "pricing",
    "plan",
    "cost",
    "billing",
    "subscription",
    "free",
    "tier",
    "payment",
    "limit",
    "upgrade",
  ],
  finance: [
    "fee",
    "invoice",
    "receipt",
    "payment",
    "balance",
    "finance",
    "billing",
    "ledger",
    "collection",
  ],
  general: ["adakaro", "school", "module", "feature", "administrator"],
};

/** Phrase-level blocks only — never block on a single broad keyword like "pricing". */
const INTENT_BLOCK_PHRASES: Record<AuthorIntent, string[]> = {
  identity: [
    "excel upload",
    "archive student",
    "subscription plan",
    "billing cycle",
    "free up to",
    "import spreadsheet",
    "how much does",
    "pricing plan",
  ],
  capabilities: ["subscription cost", "free forever", "billing cycle"],
  process: ["pricing only", "mission statement"],
  pricing: ["attendance module setup", "import students csv", "report card design"],
  finance: ["parent portal login steps"],
  general: [],
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter((t) => setB.has(t)).length;
  return clampScore((matches / Math.max(a.length, b.length)) * 100);
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function computeEntityScore(fact: ExtractedFact, entity: string): number {
  const text = fact.normalizedText;
  const normalizedEntity = normalizeText(entity);
  if (!normalizedEntity || normalizedEntity === "topic") return 40;
  if (text.includes(normalizedEntity)) return 100;
  const entityTokens = tokenize(entity);
  return tokenOverlap(fact.tokens, entityTokens);
}

function computeSemanticScore(fact: ExtractedFact, context: QuestionContext): number {
  const questionTokens = tokenize(context.question);
  const categoryTokens = tokenize(context.category);
  const metadataTokens = [
    ...context.metadataKeywords,
    ...context.metadataRelatedTerms,
  ].flatMap((term) => tokenize(term));

  const questionOverlap = tokenOverlap(fact.tokens, questionTokens);
  const categoryOverlap = tokenOverlap(fact.tokens, categoryTokens);
  const metadataOverlap = tokenOverlap(fact.tokens, metadataTokens);

  return clampScore(questionOverlap * 0.5 + categoryOverlap * 0.25 + metadataOverlap * 0.25);
}

function computeIntentScore(fact: ExtractedFact, intent: AuthorIntent): number {
  const keywords = INTENT_TOPIC_KEYWORDS[intent];
  let score = tokenOverlap(fact.tokens, keywords);

  const hint = fact.sectionHint?.toLowerCase() ?? "";
  const intentSections: Record<AuthorIntent, string[]> = {
    identity: ["overview", "audience", "purpose", "key facts"],
    capabilities: ["overview", "capabilities", "modules", "benefits"],
    process: ["overview", "requirements", "steps", "expected result"],
    pricing: ["overview", "plans", "limits", "billing"],
    finance: ["overview", "how it works", "configuration"],
    general: ["overview", "purpose", "key facts"],
  };

  for (const section of intentSections[intent] ?? []) {
    if (hint.includes(section)) {
      score = Math.max(score, 85);
      break;
    }
  }

  return clampScore(score);
}

function computeEvidenceScore(fact: ExtractedFact): number {
  const text = fact.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 2) return 0;
  if (containsPlaceholderContent(text)) return 0;
  if (/^(overview|purpose|notes|audience|capabilities)$/i.test(text)) return 0;

  let score = 50;
  if (wordCount >= 4) score += 15;
  if (wordCount >= 8) score += 10;
  if (/[.!?]$/.test(text)) score += 10;
  if (fact.sectionHint) score += 10;
  if (/\b(is|are|supports|includes|provides|enables|manages|helps|built|designed)\b/i.test(text)) {
    score += 10;
  }

  return clampScore(score);
}

function computePublishedScore(fact: ExtractedFact): number {
  let score = 60;
  if (fact.tokens.length >= 4) score += 15;
  if (fact.sectionHint) score += 15;
  if (fact.sourceQuestion.trim().length > 0) score += 10;
  return clampScore(score);
}

function computeLessonProvenanceScore(
  sourceEntryId: string,
  selectedLessonScores: Map<string, number>
): number {
  const lessonScore = selectedLessonScores.get(sourceEntryId);
  if (lessonScore === undefined) return 0;
  return clampScore(lessonScore * 0.55);
}

function computePenalties(fact: ExtractedFact, intent: AuthorIntent): number {
  const normalized = fact.normalizedText;
  const phrases = INTENT_BLOCK_PHRASES[intent];
  let penalty = 0;

  for (const phrase of phrases) {
    if (normalized.includes(normalizeText(phrase))) {
      penalty += 50;
    }
  }

  return Math.min(100, penalty);
}

function computeFinalScore(breakdown: Omit<FactScoreBreakdown, "final">): number {
  const raw =
    breakdown.semantic * 0.18 +
    breakdown.entity * 0.14 +
    breakdown.intent * 0.18 +
    breakdown.evidence * 0.14 +
    breakdown.published * 0.08 +
    breakdown.lessonProvenance * 0.28 -
    breakdown.penalties;

  let final = clampScore(raw);

  if (
    breakdown.lessonProvenance >= 30 &&
    breakdown.evidence >= 50 &&
    breakdown.entity >= 35 &&
    breakdown.penalties < 50
  ) {
    final = Math.max(final, clampScore(52 + breakdown.lessonProvenance * 0.35));
  }

  return final;
}

export interface ScoreFactsOptions {
  selectedLessonScores?: Map<string, number>;
}

export function scoreFact(
  fact: ExtractedFact,
  context: QuestionContext,
  options?: ScoreFactsOptions
): ScoredFact {
  const selectedLessonScores = options?.selectedLessonScores ?? new Map<string, number>();
  const intent = context.route.intent;
  const entity = context.route.entity;

  const semantic = computeSemanticScore(fact, context);
  const entityScore = computeEntityScore(fact, entity);
  const intentScore = computeIntentScore(fact, intent);
  const evidence = computeEvidenceScore(fact);
  const published = computePublishedScore(fact);
  const lessonProvenance = computeLessonProvenanceScore(fact.sourceEntryId, selectedLessonScores);
  const penalties = computePenalties(fact, intent);

  const scoreBreakdown: FactScoreBreakdown = {
    semantic,
    entity: entityScore,
    intent: intentScore,
    evidence,
    published,
    lessonProvenance,
    penalties,
    final: 0,
  };

  scoreBreakdown.final = computeFinalScore(scoreBreakdown);

  return {
    ...fact,
    relevanceScore: scoreBreakdown.final,
    intentScore,
    topicScore: semantic,
    scoreBreakdown,
    detectedEntity: entityScore >= 50 ? entity : null,
    detectedIntent: intent,
  };
}

export function scoreFacts(
  facts: ExtractedFact[],
  context: QuestionContext,
  options?: ScoreFactsOptions
): ScoredFact[] {
  return facts.map((fact) => scoreFact(fact, context, options));
}

export function averageFactConfidence(facts: ScoredFact[]): number {
  if (facts.length === 0) return 0;
  return Math.round(
    facts.reduce((sum, fact) => sum + fact.relevanceScore, 0) / facts.length
  );
}
