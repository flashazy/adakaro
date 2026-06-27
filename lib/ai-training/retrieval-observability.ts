import type { EntryScoreBreakdown } from "./knowledge-scoring";
import {
  meaningfulTokens,
  normalizeText,
  scoreEntryBreakdown,
} from "./knowledge-scoring";
import { normalizeQuestionForDedup } from "./keyword-generator";
import { scoreEntryWithMatches } from "./knowledge-search";
import { resolveEntryIntent } from "./intent-registry";
import type { AIKnowledgeEntry, KnowledgeHealthLevel } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";
import type { ZeroCostRetrievalResult } from "./zero-cost-retrieval";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";

export type RetrievalMethod =
  | "intent_match"
  | "semantic_search"
  | "keyword_match"
  | "hybrid_retrieval"
  | "knowledge_graph";

export type ResponseSource = "knowledge_base" | "clarification" | "none";

export type DisplayHealthStatus =
  | KnowledgeHealthLevel
  | "archived"
  | "deprecated";

export interface RetrievalObservability {
  matchedIntent: string | null;
  matchedIntentKey: string | null;
  matchedIntentName: string | null;
  matchedCategory: string | null;
  matchedEntryId: string | null;
  matchedQuestion: string | null;
  retrievalMethod: RetrievalMethod | null;
  matchScore: number;
  matchedKeywords: string[];
  matchedSearchPhrase: string | null;
  knowledgeVersion: number | null;
  isPrimaryEntry: boolean;
  healthStatus: DisplayHealthStatus | null;
  retrievalExplanation: string;
  responseSource: ResponseSource;
  noMatchReason: string | null;
}

export function resolveDisplayIntent(entry: AIKnowledgeEntry): {
  display: string;
  intentKey: string | null;
  intentName: string | null;
  category: string;
} {
  const intent = resolveEntryIntent(entry);
  const display =
    intent.intent_name ??
    intent.intent_group ??
    entry.category ??
    "General";

  return {
    display,
    intentKey: intent.intent_key,
    intentName: intent.intent_name,
    category: entry.category,
  };
}

export function resolveEntryHealthStatus(
  entry: AIKnowledgeEntry
): DisplayHealthStatus {
  if (entry.status === "archived") return "archived";
  if (entry.is_primary === false || entry.merged_into_id) return "deprecated";
  return entry.health_status ?? "needs_review";
}

export function inferRetrievalMethod(
  breakdown: EntryScoreBreakdown,
  semanticScore?: number | null
): RetrievalMethod {
  const scores: Array<{ method: RetrievalMethod; score: number }> = [
    { method: "intent_match", score: breakdown.intentScore },
    { method: "knowledge_graph", score: breakdown.graphScore },
    {
      method: "keyword_match",
      score: Math.max(breakdown.questionScore, breakdown.searchPhraseScore),
    },
  ];

  if (semanticScore != null && semanticScore > 0.05) {
    scores.push({ method: "semantic_search", score: semanticScore });
  }

  const significant = scores
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score);

  if (significant.length >= 2) return "hybrid_retrieval";
  if (significant[0]) return significant[0].method;
  if (breakdown.phraseOverlap >= 0.5) return "keyword_match";
  return "keyword_match";
}

export function buildRetrievalExplanation(
  breakdown: EntryScoreBreakdown,
  method: RetrievalMethod | null,
  matchedKeywords: string[],
  matchedSearchPhrase: string | null
): string {
  if (breakdown.questionScore >= 0.95) {
    return "Matched because the test question closely matched the knowledge entry title.";
  }

  if (matchedSearchPhrase) {
    return `Matched using search phrase "${matchedSearchPhrase}".`;
  }

  if (breakdown.intentScore >= 0.2 && method === "intent_match") {
    return "Matched through intent classification and trigger phrases.";
  }

  if (breakdown.graphScore >= 0.1) {
    return "Matched through the knowledge graph via related intents.";
  }

  if (matchedKeywords.length > 0) {
    return "Matched using keyword overlap and synonym expansion.";
  }

  if (method === "hybrid_retrieval") {
    return "Matched through hybrid ranking combining keywords, intent, and graph signals.";
  }

  if (breakdown.searchPhraseScore >= 0.2) {
    return "Matched using search phrases configured on the entry.";
  }

  return "Matched using the zero-cost retrieval ranking engine.";
}

