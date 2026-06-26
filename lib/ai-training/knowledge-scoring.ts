import type { AIKnowledgeEntry, KnowledgePriority } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";
import {
  KEYWORD_CANDIDATE_MIN_SCORE,
  KEYWORD_CANDIDATE_POOL_SIZE,
} from "./embedding-config";

/** Common words excluded from token overlap (still allowed inside multi-word phrases). */
export const SCORING_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "and",
  "or",
  "but",
  "with",
  "their",
  "my",
  "your",
  "is",
  "are",
  "do",
  "does",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "can",
  "i",
  "me",
  "we",
  "you",
  "it",
  "its",
  "in",
  "on",
  "at",
  "by",
  "from",
  "as",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "each",
  "there",
  "here",
  "also",
  "just",
  "only",
  "very",
  "so",
  "not",
  "no",
  "yes",
  "about",
  "this",
  "that",
  "these",
  "those",
  "if",
  "then",
  "than",
]);

/** Single tokens that must not earn a high substring match on their own. */
export const GENERIC_SINGLE_TERMS = new Set([
  "student",
  "students",
  "record",
  "records",
  "plan",
  "plans",
  "can",
  "pay",
  "class",
  "classes",
  "school",
  "schools",
  "data",
  "information",
  "fee",
  "fees",
  "payment",
  "payments",
  "stream",
  "streams",
  "parent",
  "parents",
  "teacher",
  "teachers",
  "admin",
  "feature",
  "features",
]);

const PLURAL_NORMALIZE: Record<string, string> = {
  students: "student",
  records: "record",
  classes: "class",
  streams: "stream",
  fees: "fee",
  payments: "payment",
  schools: "school",
  parents: "parent",
  teachers: "teacher",
  plans: "plan",
  features: "feature",
};

const FIELD_WEIGHTS = {
  question: 1,
  search_phrases: 0.95,
  alternative_wording: 0.9,
  keywords: 0.75,
  synonyms: 0.7,
  related_terms: 0.5,
} as const;

