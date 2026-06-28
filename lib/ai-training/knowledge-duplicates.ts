import { normalizeQuestionForDedup } from "./keyword-generator";
import { inferIntentWithConfidence } from "./intent-registry";
import {
  compareIntentSignatures,
  computeQuestionStructureSimilarity,
  inferIntentSignature,
  type IntentSignature,
} from "./intent-signature";
import { meaningfulTokens, normalizeText, scoreCandidate } from "./knowledge-scoring";
import { computeEntryQuality } from "./scoring";
import type { AIKnowledgeEntry, KnowledgeHealthLevel } from "./types";

export type DuplicateClassification =
  | "exact_duplicate"
  | "near_duplicate"
  | "related_topic"
  | "different_intent";

export interface DuplicateScoreBreakdown {
  intentSimilarity: number;
  questionStructure: number;
  semanticSimilarity: number;
  keywordOverlap: number;
  combined: number;
}

export interface SimilarEntryMatch {
  entry: AIKnowledgeEntry;
  similarity: number;
  matchReasons: string[];
  isExact: boolean;
  classification: DuplicateClassification;
  scores: DuplicateScoreBreakdown;
  entryIntentSignature: IntentSignature;
  recommendation: string;
}

export interface IntentComparison {
  existingQuestion: string;
  existingIntent: IntentSignature;
  currentQuestion: string;
  currentIntent: IntentSignature;
  status: DuplicateClassification;
  recommendation: string;
}

export interface DuplicateCheckResult {
  normalizedQuestion: string;
  exactMatch: SimilarEntryMatch | null;
  similar: SimilarEntryMatch[];
  nearDuplicateMatch: SimilarEntryMatch | null;
  suggestedIntentKey: string | null;
  suggestedIntentName: string | null;
  suggestedCategory: string | null;
  relatedEntries: SimilarEntryMatch[];
  differentIntentEntries: SimilarEntryMatch[];
  intentComparison: IntentComparison | null;
  currentIntentSignature: IntentSignature;
}

export const DUPLICATE_CLASSIFICATION_LABELS: Record<DuplicateClassification, string> = {
  exact_duplicate: "Exact Duplicate",
  near_duplicate: "Near Duplicate",
  related_topic: "Related Topic",
  different_intent: "Different Intent",
};

export const DUPLICATE_CLASSIFICATION_STYLES: Record<
  DuplicateClassification,
  { border: string; bg: string; text: string; badge: string }