export function pickMatchedSearchPhrase(
  query: string,
  entry: AIKnowledgeEntry,
  matchedPhrases: string[]
): string | null {
  if (matchedPhrases.length > 0) return matchedPhrases[0] ?? null;

  const normalizedQuery = query.trim().toLowerCase();
  if (entry.question.trim().toLowerCase() === normalizedQuery) {
    return entry.question;
  }

  for (const phrase of entry.search_phrases) {
    if (phrase.trim().toLowerCase() === normalizedQuery) return phrase;
  }

  return null;
}

export function buildNoMatchReason(
  result: ZeroCostRetrievalResult
): string {
  if (result.type === "clarification") {
    return "Multiple similar intents found — clarification required before selecting an answer.";
  }

  const topScore = result.candidates[0]?.score ?? 0;
  if (result.candidates.length === 0) {
    return "No active knowledge entry available.";
  }
  if (topScore < 0.05) {
    return "No keyword overlap found.";
  }
  if (topScore < 0.35) {
    return "Similarity score below the minimum retrieval threshold.";
  }
  return "No semantic or keyword similarity above the match threshold.";
}

export function buildRetrievalObservability(
  query: string,
  entry: AIKnowledgeEntry | null,
  result: ZeroCostRetrievalResult,
  options?: {
    matchedKeywords?: string[];
    matchedPhrases?: string[];
    semanticScore?: number | null;
    allEntries?: AIKnowledgeEntry[];
  }
): RetrievalObservability {
  if (!entry) {
    return {
      matchedIntent: null,
      matchedIntentKey: result.matchedIntentKey,
      matchedIntentName: null,
      matchedCategory: null,
      matchedEntryId: null,
      matchedQuestion: null,
      retrievalMethod: null,
      matchScore: result.candidates[0]?.score ?? 0,
      matchedKeywords: options?.matchedKeywords ?? [],
      matchedSearchPhrase: null,
      knowledgeVersion: null,
      isPrimaryEntry: false,
      healthStatus: null,
      retrievalExplanation: buildNoMatchReason(result),
      responseSource: result.type === "clarification" ? "clarification" : "none",
      noMatchReason: buildNoMatchReason(result),
    };
  }

  const breakdown = scoreEntryBreakdown(query, entry, {
    allEntries: options?.allEntries,
  });
  const intent = resolveDisplayIntent(entry);
  const matchedKeywords = options?.matchedKeywords ?? [];
  const matchedPhrases = options?.matchedPhrases ?? [];
  const method = inferRetrievalMethod(breakdown, options?.semanticScore);
  const matchedSearchPhrase = pickMatchedSearchPhrase(
    query,
    entry,
    matchedPhrases
  );

  return {
    matchedIntent: intent.display,
    matchedIntentKey: intent.intentKey ?? result.matchedIntentKey,
    matchedIntentName: intent.intentName,
    matchedCategory: intent.category,
    matchedEntryId: entry.id,
    matchedQuestion: entry.question,
    retrievalMethod: method,
    matchScore: result.match?.finalScore ?? result.match?.score ?? breakdown.score,
    matchedKeywords,
    matchedSearchPhrase,
    knowledgeVersion: entry.version_number ?? 1,
    isPrimaryEntry: entry.is_primary !== false,
    healthStatus: resolveEntryHealthStatus(entry),
    retrievalExplanation: buildRetrievalExplanation(
      breakdown,
      method,
      matchedKeywords,
      matchedSearchPhrase
    ),
    responseSource: "knowledge_base",
    noMatchReason: null,
  };
}

export const RETRIEVAL_METHOD_LABELS: Record<RetrievalMethod, string> = {
  intent_match: "Intent Match",
  semantic_search: "Semantic Search",
  keyword_match: "Keyword Match",
  hybrid_retrieval: "Hybrid Retrieval",
  knowledge_graph: "Knowledge Graph",
};

export const HEALTH_STATUS_LABELS: Record<DisplayHealthStatus, string> = {
  healthy: "Healthy",
  needs_review: "Needs Review",
  archived: "Archived",
  deprecated: "Deprecated",
};

export type ConfidenceTier =
  | "excellent"
  | "strong"
  | "good"
  | "weak"
  | "none";

export type KnowledgeCoverageStatus =
  | "covered"
  | "needs_training"
  | "missing"
  | "duplicate_risk";

export interface ConfidenceDisplay {
  percent: number;
  tier: ConfidenceTier;
  label: string;
}

export interface QueryNormalizationDebug {
  originalQuestion: string;
  normalizedQuestion: string;
  normalizedTokens: string[];
  expandedQuery: string | null;
}