const PRIORITY_RANK: Record<KnowledgePriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export interface EntryScoreBreakdown {
  score: number;
  phraseOverlap: number;
  questionScore: number;
  searchPhraseScore: number;
  priorityBoost: number;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeToken(token: string): string {
  const lower = token.toLowerCase();
  return PLURAL_NORMALIZE[lower] ?? lower;
}

export function meaningfulTokens(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((t) => t.length > 1)
    .map(normalizeToken)
    .filter((t) => !SCORING_STOP_WORDS.has(t));
}

function meaningfulTokenSet(text: string): Set<string> {
  return new Set(meaningfulTokens(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isGenericSingleTerm(token: string): boolean {
  const normalized = normalizeToken(token);
  return GENERIC_SINGLE_TERMS.has(normalized);
}

/**
 * Substring score — no 0.85 for generic single-word hits inside the query.
 */
export function substringScore(query: string, candidate: string): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;

  const candidateTokens = c.split(" ").filter((t) => t.length > 0);
  const meaningfulInCandidate = candidateTokens
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !SCORING_STOP_WORDS.has(t));

  const contained = c.includes(q) || q.includes(c);
  if (!contained) return 0;

  if (candidateTokens.length === 1) {
    const token = normalizeToken(candidateTokens[0]!);
    if (isGenericSingleTerm(token)) return 0;
    if (token.length >= 4) return 0.72;
    return 0;
  }

  if (meaningfulInCandidate.length >= 2) return 0.85;
  if (meaningfulInCandidate.length === 1) return 0.45;
  return 0;
}

/** Share of query bigrams (meaningful tokens) found inside candidate text. */
export function phraseOverlapRatio(query: string, candidate: string): number {
  const qTokens = meaningfulTokens(query);
  if (qTokens.length < 2) return 0;

  const cNorm = normalizeText(candidate);
  let matched = 0;
  const total = qTokens.length - 1;

  for (let i = 0; i < qTokens.length - 1; i++) {
    const bigram = `${qTokens[i]} ${qTokens[i + 1]}`;
    if (cNorm.includes(bigram)) matched++;
  }

  return total === 0 ? 0 : matched / total;
}

/** Max bigram overlap between query and any high-intent field text. */
export function entryPhraseOverlap(query: string, entry: AIKnowledgeEntry): number {
  const fields = [
    entry.question,
    ...entry.search_phrases,
    ...entry.alternative_wording,
  ];
  let best = 0;
  for (const field of fields) {
    best = Math.max(best, phraseOverlapRatio(query, field));
  }
  return best;
}

export function scoreCandidate(query: string, candidate: string): number {
  const sub = substringScore(query, candidate);
  const jac = jaccard(meaningfulTokenSet(query), meaningfulTokenSet(candidate));
  const phrase = phraseOverlapRatio(query, candidate);

  let score = Math.max(sub, jac);
  if (phrase > 0) {
    const phraseScore = 0.55 + phrase * 0.4;
    score = Math.max(score, phraseScore);
  }

  return Math.min(1, score);
}

function scoreField(
  query: string,
  candidate: string,
  weight: number
): number {
  return scoreCandidate(query, candidate) * weight;
}

function priorityBoost(priority: KnowledgePriority): number {
  if (priority === "critical") return 0.08;
  if (priority === "high") return 0.05;
  if (priority === "low") return -0.02;
  return 0;
}

export function scoreEntryBreakdown(
  query: string,
  entry: AIKnowledgeEntry
): EntryScoreBreakdown {
  let bestWeighted = 0;
  let questionScore = 0;
  let searchPhraseScore = 0;

  questionScore = scoreField(query, entry.question, FIELD_WEIGHTS.question);
  bestWeighted = Math.max(bestWeighted, questionScore);

  for (const phrase of entry.search_phrases) {
    const s = scoreField(query, phrase, FIELD_WEIGHTS.search_phrases);
    searchPhraseScore = Math.max(searchPhraseScore, s);
    bestWeighted = Math.max(bestWeighted, s);
  }

  for (const alt of entry.alternative_wording) {
    bestWeighted = Math.max(
      bestWeighted,
      scoreField(query, alt, FIELD_WEIGHTS.alternative_wording)
    );
  }

  for (const kw of entry.keywords) {
    bestWeighted = Math.max(
      bestWeighted,
      scoreField(query, kw, FIELD_WEIGHTS.keywords)
    );
  }

  for (const syn of entry.synonyms ?? []) {
    bestWeighted = Math.max(
      bestWeighted,
      scoreField(query, syn, FIELD_WEIGHTS.synonyms)
    );
  }

  for (const term of entry.related_terms) {
    bestWeighted = Math.max(
      bestWeighted,
      scoreField(query, term, FIELD_WEIGHTS.related_terms)
    );
  }

  const boost = priorityBoost(entry.priority);
  const phraseOverlap = entryPhraseOverlap(query, entry);

  return {
    score: Math.min(1, bestWeighted + boost),
    phraseOverlap,
    questionScore,
    searchPhraseScore,
    priorityBoost: boost,
  };
}

export function scoreEntry(query: string, entry: AIKnowledgeEntry): number {
  return scoreEntryBreakdown(query, entry).score;
}

export function compareRankedEntries(
  a: { entry: AIKnowledgeEntry; breakdown: EntryScoreBreakdown },
  b: { entry: AIKnowledgeEntry; breakdown: EntryScoreBreakdown }
): number {
  const scoreDiff = b.breakdown.score - a.breakdown.score;
  if (Math.abs(scoreDiff) > 0.005) return scoreDiff;

  const phraseDiff = b.breakdown.phraseOverlap - a.breakdown.phraseOverlap;
  if (Math.abs(phraseDiff) > 0.001) return phraseDiff;

  const questionDiff = b.breakdown.questionScore - a.breakdown.questionScore;
  if (Math.abs(questionDiff) > 0.001) return questionDiff;

  const searchDiff =
    b.breakdown.searchPhraseScore - a.breakdown.searchPhraseScore;
  if (Math.abs(searchDiff) > 0.001) return searchDiff;

  const prioDiff =
    PRIORITY_RANK[b.entry.priority] - PRIORITY_RANK[a.entry.priority];
  if (prioDiff !== 0) return prioDiff;

  const usageDiff = b.entry.usage_count - a.entry.usage_count;
  if (usageDiff !== 0) return usageDiff;

  return 0;
}

export interface RankedKnowledgeEntry {
  entry: AIKnowledgeEntry;
  score: number;
  breakdown: EntryScoreBreakdown;
}

export function rankKnowledgeEntriesScored(
  query: string,
  entries: AIKnowledgeEntry[]
): RankedKnowledgeEntry[] {
  return entries
    .map((entry) => {
      const breakdown = scoreEntryBreakdown(query, entry);
      return { entry, score: breakdown.score, breakdown };
    })
    .filter((m) => m.score >= MATCH_SCORE_THRESHOLD)
    .sort(compareRankedEntries);
}

/** Top keyword candidates for semantic re-ranking (wider pool, lower floor). */
export function rankKeywordCandidates(
  query: string,
  entries: AIKnowledgeEntry[],
  limit = KEYWORD_CANDIDATE_POOL_SIZE
): RankedKnowledgeEntry[] {
  return entries
    .map((entry) => {
      const breakdown = scoreEntryBreakdown(query, entry);
      return { entry, score: breakdown.score, breakdown };
    })
    .filter((m) => m.score >= KEYWORD_CANDIDATE_MIN_SCORE)
    .sort(compareRankedEntries)
    .slice(0, limit);
}

export { MATCH_SCORE_THRESHOLD, FIELD_WEIGHTS };