> = {
  exact_duplicate: {
    border: "border-red-200",
    bg: "bg-red-50/70",
    text: "text-red-900",
    badge: "bg-red-100 text-red-800 ring-red-200",
  },
  near_duplicate: {
    border: "border-orange-200",
    bg: "bg-orange-50/70",
    text: "text-orange-900",
    badge: "bg-orange-100 text-orange-800 ring-orange-200",
  },
  related_topic: {
    border: "border-sky-200",
    bg: "bg-sky-50/70",
    text: "text-sky-900",
    badge: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  different_intent: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/70",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
};

const INTENT_DIFFERENT_CAP = 0.7;
const NEAR_DUPLICATE_MIN = 0.72;

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function tokenSet(text: string): Set<string> {
  return new Set(meaningfulTokens(text));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function phraseOverlapScore(question: string, entry: AIKnowledgeEntry): number {
  let best = 0;
  const normalizedQ = normalizeText(question);

  for (const phrase of [
    ...entry.search_phrases,
    ...entry.alternative_wording,
    ...(entry.synonyms ?? []),
  ]) {
    const normalized = normalizeText(phrase);
    if (normalized.length >= 4 && normalizedQ.includes(normalized)) {
      best = Math.max(best, 0.92);
    }
    best = Math.max(best, scoreCandidate(question, phrase) * 0.85);
  }

  for (const kw of entry.keywords) {
    best = Math.max(best, scoreCandidate(question, kw) * 0.7);
  }

  return best;
}

function computeSemanticSimilarity(
  question: string,
  entry: AIKnowledgeEntry
): number {
  let similarity = 0;

  const questionSim = scoreCandidate(question, entry.question);
  if (questionSim >= 0.5) {
    similarity = Math.max(similarity, questionSim);
  }

  const phraseScore = phraseOverlapScore(question, entry);
  if (phraseScore >= 0.45) {
    similarity = Math.max(similarity, phraseScore);
  }

  return Math.min(0.98, similarity);
}

function resolveEntryIntentSignature(entry: AIKnowledgeEntry): IntentSignature {
  if (entry.intent_key) {
    const fromQuestion = inferIntentSignature(entry.question);
    if (fromQuestion.category !== "general") return fromQuestion;
  }
  return inferIntentSignature(entry.question);
}

function resolveIntentSimilarity(
  question: string,
  entry: AIKnowledgeEntry,
  qSig: IntentSignature,
  eSig: IntentSignature
): number {
  let similarity = compareIntentSignatures(qSig, eSig);

  if (
    entry.intent_key &&
    inferIntentWithConfidence(question, entry.category)?.key === entry.intent_key
  ) {
    similarity = Math.max(similarity, 0.95);
  }

  return similarity;
}

function buildCombinedScore(scores: Omit<DuplicateScoreBreakdown, "combined">): number {
  return (
    scores.intentSimilarity * 0.5 +
    scores.questionStructure * 0.2 +
    scores.semanticSimilarity * 0.2 +
    scores.keywordOverlap * 0.1
  );
}

function classifyDuplicateMatch(input: {
  isExact: boolean;
  scores: DuplicateScoreBreakdown;
  qSig: IntentSignature;
  eSig: IntentSignature;
}): DuplicateClassification {
  const { isExact, scores, qSig, eSig } = input;

  if (isExact) return "exact_duplicate";

  const sameIntent =
    scores.intentSimilarity >= 0.85 && qSig.category === eSig.category;

  if (sameIntent) {
    if (scores.combined >= NEAR_DUPLICATE_MIN || scores.questionStructure >= 0.75) {
      return "near_duplicate";
    }
    if (scores.combined >= 0.45 || scores.semanticSimilarity >= 0.45) {
      return "related_topic";
    }
    return "related_topic";
  }

  if (scores.semanticSimilarity >= 0.35 || scores.keywordOverlap >= 0.35) {
    return "different_intent";
  }

  return "different_intent";
}

function recommendationForClassification(
  classification: DuplicateClassification
): string {
  switch (classification) {
    case "exact_duplicate":
      return "Update the existing entry instead of creating a duplicate.";
    case "near_duplicate":
      return "These questions share the same intent. Consider merging metadata or updating the existing entry.";
    case "related_topic":
      return "Related topic detected. Review overlap before saving.";
    case "different_intent":
      return "Create a new knowledge entry.";
  }
}

export function computeQuestionSimilarity(
  question: string,
  entry: AIKnowledgeEntry
): {
  similarity: number;
  reasons: string[];
  isExact: boolean;
  classification: DuplicateClassification;
  scores: DuplicateScoreBreakdown;
  entryIntentSignature: IntentSignature;
  recommendation: string;
} {
  const normalized = normalizeQuestionForDedup(question);
  const entryNormalized =
    entry.normalized_question ?? normalizeQuestionForDedup(entry.question);
  const reasons: string[] = [];

  const qSig = inferIntentSignature(question);
  const eSig = resolveEntryIntentSignature(entry);

  if (normalized === entryNormalized) {
    const scores: DuplicateScoreBreakdown = {
      intentSimilarity: 1,
      questionStructure: 1,
      semanticSimilarity: 1,
      keywordOverlap: 1,
      combined: 1,
    };
    return {
      similarity: 1,
      reasons: ["Exact normalized match"],
      isExact: true,
      classification: "exact_duplicate",
      scores,
      entryIntentSignature: eSig,
      recommendation: recommendationForClassification("exact_duplicate"),
    };
  }

  if (normalizeText(question) === normalizeText(entry.question)) {
    const scores: DuplicateScoreBreakdown = {
      intentSimilarity: 1,
      questionStructure: 1,
      semanticSimilarity: 0.99,
      keywordOverlap: 1,
      combined: 0.99,
    };
    return {
      similarity: 0.99,
      reasons: ["Exact question match"],
      isExact: true,
      classification: "exact_duplicate",
      scores,
      entryIntentSignature: eSig,
      recommendation: recommendationForClassification("exact_duplicate"),
    };
  }

  const intentSimilarity = resolveIntentSimilarity(question, entry, qSig, eSig);
  const questionStructure = computeQuestionStructureSimilarity(
    question,
    entry.question,
    qSig,
    eSig
  );
  const semanticSimilarity = computeSemanticSimilarity(question, entry);
  const keywordOverlap = jaccardSimilarity(question, entry.question);

  if (semanticSimilarity >= 0.5) reasons.push("Similar question wording");
  if (keywordOverlap >= 0.35) reasons.push("Shared keywords");
  if (semanticSimilarity >= 0.45 && phraseOverlapScore(question, entry) >= 0.45) {
    reasons.push("Matches search phrase or synonym");
  }
  if (intentSimilarity >= 0.85 && qSig.category === eSig.category) {
    reasons.push(`Same intent (${eSig.label})`);
  } else if (qSig.category !== eSig.category) {
    reasons.push(`Different intent (${qSig.label} vs ${eSig.label})`);
  }

  const intentsDiffer =
    intentSimilarity < 0.85 || qSig.category !== eSig.category;

  let combined: number;
  if (intentsDiffer) {
    combined = Math.min(
      semanticSimilarity * 0.55 +
        keywordOverlap * 0.35 +
        questionStructure * 0.1,
      INTENT_DIFFERENT_CAP
    );
  } else {
    combined = buildCombinedScore({
      intentSimilarity,
      questionStructure,
      semanticSimilarity,
      keywordOverlap,
    });
  }

  const scores: DuplicateScoreBreakdown = {
    intentSimilarity,
    questionStructure,
    semanticSimilarity,
    keywordOverlap,
    combined,
  };

  const classification = classifyDuplicateMatch({
    isExact: false,
    scores,
    qSig,
    eSig,
  });

  return {
    similarity: Math.min(0.98, combined),
    reasons: reasons.length ? reasons : ["Possible overlap"],
    isExact: false,
    classification,
    scores,
    entryIntentSignature: eSig,
    recommendation: recommendationForClassification(classification),
  };
}

export function findSimilarEntries(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: {
    excludeId?: string;
    minSimilarity?: number;
    limit?: number;
    activePrimaryOnly?: boolean;
    includeDifferentIntent?: boolean;
  }
): SimilarEntryMatch[] {
  const minSimilarity = options?.minSimilarity ?? 0.35;
  const limit = options?.limit ?? 8;
  const includeDifferentIntent = options?.includeDifferentIntent !== false;
  const matches: SimilarEntryMatch[] = [];

  for (const entry of entries) {
    if (options?.excludeId && entry.id === options.excludeId) continue;
    if (entry.status === "archived") continue;
    if (entry.merged_into_id) continue;
    if (options?.activePrimaryOnly !== false && entry.is_primary === false) continue;

    const result = computeQuestionSimilarity(question, entry);
    const hasTopicOverlap =
      result.scores.semanticSimilarity >= 0.3 ||
      result.scores.keywordOverlap >= 0.25;

    if (result.classification === "different_intent" && !includeDifferentIntent) {
      continue;
    }
    if (
      result.similarity < minSimilarity &&
      !result.isExact &&
      !(result.classification === "different_intent" && hasTopicOverlap)
    ) {
      continue;
    }

    matches.push({
      entry,
      similarity: result.similarity,
      matchReasons: result.reasons,
      isExact: result.isExact,
      classification: result.classification,
      scores: result.scores,
      entryIntentSignature: result.entryIntentSignature,
      recommendation: result.recommendation,
    });
  }

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function buildIntentComparison(
  question: string,
  topMatch: SimilarEntryMatch | null,
  currentIntent: IntentSignature
): IntentComparison | null {
  if (!topMatch) return null;

  return {
    existingQuestion: topMatch.entry.question,
    existingIntent: topMatch.entryIntentSignature,
    currentQuestion: question,
    currentIntent,
    status: topMatch.classification,
    recommendation: topMatch.recommendation,
  };
}

export function checkQuestionDuplicates(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: { excludeId?: string; category?: string }
): DuplicateCheckResult {
  const normalizedQuestion = normalizeQuestionForDedup(question);
  const currentIntentSignature = inferIntentSignature(question);

  const allMatches = findSimilarEntries(question, entries, {
    excludeId: options?.excludeId,
    minSimilarity: 0.35,
    limit: 8,
    includeDifferentIntent: true,
  });

  const exactMatch =
    allMatches.find(
      (m) =>
        m.isExact ||
        m.classification === "exact_duplicate" ||
        m.similarity >= 0.98
    ) ?? null;

  const nearDuplicateMatch =
    allMatches.find(
      (m) =>
        m.classification === "near_duplicate" &&
        m.entry.id !== exactMatch?.entry.id
    ) ?? null;

  const similar = allMatches.filter(
    (m) =>
      m.classification === "exact_duplicate" ||
      m.classification === "near_duplicate" ||
      m.classification === "related_topic"
  );

  const differentIntentEntries = allMatches.filter(
    (m) => m.classification === "different_intent"
  );

  const inference = inferIntentWithConfidence(question, options?.category);
  const intentKey = inference?.key ?? exactMatch?.entry.intent_key ?? null;

  const relatedEntries = intentKey
    ? allMatches.filter(
        (m) =>
          m.entry.intent_key === intentKey &&
          m.entry.id !== exactMatch?.entry.id &&
          m.classification !== "different_intent"
      )
    : [];

  const topForComparison = exactMatch ?? nearDuplicateMatch ?? allMatches[0] ?? null;

  return {
    normalizedQuestion,
    exactMatch,
    similar,
    nearDuplicateMatch,
    suggestedIntentKey: intentKey,
    suggestedIntentName: inference?.name ?? exactMatch?.entry.intent_name ?? null,
    suggestedCategory: inference?.group ?? options?.category ?? null,
    relatedEntries,
    differentIntentEntries,
    intentComparison: buildIntentComparison(
      question,
      topForComparison,
      currentIntentSignature
    ),
    currentIntentSignature,
  };
}

export function computeKnowledgeHealth(
  entry: AIKnowledgeEntry,
  allEntries: AIKnowledgeEntry[]
): { level: KnowledgeHealthLevel; issues: string[] } {
  const issues: string[] = [];

  const duplicates = findSimilarEntries(entry.question, allEntries, {
    excludeId: entry.id,
    minSimilarity: 0.85,
    limit: 1,
    includeDifferentIntent: false,
  }).filter(
    (m) =>
      m.classification === "exact_duplicate" ||
      m.classification === "near_duplicate"
  );

  if (duplicates.length > 0) issues.push("Duplicate exists");

  if (!entry.intent_key) issues.push("Missing intent");
  if (entry.keywords.length < 3) issues.push("Low keyword coverage");
  if (entry.search_phrases.length < 1) issues.push("Missing search phrases");
  if ((entry.synonyms ?? []).length < 1) issues.push("Missing synonyms");
  if (entry.related_terms.length < 1) issues.push("Missing related terms");

  const quality = computeEntryQuality(entry);
  if (quality.level === "needs_improvement") issues.push("Low quality score");

  return {
    level: issues.length === 0 ? "healthy" : "needs_review",
    issues,
  };
}

export function mergeStringArrays(...arrays: string[][]): string[] {
  return uniqueStrings(arrays.flat());
}

export function normalizedQuestionField(question: string): string {
  return normalizeQuestionForDedup(question);
}

export function serializeDuplicateCheckForApi(result: DuplicateCheckResult) {
  const mapMatch = (item: SimilarEntryMatch) => ({
    entry: {
      id: item.entry.id,
      question: item.entry.question,
      category: item.entry.category,
      intent_key: item.entry.intent_key ?? null,
      version_number: item.entry.version_number ?? 1,
      health_status: item.entry.health_status ?? "needs_review",
    },
    similarity: Math.round(item.similarity * 100),
    matchReasons: item.matchReasons,
    isExact: item.isExact,
    classification: item.classification,
    classificationLabel: DUPLICATE_CLASSIFICATION_LABELS[item.classification],
    scores: {
      intentSimilarity: Math.round(item.scores.intentSimilarity * 100),
      questionStructure: Math.round(item.scores.questionStructure * 100),
      semanticSimilarity: Math.round(item.scores.semanticSimilarity * 100),
      keywordOverlap: Math.round(item.scores.keywordOverlap * 100),
      combined: Math.round(item.scores.combined * 100),
    },
    entryIntentSignature: item.entryIntentSignature,
    recommendation: item.recommendation,
  });

  return {
    normalizedQuestion: result.normalizedQuestion,
    exactMatch: result.exactMatch ? mapMatch(result.exactMatch) : null,
    nearDuplicateMatch: result.nearDuplicateMatch
      ? mapMatch(result.nearDuplicateMatch)
      : null,
    similar: result.similar.map(mapMatch),
    suggestedIntentKey: result.suggestedIntentKey,
    suggestedIntentName: result.suggestedIntentName,
    suggestedCategory: result.suggestedCategory,
    relatedEntries: result.relatedEntries.map(mapMatch),
    differentIntentEntries: result.differentIntentEntries.map(mapMatch),
    intentComparison: result.intentComparison
      ? {
          existingQuestion: result.intentComparison.existingQuestion,
          existingIntent: result.intentComparison.existingIntent,
          currentQuestion: result.intentComparison.currentQuestion,
          currentIntent: result.intentComparison.currentIntent,
          status: result.intentComparison.status,
          statusLabel:
            DUPLICATE_CLASSIFICATION_LABELS[result.intentComparison.status],
          recommendation: result.intentComparison.recommendation,
        }
      : null,
    currentIntentSignature: result.currentIntentSignature,
  };
}