export interface ScoreBreakdownItem {
  label: string;
  value: number;
  percent: number;
}

export interface TestCandidateDebug {
  rank: number;
  entryId: string;
  question: string;
  category: string;
  intentKey: string | null;
  intentLabel: string;
  scorePercent: number;
  scoreRaw: number;
  retrievalMethod: RetrievalMethod;
  healthStatus: DisplayHealthStatus;
  reasonSummary: string;
  isWinner: boolean;
  rejectedReason: string | null;
}

export interface RejectedMatchDebug {
  rank: number;
  entryId: string;
  question: string;
  scorePercent: number;
  reason: string;
}

export interface TrainingRecommendation {
  id: string;
  message: string;
}

export interface AdvancedTestDebug {
  confidenceDisplay: ConfidenceDisplay;
  queryNormalization: QueryNormalizationDebug;
  candidates: TestCandidateDebug[];
  rejectedMatches: RejectedMatchDebug[];
  scoreBreakdown: ScoreBreakdownItem[];
  scoreBreakdownAvailable: boolean;
  coverageStatus: KnowledgeCoverageStatus;
  coverageMessage: string;
  recommendations: TrainingRecommendation[];
}

export function resolveConfidenceDisplay(percent: number): ConfidenceDisplay {
  if (percent >= 90) {
    return { percent, tier: "excellent", label: "Excellent Match" };
  }
  if (percent >= 75) {
    return { percent, tier: "strong", label: "Strong Match" };
  }
  if (percent >= 60) {
    return { percent, tier: "good", label: "Good Match" };
  }
  if (percent >= 45) {
    return { percent, tier: "weak", label: "Weak Match" };
  }
  return { percent, tier: "none", label: "No Strong Match" };
}

export function buildQueryNormalizationDebug(
  query: string,
  expandedQuery?: string | null
): QueryNormalizationDebug {
  return {
    originalQuestion: query,
    normalizedQuestion: normalizeQuestionForDedup(query),
    normalizedTokens: meaningfulTokens(query),
    expandedQuery: expandedQuery && expandedQuery !== query.trim() ? expandedQuery : null,
  };
}

export function buildScoreBreakdownItems(
  breakdown: EntryScoreBreakdown
): { items: ScoreBreakdownItem[]; available: boolean } {
  const candidates: Array<{ label: string; value: number }> = [
    { label: "Question match", value: breakdown.questionScore },
    { label: "Search phrase match", value: breakdown.searchPhraseScore },
    { label: "Intent signal", value: breakdown.intentScore },
    { label: "Knowledge graph boost", value: breakdown.graphScore },
    { label: "Priority boost", value: breakdown.priorityBoost },
    { label: "Session context boost", value: breakdown.contextBoost },
    { label: "Phrase overlap", value: breakdown.phraseOverlap },
  ];

  const items = candidates
    .filter((item) => item.value > 0.001)
    .map((item) => ({
      label: item.label,
      value: item.value,
      percent: Math.round(Math.min(100, item.value * 100)),
    }));

  items.push({
    label: "Final score",
    value: breakdown.score,
    percent: Math.round(Math.min(100, breakdown.score * 100)),
  });

  return {
    items,
    available: items.length > 1,
  };
}

function buildCandidateReasonSummary(
  query: string,
  entry: AIKnowledgeEntry,
  breakdown: EntryScoreBreakdown,
  method: RetrievalMethod,
  matchedKeywords: string[],
  matchedPhrases: string[]
): string {
  return buildRetrievalExplanation(
    breakdown,
    method,
    matchedKeywords,
    pickMatchedSearchPhrase(query, entry, matchedPhrases)
  );
}

export function buildRejectionReason(
  candidate: RankedKnowledgeEntry,
  winner: RankedKnowledgeEntry | null,
  matched: boolean
): string {
  const entry = candidate.entry;

  if (entry.status === "archived") return "Archived entry";
  if (entry.merged_into_id) return "Merged into another entry";
  if (entry.is_primary === false) return "Not primary version";

  if (!winner) {
    if (candidate.score < MATCH_SCORE_THRESHOLD) return "Below confidence threshold";
    return "Not selected as top candidate";
  }

  if (!matched && candidate.score < MATCH_SCORE_THRESHOLD) {
    return "Below confidence threshold";
  }

  if (candidate.entry.id === winner.entry.id) return "Selected as best match";

  const winnerIntent = resolveEntryIntent(winner.entry).intent_key;
  const candidateIntent = resolveEntryIntent(entry).intent_key;
  if (
    winnerIntent &&
    candidateIntent &&
    winnerIntent !== candidateIntent
  ) {
    return "Different intent";
  }

  if (candidate.score < winner.score - 0.008) {
    if (
      candidate.breakdown.searchPhraseScore <
      winner.breakdown.searchPhraseScore - 0.05
    ) {
      return "Weaker phrase match";
    }
    if (
      candidate.breakdown.questionScore <
      winner.breakdown.questionScore - 0.05
    ) {
      return "Weaker question match";
    }
    return "Lower match score";
  }

  return "Lower overall ranking score";
}

