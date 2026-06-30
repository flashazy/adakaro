import { normalizeQuestionForDedup } from "./keyword-generator";
import { inferIntentWithConfidence } from "./intent-registry";
import {
  compareKnowledgeEntities,
  entityExplanation,
  extractKnowledgeEntity,
  getRelatedLessonTemplates,
  type ExtractedKnowledgeEntity,
} from "./knowledge-entities";
import {
  compareIntentSignatures,
  computeQuestionStructureSimilarity,
  inferIntentSignature,
  type IntentSignature,
  type IntentSignatureCategory,
} from "./intent-signature";
import { meaningfulTokens, normalizeText, scoreCandidate } from "./knowledge-scoring";
import { computeEntryQuality } from "./scoring";
import type { AIKnowledgeEntry, KnowledgeHealthLevel } from "./types";

export type DuplicateClassification =
  | "exact_duplicate"
  | "near_duplicate"
  | "related_topic"
  | "different_intent";

export type DuplicateConfidenceLevel =
  | "different_topic"
  | "related_topic"
  | "possible_duplicate"
  | "likely_duplicate"
  | "true_duplicate";

export const DUPLICATE_CONFIDENCE_LABELS: Record<DuplicateConfidenceLevel, string> = {
  different_topic: "Different topic",
  related_topic: "Related topic",
  possible_duplicate: "Possible duplicate",
  likely_duplicate: "Likely duplicate",
  true_duplicate: "True duplicate",
};

export interface DuplicateScoreBreakdown {
  intentSimilarity: number;
  entitySimilarity: number;
  productReference: number;
  topicSimilarity: number;
  categoryMatch: number;
  semanticSimilarity: number;
  keywordOverlap: number;
  searchPhraseOverlap: number;
  questionStructure: number;
  combined: number;
}

export interface SuggestedRelatedLesson {
  question: string;
  entryId: string | null;
  reason: string;
  inDatabase: boolean;
}

export interface DuplicateExplanation {
  summary: string;
  recommendation: string;
  confidenceLevel: DuplicateConfidenceLevel;
  confidenceLabel: string;
  entityNote: string | null;
}

