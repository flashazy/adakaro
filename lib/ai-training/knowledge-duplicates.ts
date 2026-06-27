import { normalizeQuestionForDedup } from "./keyword-generator";
import { inferIntentWithConfidence } from "./intent-registry";
import { meaningfulTokens, normalizeText, scoreCandidate } from "./knowledge-scoring";
import { computeEntryQuality } from "./scoring";
import type { AIKnowledgeEntry, KnowledgeHealthLevel } from "./types";

export interface SimilarEntryMatch {
  entry: AIKnowledgeEntry;
  similarity: number;
  matchReasons: string[];
  isExact: boolean;
}

export interface DuplicateCheckResult {
  normalizedQuestion: string;
  exactMatch: SimilarEntryMatch | null;
  similar: SimilarEntryMatch[];
  suggestedIntentKey: string | null;
  suggestedIntentName: string | null;
  suggestedCategory: string | null;
  relatedEntries: SimilarEntryMatch[];
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

export function computeQuestionSimilarity(
  question: string,
  entry: AIKnowledgeEntry
): { similarity: number; reasons: string[]; isExact: boolean } {
  const normalized = normalizeQuestionForDedup(question);
  const entryNormalized =
    entry.normalized_question ?? normalizeQuestionForDedup(entry.question);
  const reasons: string[] = [];

  if (normalized === entryNormalized) {
    return { similarity: 1, reasons: ["Exact normalized match"], isExact: true };
  }

  if (normalizeText(question) === normalizeText(entry.question)) {
    return { similarity: 0.99, reasons: ["Exact question match"], isExact: true };
  }

  let similarity = 0;

  const questionSim = scoreCandidate(question, entry.question);
  if (questionSim >= 0.5) {
    similarity = Math.max(similarity, questionSim);
    reasons.push("Similar question wording");
  }

  const jaccard = jaccardSimilarity(question, entry.question);
  if (jaccard >= 0.35) {
    similarity = Math.max(similarity, 0.55 + jaccard * 0.4);
    reasons.push("Shared keywords");
  }

  const phraseScore = phraseOverlapScore(question, entry);
  if (phraseScore >= 0.45) {
    similarity = Math.max(similarity, phraseScore);
    reasons.push("Matches search phrase or synonym");
  }

  if (
    entry.intent_key &&
    inferIntentWithConfidence(question, entry.category)?.key === entry.intent_key
  ) {
    similarity = Math.max(similarity, 0.72);
    reasons.push(`Same intent (${entry.intent_key})`);
  }

  return {
    similarity: Math.min(0.98, similarity),
    reasons: reasons.length ? reasons : ["Possible overlap"],
    isExact: false,
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
  }
): SimilarEntryMatch[] {
  const minSimilarity = options?.minSimilarity ?? 0.72;
  const limit = options?.limit ?? 8;
  const matches: SimilarEntryMatch[] = [];

  for (const entry of entries) {
    if (options?.excludeId && entry.id === options.excludeId) continue;
    if (entry.status === "archived") continue;
    if (entry.merged_into_id) continue;
    if (options?.activePrimaryOnly !== false && entry.is_primary === false) continue;

    const { similarity, reasons, isExact } = computeQuestionSimilarity(question, entry);
    if (similarity < minSimilarity) continue;

    matches.push({
      entry,
      similarity,
      matchReasons: reasons,
      isExact,
    });
  }

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export function checkQuestionDuplicates(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: { excludeId?: string; category?: string }
): DuplicateCheckResult {
  const normalizedQuestion = normalizeQuestionForDedup(question);
  const similar = findSimilarEntries(question, entries, {
    excludeId: options?.excludeId,
    minSimilarity: 0.72,
    limit: 6,
  });

  const exactMatch =
    similar.find((m) => m.isExact || m.similarity >= 0.98) ?? null;

  const inference = inferIntentWithConfidence(question, options?.category);
  const intentKey = inference?.key ?? exactMatch?.entry.intent_key ?? null;

  const relatedEntries = intentKey
    ? findSimilarEntries(question, entries, {
        excludeId: options?.excludeId,
        minSimilarity: 0.55,
        limit: 5,
      }).filter((m) => m.entry.intent_key === intentKey && m.entry.id !== exactMatch?.entry.id)
    : [];

  return {
    normalizedQuestion,
    exactMatch,
    similar,
    suggestedIntentKey: intentKey,
    suggestedIntentName: inference?.name ?? exactMatch?.entry.intent_name ?? null,
    suggestedCategory: inference?.group ?? options?.category ?? null,
    relatedEntries,
  };
}

export function computeKnowledgeHealth(
  entry: AIKnowledgeEntry,
  allEntries: AIKnowledgeEntry[]
): { level: KnowledgeHealthLevel; issues: string[] } {
  const issues: string[] = [];

  const duplicates = findSimilarEntries(entry.question, allEntries, {
    excludeId: entry.id,
    minSimilarity: 0.9,
    limit: 1,
  });
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
  });

  return {
    normalizedQuestion: result.normalizedQuestion,
    exactMatch: result.exactMatch ? mapMatch(result.exactMatch) : null,
    similar: result.similar.map(mapMatch),
    suggestedIntentKey: result.suggestedIntentKey,
    suggestedIntentName: result.suggestedIntentName,
    suggestedCategory: result.suggestedCategory,
    relatedEntries: result.relatedEntries.map(mapMatch),
  };
}