export function buildTestCandidates(
  query: string,
  retrievalResult: ZeroCostRetrievalResult,
  entries: AIKnowledgeEntry[],
  winnerEntryId: string | null,
  matched: boolean
): TestCandidateDebug[] {
  const ranked = retrievalResult.candidates.slice(0, 5);
  if (ranked.length === 0) return [];

  const winner =
    ranked.find((item) => item.entry.id === winnerEntryId) ?? ranked[0] ?? null;

  return ranked.map((candidate, index) => {
    const detail = scoreEntryWithMatches(query, candidate.entry);
    const breakdown = scoreEntryBreakdown(query, candidate.entry, {
      allEntries: entries,
    });
    const method = inferRetrievalMethod(breakdown);
    const intent = resolveDisplayIntent(candidate.entry);
    const isWinner = candidate.entry.id === winnerEntryId;

    return {
      rank: index + 1,
      entryId: candidate.entry.id,
      question: candidate.entry.question,
      category: candidate.entry.category,
      intentKey: intent.intentKey,
      intentLabel: intent.display,
      scorePercent: Math.round(candidate.score * 100),
      scoreRaw: candidate.score,
      retrievalMethod: method,
      healthStatus: resolveEntryHealthStatus(candidate.entry),
      reasonSummary: buildCandidateReasonSummary(
        query,
        candidate.entry,
        breakdown,
        method,
        detail.matchedKeywords,
        detail.matchedPhrases
      ),
      isWinner,
      rejectedReason: isWinner
        ? null
        : buildRejectionReason(candidate, winner, matched),
    };
  });
}

export function buildRejectedMatches(
  candidates: TestCandidateDebug[]
): RejectedMatchDebug[] {
  return candidates
    .filter((item) => !item.isWinner && item.rejectedReason)
    .map((item) => ({
      rank: item.rank,
      entryId: item.entryId,
      question: item.question,
      scorePercent: item.scorePercent,
      reason: item.rejectedReason!,
    }));
}

export function resolveCoverageStatus(
  matched: boolean,
  confidencePercent: number,
  candidates: TestCandidateDebug[]
): { status: KnowledgeCoverageStatus; message: string } {
  const topTwoClose =
    candidates.length >= 2 &&
    candidates[0] &&
    candidates[1] &&
    candidates[0].scorePercent >= 75 &&
    candidates[1].scorePercent >= 75 &&
    candidates[0].scorePercent - candidates[1].scorePercent <= 8;

  if (topTwoClose) {
    return {
      status: "duplicate_risk",
      message:
        "Several entries are similar. Consider merging or improving metadata.",
    };
  }

  if (matched && confidencePercent >= 75) {
    return {
      status: "covered",
      message: "Covered — strong answer found in the knowledge base.",
    };
  }

  if (matched || confidencePercent >= 45) {
    return {
      status: "needs_training",
      message: "Needs more training — weak match or low confidence.",
    };
  }

  return {
    status: "missing",
    message: "Missing — no suitable answer found.",
  };
}