export interface SimilarEntryMatch {
  entry: AIKnowledgeEntry;
  similarity: number;
  matchReasons: string[];
  isExact: boolean;
  classification: DuplicateClassification;
  scores: DuplicateScoreBreakdown;
  entryIntentSignature: IntentSignature;
  currentEntity: ExtractedKnowledgeEntity | null;
  entryEntity: ExtractedKnowledgeEntity | null;
  explanation: DuplicateExplanation;
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
  suggestedRelatedLessons: SuggestedRelatedLesson[];
  intentComparison: IntentComparison | null;
  currentIntentSignature: IntentSignature;
  currentEntity: ExtractedKnowledgeEntity | null;
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

export type DuplicateSaveRecommendation =
  | "exact_duplicate"
  | "near_duplicate"
  | "related_entry"
  | "safe_to_save";

export const DUPLICATE_SAVE_RECOMMENDATION_LABELS: Record<DuplicateSaveRecommendation, string> = {
  exact_duplicate: "Exact Duplicate",
  near_duplicate: "Near Duplicate",
  related_entry: "Related Entry",
  safe_to_save: "Safe to Save",
};

export function resolveDuplicateSaveRecommendation(
  result: DuplicateCheckResult | null
): DuplicateSaveRecommendation {
  if (!result) return "safe_to_save";
  if (result.exactMatch) return "exact_duplicate";
  if (result.nearDuplicateMatch) {
    const entityDiff =
      result.nearDuplicateMatch.currentEntity &&
      result.nearDuplicateMatch.entryEntity &&
      result.nearDuplicateMatch.scores.entitySimilarity < 0.25;
    if (entityDiff) return "related_entry";
    return "near_duplicate";
  }
  const top = result.similar[0] ?? result.differentIntentEntries[0];
  if (
    top &&
    (top.classification === "different_intent" ||
      top.classification === "related_topic" ||
      top.scores.entitySimilarity < 0.25)
  ) {
    return "related_entry";
  }
  return "safe_to_save";
}

const INTENT_DIFFERENT_CAP = 0.35;
export const NEAR_DUPLICATE_MIN = 0.72;
const ENTITY_DIFFERENT_CAP = 0.35;

export function resolveDuplicateConfidenceLevel(
  combinedPercent: number
): DuplicateConfidenceLevel {
  if (combinedPercent >= 95) return "true_duplicate";
  if (combinedPercent >= 80) return "likely_duplicate";
  if (combinedPercent >= 60) return "possible_duplicate";
  if (combinedPercent >= 35) return "related_topic";
  return "different_topic";
}

function categoryMatchScore(categoryA: string, categoryB: string): number {
  if (!categoryA || !categoryB) return 0.5;
  return normalizeText(categoryA) === normalizeText(categoryB) ? 1 : 0.15;
}

function topicSimilarityScore(
  question: string,
  entry: AIKnowledgeEntry,
  qEntity: ExtractedKnowledgeEntity | null,
  eEntity: ExtractedKnowledgeEntity | null
): number {
  if (qEntity && eEntity) {
    return compareKnowledgeEntities(qEntity, eEntity);
  }
  return jaccardSimilarity(question, entry.question);
}

function searchPhraseOverlapScore(question: string, entry: AIKnowledgeEntry): number {
  let best = 0;
  const normalizedQ = normalizeText(question);

  for (const phrase of entry.search_phrases) {
    const normalized = normalizeText(phrase);
    if (normalized.length >= 4 && normalizedQ.includes(normalized)) {
      best = Math.max(best, 0.95);
    }
    best = Math.max(best, scoreCandidate(question, phrase) * 0.9);
  }

  return best;
}

function buildCombinedScore(scores: Omit<DuplicateScoreBreakdown, "combined">): number {
  return (
    scores.intentSimilarity * 0.28 +
    scores.entitySimilarity * 0.22 +
    scores.semanticSimilarity * 0.16 +
    scores.topicSimilarity * 0.1 +
    scores.keywordOverlap * 0.08 +
    scores.searchPhraseOverlap * 0.06 +
    scores.categoryMatch * 0.05 +
    scores.questionStructure * 0.05
  );
}

function buildDuplicateExplanation(input: {
  classification: DuplicateClassification;
  combined: number;
  scores: DuplicateScoreBreakdown;
  qEntity: ExtractedKnowledgeEntity | null;
  eEntity: ExtractedKnowledgeEntity | null;
  qSig: IntentSignature;
  eSig: IntentSignature;
}): DuplicateExplanation {
  const percent = Math.round(input.combined * 100);
  const confidenceLevel = resolveDuplicateConfidenceLevel(percent);
  const entityNote = entityExplanation(input.qEntity, input.eEntity);

  let recommendation = recommendationForClassification(input.classification);
  if (entityNote) {
    recommendation = entityNote;
  } else if (input.qSig.category !== input.eSig.category) {
    recommendation = `These questions serve different intents (${input.qSig.label} vs ${input.eSig.label}). Save as a new lesson.`;
  }

  let summary = `${percent}% overall similarity — ${DUPLICATE_CONFIDENCE_LABELS[confidenceLevel]}.`;
  if (entityNote) {
    summary = entityNote;
  } else if (input.scores.intentSimilarity < 0.5) {
    summary = `Intent differs (${Math.round(input.scores.intentSimilarity * 100)}% intent match). These are related topics, not duplicates.`;
  }

  return {
    summary,
    recommendation,
    confidenceLevel,
    confidenceLabel: DUPLICATE_CONFIDENCE_LABELS[confidenceLevel],
    entityNote,
  };
}

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

function classifyDuplicateMatch(input: {
  isExact: boolean;
  scores: DuplicateScoreBreakdown;
  qSig: IntentSignature;
  eSig: IntentSignature;
  qEntity: ExtractedKnowledgeEntity | null;
  eEntity: ExtractedKnowledgeEntity | null;
}): DuplicateClassification {
  const { isExact, scores, qSig, eSig, qEntity, eEntity } = input;

  if (isExact) return "exact_duplicate";

  const entitiesDiffer =
    qEntity &&
    eEntity &&
    compareKnowledgeEntities(qEntity, eEntity) < 0.25;

  if (entitiesDiffer) return "different_intent";

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

  if (scores.combined >= 0.35 || scores.semanticSimilarity >= 0.35) {
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
  entry: AIKnowledgeEntry,
  options?: { category?: string }
): {
  similarity: number;
  reasons: string[];
  isExact: boolean;
  classification: DuplicateClassification;
  scores: DuplicateScoreBreakdown;
  entryIntentSignature: IntentSignature;
  currentEntity: ExtractedKnowledgeEntity | null;
  entryEntity: ExtractedKnowledgeEntity | null;
  explanation: DuplicateExplanation;
  recommendation: string;
} {
  const normalized = normalizeQuestionForDedup(question);
  const entryNormalized =
    entry.normalized_question ?? normalizeQuestionForDedup(entry.question);
  const reasons: string[] = [];

  const qSig = inferIntentSignature(question);
  const eSig = resolveEntryIntentSignature(entry);
  const qEntity = extractKnowledgeEntity(question);
  const eEntity = extractKnowledgeEntity(entry.question);

  const baseExactScores = (): DuplicateScoreBreakdown => ({
    intentSimilarity: 1,
    entitySimilarity: compareKnowledgeEntities(qEntity, eEntity),
    productReference: compareKnowledgeEntities(qEntity, eEntity),
    topicSimilarity: 1,
    categoryMatch: categoryMatchScore(options?.category ?? "", entry.category),
    semanticSimilarity: 1,
    keywordOverlap: 1,
    searchPhraseOverlap: 1,
    questionStructure: 1,
    combined: 1,
  });

  if (normalized === entryNormalized) {
    const scores = baseExactScores();
    const explanation = buildDuplicateExplanation({
      classification: "exact_duplicate",
      combined: 1,
      scores,
      qEntity,
      eEntity,
      qSig,
      eSig,
    });
    return {
      similarity: 1,
      reasons: ["Exact normalized match"],
      isExact: true,
      classification: "exact_duplicate",
      scores,
      entryIntentSignature: eSig,
      currentEntity: qEntity,
      entryEntity: eEntity,
      explanation,
      recommendation: explanation.recommendation,
    };
  }

  if (normalizeText(question) === normalizeText(entry.question)) {
    const scores = { ...baseExactScores(), combined: 0.99, semanticSimilarity: 0.99 };
    const explanation = buildDuplicateExplanation({
      classification: "exact_duplicate",
      combined: 0.99,
      scores,
      qEntity,
      eEntity,
      qSig,
      eSig,
    });
    return {
      similarity: 0.99,
      reasons: ["Exact question match"],
      isExact: true,
      classification: "exact_duplicate",
      scores,
      entryIntentSignature: eSig,
      currentEntity: qEntity,
      entryEntity: eEntity,
      explanation,
      recommendation: explanation.recommendation,
    };
  }

  const intentSimilarity = resolveIntentSimilarity(question, entry, qSig, eSig);
  const entitySimilarity = compareKnowledgeEntities(qEntity, eEntity);
  const productReference = entitySimilarity;
  const questionStructure = computeQuestionStructureSimilarity(
    question,
    entry.question,
    qSig,
    eSig
  );
  const semanticSimilarity = computeSemanticSimilarity(question, entry);
  const keywordOverlap = jaccardSimilarity(question, entry.question);
  const searchPhraseOverlap = searchPhraseOverlapScore(question, entry);
  const topicSimilarity = topicSimilarityScore(question, entry, qEntity, eEntity);
  const categoryMatch = categoryMatchScore(
    options?.category ?? "",
    entry.category
  );

  if (semanticSimilarity >= 0.5) reasons.push("Similar question wording");
  if (keywordOverlap >= 0.35) reasons.push("Shared keywords");
  if (searchPhraseOverlap >= 0.45) reasons.push("Matches search phrase");
  if (intentSimilarity >= 0.85 && qSig.category === eSig.category) {
    reasons.push(`Same intent (${eSig.label})`);
  } else if (qSig.category !== eSig.category) {
    reasons.push(`Different intent (${qSig.label} vs ${eSig.label})`);
  }
  if (qEntity && eEntity && entitySimilarity < 0.25) {
    reasons.push(`Different entity (${qEntity.label} vs ${eEntity.label})`);
  } else if (qEntity && eEntity && entitySimilarity >= 0.9) {
    reasons.push(`Same entity (${qEntity.label})`);
  }

  const entitiesDiffer = qEntity && eEntity && entitySimilarity < 0.25;
  const intentsDiffer =
    intentSimilarity < 0.85 || qSig.category !== eSig.category;

  let combined: number;
  if (entitiesDiffer) {
    combined = Math.min(
      semanticSimilarity * 0.35 +
        keywordOverlap * 0.25 +
        searchPhraseOverlap * 0.2 +
        questionStructure * 0.1,
      ENTITY_DIFFERENT_CAP
    );
  } else if (intentsDiffer) {
    combined = Math.min(
      buildCombinedScore({
        intentSimilarity,
        entitySimilarity,
        productReference,
        topicSimilarity,
        categoryMatch,
        semanticSimilarity,
        keywordOverlap,
        searchPhraseOverlap,
        questionStructure,
      }),
      INTENT_DIFFERENT_CAP
    );
  } else {
    combined = buildCombinedScore({
      intentSimilarity,
      entitySimilarity,
      productReference,
      topicSimilarity,
      categoryMatch,
      semanticSimilarity,
      keywordOverlap,
      searchPhraseOverlap,
      questionStructure,
    });
  }

  const scores: DuplicateScoreBreakdown = {
    intentSimilarity,
    entitySimilarity,
    productReference,
    topicSimilarity,
    categoryMatch,
    semanticSimilarity,
    keywordOverlap,
    searchPhraseOverlap,
    questionStructure,
    combined,
  };

  const classification = classifyDuplicateMatch({
    isExact: false,
    scores,
    qSig,
    eSig,
    qEntity,
    eEntity,
  });

  const explanation = buildDuplicateExplanation({
    classification,
    combined,
    scores,
    qEntity,
    eEntity,
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
    currentEntity: qEntity,
    entryEntity: eEntity,
    explanation,
    recommendation: explanation.recommendation,
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
    category?: string;
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

    const result = computeQuestionSimilarity(question, entry, {
      category: options?.category,
    });
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
      currentEntity: result.currentEntity,
      entryEntity: result.entryEntity,
      explanation: result.explanation,
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

function buildSuggestedRelatedLessons(
  question: string,
  entries: AIKnowledgeEntry[],
  currentIntent: IntentSignatureCategory,
  excludeId?: string
): SuggestedRelatedLesson[] {
  const entity = extractKnowledgeEntity(question);
  if (!entity) return [];

  const templates = getRelatedLessonTemplates(entity.id, currentIntent);
  const suggestions: SuggestedRelatedLesson[] = [];

  for (const template of templates) {
    const norm = normalizeText(template.question);
    const existing = entries.find(
      (e) =>
        e.id !== excludeId &&
        e.status === "active" &&
        (normalizeText(e.question) === norm ||
          normalizeText(e.question).includes(norm))
    );

    suggestions.push({
      question: template.question,
      entryId: existing?.id ?? null,
      inDatabase: Boolean(existing),
      reason: existing
        ? "Existing related lesson in knowledge base"
        : "Recommended companion lesson for this entity",
    });
  }

  // Also surface same-entity different-intent entries from DB
  for (const entry of entries) {
    if (entry.id === excludeId || entry.status === "archived") continue;
    const entryEntity = extractKnowledgeEntity(entry.question);
    if (!entryEntity || entryEntity.id !== entity.id) continue;
    if (normalizeText(entry.question) === normalizeText(question)) continue;

    const entryIntent = inferIntentSignature(entry.question);
    if (entryIntent.category === currentIntent) continue;

    if (suggestions.some((s) => s.entryId === entry.id)) continue;

    suggestions.push({
      question: entry.question,
      entryId: entry.id,
      inDatabase: true,
      reason: `Related ${entryIntent.label.toLowerCase()} lesson for ${entity.label}`,
    });
  }

  return suggestions.slice(0, 8);
}

export function checkQuestionDuplicates(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: { excludeId?: string; category?: string }
): DuplicateCheckResult {
  const normalizedQuestion = normalizeQuestionForDedup(question);
  const currentIntentSignature = inferIntentSignature(question);
  const currentEntity = extractKnowledgeEntity(question);

  const allMatches = findSimilarEntries(question, entries, {
    excludeId: options?.excludeId,
    minSimilarity: 0.35,
    limit: 8,
    includeDifferentIntent: true,
    category: options?.category,
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

  const suggestedRelatedLessons = buildSuggestedRelatedLessons(
    question,
    entries,
    currentIntentSignature.category,
    options?.excludeId
  );

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
    suggestedRelatedLessons,
    intentComparison: buildIntentComparison(
      question,
      topForComparison,
      currentIntentSignature
    ),
    currentIntentSignature,
    currentEntity,
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
      entitySimilarity: Math.round(item.scores.entitySimilarity * 100),
      productReference: Math.round(item.scores.productReference * 100),
      topicSimilarity: Math.round(item.scores.topicSimilarity * 100),
      categoryMatch: Math.round(item.scores.categoryMatch * 100),
      semanticSimilarity: Math.round(item.scores.semanticSimilarity * 100),
      keywordOverlap: Math.round(item.scores.keywordOverlap * 100),
      searchPhraseOverlap: Math.round(item.scores.searchPhraseOverlap * 100),
      questionStructure: Math.round(item.scores.questionStructure * 100),
      combined: Math.round(item.scores.combined * 100),
      meaning: Math.round(item.scores.semanticSimilarity * 100),
    },
    entryIntentSignature: item.entryIntentSignature,
    currentEntity: item.currentEntity,
    entryEntity: item.entryEntity,
    explanation: item.explanation,
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
    suggestedRelatedLessons: result.suggestedRelatedLessons,
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
    currentEntity: result.currentEntity,
  };
}