export function buildTrainingRecommendations(input: {
  query: string;
  matched: boolean;
  confidencePercent: number;
  coverageStatus: KnowledgeCoverageStatus;
  winner: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  candidates: TestCandidateDebug[];
}): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];
  const normalizedQuery = normalizeQuestionForDedup(input.query);

  if (!input.matched) {
    recommendations.push({
      id: "create-entry",
      message: "Create a new knowledge entry for this question.",
    });
  }

  if (input.coverageStatus === "duplicate_risk") {
    recommendations.push({
      id: "merge",
      message: "Merge similar entries to avoid conflicting answers.",
    });
  }

  if (input.winner) {
    if (!input.winner.intent_key) {
      recommendations.push({
        id: "recalculate-intent",
        message: "Recalculate intent so this entry is linked to the right topic.",
      });
    }

    if (input.winner.health_status === "needs_review") {
      recommendations.push({
        id: "improve-metadata",
        message: "Improve keywords, synonyms, and search phrases to raise health score.",
      });
    }

    if (input.matchedPhrases.length === 0 && input.matchedKeywords.length > 0) {
      recommendations.push({
        id: "add-search-phrase",
        message: `Add "${normalizedQuery}" to Search Phrases for faster matching.`,
      });
    }

    const entryTokens = new Set(
      [
        ...input.winner.keywords,
        ...input.winner.synonyms,
        ...input.winner.search_phrases,
      ].map((value) => normalizeText(value))
    );
    const missingTokens = meaningfulTokens(input.query).filter(
      (token) => !entryTokens.has(token)
    );
    if (missingTokens.length > 0) {
      recommendations.push({
        id: "add-synonym",
        message: `Add synonym or keyword: ${missingTokens.slice(0, 3).join(", ")}.`,
      });
    }

    if ((input.winner.related_terms?.length ?? 0) < 2) {
      recommendations.push({
        id: "add-related-terms",
        message: "Add related terms to strengthen knowledge graph connections.",
      });
    }

    if (input.confidencePercent >= 45 && input.confidencePercent < 75) {
      recommendations.push({
        id: "improve-answer",
        message: "Improve answer clarity and add alternative wording for this topic.",
      });
    }
  }

  if (input.candidates.length >= 2 && input.coverageStatus !== "duplicate_risk") {
    const runnerUp = input.candidates.find((item) => !item.isWinner);
    if (runnerUp && runnerUp.scorePercent >= 60) {
      recommendations.push({
        id: "review-runner-up",
        message: `Review runner-up "${runnerUp.question}" — it scored ${runnerUp.scorePercent}%.`,
      });
    }
  }

  return recommendations.slice(0, 6);
}

export function buildAdvancedTestDebug(
  query: string,
  retrievalResult: ZeroCostRetrievalResult,
  entries: AIKnowledgeEntry[],
  options: {
    matched: boolean;
    confidencePercent: number;
    winnerEntryId: string | null;
    winnerEntry: AIKnowledgeEntry | null;
    matchedKeywords: string[];
    matchedPhrases: string[];
  }
): AdvancedTestDebug {
  const candidates = buildTestCandidates(
    query,
    retrievalResult,
    entries,
    options.winnerEntryId,
    options.matched
  );
  const coverage = resolveCoverageStatus(
    options.matched,
    options.confidencePercent,
    candidates
  );

  let scoreBreakdown: ScoreBreakdownItem[] = [];
  let scoreBreakdownAvailable = false;

  if (options.winnerEntry) {
    const breakdown = scoreEntryBreakdown(query, options.winnerEntry, {
      allEntries: entries,
    });
    const built = buildScoreBreakdownItems(breakdown);
    scoreBreakdown = built.items;
    scoreBreakdownAvailable = built.available;
  }

  return {
    confidenceDisplay: resolveConfidenceDisplay(options.confidencePercent),
    queryNormalization: buildQueryNormalizationDebug(
      query,
      retrievalResult.expandedQuery
    ),
    candidates,
    rejectedMatches: buildRejectedMatches(candidates),
    scoreBreakdown,
    scoreBreakdownAvailable,
    coverageStatus: coverage.status,
    coverageMessage: coverage.message,
    recommendations: buildTrainingRecommendations({
      query,
      matched: options.matched,
      confidencePercent: options.confidencePercent,
      coverageStatus: coverage.status,
      winner: options.winnerEntry,
      matchedKeywords: options.matchedKeywords,
      matchedPhrases: options.matchedPhrases,
      candidates,
    }),
  };
}

export const COVERAGE_STATUS_LABELS: Record<KnowledgeCoverageStatus, string> = {
  covered: "Covered",
  needs_training: "Needs More Training",
  missing: "Missing",
  duplicate_risk: "Duplicate Risk",
};

export const CONFIDENCE_TIER_STYLES: Record<
  ConfidenceTier,
  { bar: string; badge: string }
> = {
  excellent: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  strong: {
    bar: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  },
  good: {
    bar: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  weak: {
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  none: {
    bar: "bg-slate-400",
    badge: "bg-slate-200 text-slate-700 ring-slate-300",
  },
};

export const COVERAGE_STATUS_STYLES: Record<KnowledgeCoverageStatus, string> = {
  covered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  needs_training: "bg-amber-50 text-amber-800 ring-amber-200",
  missing: "bg-red-50 text-red-800 ring-red-200",
  duplicate_risk: "bg-violet-50 text-violet-800 ring-violet-200",
};
