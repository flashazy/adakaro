import { computeKnowledgeHealth } from "./knowledge-duplicates";
import type { EntryScoreBreakdown } from "./knowledge-scoring";
import { scoreEntryBreakdown } from "./knowledge-scoring";
import type {
  AdvancedTestDebug,
  DisplayHealthStatus,
  TestCandidateDebug,
  TrainingRecommendation,
} from "./retrieval-observability";
import {
  pickMatchedSearchPhrase,
  resolveDisplayIntent,
  resolveEntryHealthStatus,
} from "./retrieval-observability";
import type { ZeroCostRetrievalResult } from "./zero-cost-retrieval";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface RetrievalPerformanceMetrics {
  totalMs: number;
  loadEntriesMs: number;
  queryProcessingMs: number;
  retrievalMs: number;
  rankingMs: number;
  observabilityMs: number;
  answerPreviewMs: number;
  speedLabel: string;
  speedTier: "green" | "blue" | "amber" | "red";
}

export interface KnowledgeBaseStatistics {
  entriesScanned: number;
  candidateMatches: number;
  winners: number;
  rejected: number;
  activeEntries: number;
  archivedVersions: number;
  duplicateEntries: number;
  healthyEntries: number;
  needsReviewEntries: number;
}

export interface ConfidenceReasonItem {
  label: string;
  met: boolean;
}

export type PipelineStageStatus = "complete" | "skipped" | "failed";

export interface PipelineStage {
  id: string;
  label: string;
  status: PipelineStageStatus;
  detail?: string;
}

export interface HealthExplanation {
  status: DisplayHealthStatus;
  issues: string[];
  checklist: Array<{ label: string; done: boolean }>;
  lastUpdatedAt: string | null;
  daysSinceUpdate: number | null;
}

export type RecommendationApplyAction =
  | "append_search_phrase"
  | "append_keyword"
  | "append_synonym"
  | "append_alternative_wording"
  | "append_related_term"
  | "merge_entries"
  | "recalculate_intent"
  | "create_entry"
  | "open_entry";

export interface ActionableRecommendation extends TrainingRecommendation {
  type: string;
  suggestedValue?: string;
  confidencePercent?: number;
  applyAction?: RecommendationApplyAction;
  targetEntryId?: string;
}

export interface KnowledgeQualityScore {
  scorePercent: number;
  stars: number;
  grade: string;
  metrics: {
    coveragePercent: number;
    averageConfidencePercent: number;
    averageRetrievalMs: number;
    healthyEntries: number;
    needsReviewEntries: number;
    duplicateRiskEntries: number;
    missingIntentEntries: number;
    averageKeywords: number;
    averageSearchPhrases: number;
    averageSynonyms: number;
    versionCoveragePercent: number;
  };
}

export interface VersionTimelineNode {
  id: string;
  versionNumber: number;
  label: string;
  question: string;
  createdAt: string;
  isCurrent: boolean;
  changeSummary: string;
}

export interface EnterpriseConsoleDebug {
  performance: RetrievalPerformanceMetrics;
  kbStatistics: KnowledgeBaseStatistics;
  confidenceReasons: ConfidenceReasonItem[];
  pipeline: PipelineStage[];
  healthExplanation: HealthExplanation | null;
  actionableRecommendations: ActionableRecommendation[];
  qualityScore: KnowledgeQualityScore;
  versionTimeline: VersionTimelineNode[];
  testedAt: string;
}

export function resolveSpeedTier(totalMs: number): {
  label: string;
  tier: RetrievalPerformanceMetrics["speedTier"];
} {
  if (totalMs < 20) return { label: "Extremely Fast", tier: "green" };
  if (totalMs < 50) return { label: "Fast", tier: "blue" };
  if (totalMs < 100) return { label: "Moderate", tier: "amber" };
  return { label: "Slow", tier: "red" };
}

export function buildKnowledgeBaseStatistics(
  entries: AIKnowledgeEntry[],
  candidates: TestCandidateDebug[],
  matched: boolean
): KnowledgeBaseStatistics {
  const winners = matched ? 1 : 0;
  const candidateMatches = candidates.length;
  const rejected = Math.max(0, candidateMatches - winners);

  return {
    entriesScanned: entries.length,
    candidateMatches,
    winners,
    rejected,
    activeEntries: entries.filter(
      (e) => e.status === "active" && e.is_primary !== false && !e.merged_into_id
    ).length,
    archivedVersions: entries.filter(
      (e) => e.status === "archived" || e.is_primary === false
    ).length,
    duplicateEntries: entries.filter(
      (e) => e.merged_into_id || (e.is_primary === false && e.status === "active")
    ).length,
    healthyEntries: entries.filter((e) => e.health_status === "healthy").length,
    needsReviewEntries: entries.filter(
      (e) => (e.health_status ?? "needs_review") === "needs_review"
    ).length,
  };
}

export function buildConfidenceReasons(input: {
  query: string;
  breakdown: EntryScoreBreakdown | null;
  winner: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  matched: boolean;
}): ConfidenceReasonItem[] {
  if (!input.winner || !input.breakdown) {
    return [
      { label: "Knowledge entry matched", met: input.matched },
      { label: "Above confidence threshold", met: false },
    ];
  }

  const intent = resolveDisplayIntent(input.winner);
  const searchPhrase = pickMatchedSearchPhrase(
    input.query,
    input.winner,
    input.matchedPhrases
  );

  return [
    {
      label: "Exact title match",
      met: input.breakdown.questionScore >= 0.95,
    },
    {
      label: "Search phrase matched",
      met: Boolean(searchPhrase) || input.breakdown.searchPhraseScore >= 0.2,
    },
    {
      label: "Keywords matched",
      met: input.matchedKeywords.length > 0,
    },
    {
      label: "Same intent",
      met:
        input.breakdown.intentScore >= 0.2 ||
        Boolean(intent.intentKey),
    },
    {
      label: "Primary version",
      met: input.winner.is_primary !== false && !input.winner.merged_into_id,
    },
    {
      label: "Healthy entry",
      met: input.winner.health_status === "healthy",
    },
    {
      label: "Above match threshold",
      met: input.breakdown.score >= MATCH_SCORE_THRESHOLD,
    },
  ];
}

export function buildRetrievalPipelineStages(input: {
  query: string;
  retrievalResult: ZeroCostRetrievalResult;
  breakdown: EntryScoreBreakdown | null;
  matched: boolean;
  needsClarification: boolean;
  matchedKeywords: string[];
  matchedPhrases: string[];
  winner: AIKnowledgeEntry | null;
}): PipelineStage[] {
  const breakdown = input.breakdown;
  const hasCandidates = input.retrievalResult.candidates.length > 0;
  const intentDetected =
    Boolean(input.retrievalResult.matchedIntentKey) ||
    (breakdown?.intentScore ?? 0) > 0.05 ||
    input.retrievalResult.reasonSignals.length > 0;

  let winnerStatus: PipelineStageStatus = "failed";
  if (input.needsClarification) winnerStatus = "skipped";
  else if (input.matched && input.winner) winnerStatus = "complete";

  return [
    {
      id: "question",
      label: "Question",
      status: input.query.trim() ? "complete" : "failed",
    },
    {
      id: "normalization",
      label: "Normalization",
      status: input.query.trim() ? "complete" : "skipped",
      detail: input.retrievalResult.expandedQuery || undefined,
    },
    {
      id: "intent",
      label: "Intent Detection",
      status: intentDetected ? "complete" : "skipped",
    },
    {
      id: "keywords",
      label: "Keyword Search",
      status:
        input.matchedKeywords.length > 0 || (breakdown?.questionScore ?? 0) > 0.05
          ? "complete"
          : hasCandidates
            ? "skipped"
            : "failed",
    },
    {
      id: "phrases",
      label: "Search Phrase Match",
      status:
        input.matchedPhrases.length > 0 ||
        (breakdown?.searchPhraseScore ?? 0) > 0.05
          ? "complete"
          : "skipped",
    },
    {
      id: "graph",
      label: "Knowledge Graph",
      status: (breakdown?.graphScore ?? 0) > 0.05 ? "complete" : "skipped",
    },
    {
      id: "ranking",
      label: "Ranking",
      status: hasCandidates ? "complete" : "failed",
    },
    {
      id: "winner",
      label: "Winner",
      status: winnerStatus,
      detail: input.needsClarification ? "Clarification required" : undefined,
    },
  ];
}

export function buildHealthExplanation(
  entry: AIKnowledgeEntry | null,
  allEntries: AIKnowledgeEntry[]
): HealthExplanation | null {
  if (!entry) return null;

  const health = computeKnowledgeHealth(entry, allEntries);
  const status = resolveEntryHealthStatus(entry);
  const updated = entry.updated_at ? new Date(entry.updated_at) : null;
  const daysSinceUpdate = updated
    ? Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const checklist = [
    { label: "Has intent", done: Boolean(entry.intent_key) },
    { label: "3+ keywords", done: entry.keywords.length >= 3 },
    { label: "Search phrases", done: entry.search_phrases.length >= 1 },
    { label: "Synonyms", done: (entry.synonyms ?? []).length >= 1 },
    { label: "Related terms", done: entry.related_terms.length >= 1 },
    { label: "Alternative wording", done: entry.alternative_wording.length >= 1 },
    { label: "No duplicates", done: !health.issues.includes("Duplicate exists") },
  ];

  return {
    status,
    issues: health.issues,
    checklist,
    lastUpdatedAt: entry.updated_at,
    daysSinceUpdate,
  };
}

export function buildActionableRecommendations(input: {
  query: string;
  matched: boolean;
  confidencePercent: number;
  coverageStatus: AdvancedTestDebug["coverageStatus"];
  winner: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  candidates: TestCandidateDebug[];
  baseRecommendations: TrainingRecommendation[];
}): ActionableRecommendation[] {
  const items: ActionableRecommendation[] = [];
  const normalizedQuery = input.query.trim();
  const winner = input.winner;

  if (!input.matched) {
    items.push({
      id: "create-entry",
      type: "create_entry",
      message: "Create a new knowledge entry for this question.",
      suggestedValue: normalizedQuery,
      confidencePercent: 95,
      applyAction: "create_entry",
    });
  }

  if (input.coverageStatus === "duplicate_risk") {
    const runnerUp = input.candidates.find((c) => !c.isWinner);
    items.push({
      id: "merge",
      type: "merge",
      message: "Merge similar entries to avoid conflicting answers.",
      suggestedValue: runnerUp?.question,
      confidencePercent: 88,
      applyAction: "merge_entries",
      targetEntryId: winner?.id,
    });
  }

  if (winner) {
    if (input.matchedPhrases.length === 0 && normalizedQuery) {
      items.push({
        id: "add-search-phrase",
        type: "search_phrase",
        message: "Add this search phrase for faster matching.",
        suggestedValue: normalizedQuery,
        confidencePercent: Math.min(96, input.confidencePercent + 5),
        applyAction: "append_search_phrase",
        targetEntryId: winner.id,
      });
    }

    const missingKw = input.matchedKeywords.filter(
      (kw) => !winner.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())
    );
    if (missingKw[0]) {
      items.push({
        id: "add-keyword",
        type: "keyword",
        message: "Add matched keyword to improve recall.",
        suggestedValue: missingKw[0],
        confidencePercent: 82,
        applyAction: "append_keyword",
        targetEntryId: winner.id,
      });
    }

    if ((winner.synonyms ?? []).length < 2 && normalizedQuery) {
      items.push({
        id: "add-synonym",
        type: "synonym",
        message: "Add synonym based on test phrasing.",
        suggestedValue: normalizedQuery,
        confidencePercent: 78,
        applyAction: "append_synonym",
        targetEntryId: winner.id,
      });
    }

    if (winner.alternative_wording.length < 2) {
      items.push({
        id: "add-alternative",
        type: "alternative_wording",
        message: "Add alternative wording for intent protection.",
        suggestedValue: normalizedQuery,
        confidencePercent: 75,
        applyAction: "append_alternative_wording",
        targetEntryId: winner.id,
      });
    }

    if ((winner.related_terms ?? []).length < 2) {
      items.push({
        id: "add-related",
        type: "related_term",
        message: "Add related term for knowledge graph boost.",
        suggestedValue: winner.category,
        confidencePercent: 70,
        applyAction: "append_related_term",
        targetEntryId: winner.id,
      });
    }

    if (!winner.intent_key) {
      items.push({
        id: "recalculate-intent",
        type: "intent",
        message: "Recalculate intent to link this entry to the right topic.",
        confidencePercent: 90,
        applyAction: "recalculate_intent",
        targetEntryId: winner.id,
      });
    }

    if (input.confidencePercent >= 45 && input.confidencePercent < 75) {
      items.push({
        id: "improve-answer",
        type: "answer",
        message: "Improve answer clarity and expand metadata coverage.",
        applyAction: "open_entry",
        targetEntryId: winner.id,
        confidencePercent: 72,
      });
    }
  }

  for (const base of input.baseRecommendations) {
    if (!items.some((item) => item.id === base.id)) {
      items.push({ ...base, type: base.id });
    }
  }

  return items.slice(0, 8);
}

export function buildKnowledgeQualityScore(
  entries: AIKnowledgeEntry[],
  testConfidencePercent: number,
  retrievalMs: number,
  coverageStatus: AdvancedTestDebug["coverageStatus"]
): KnowledgeQualityScore {
  const n = entries.length || 1;
  const withIntent = entries.filter((e) => e.intent_key).length;
  const healthy = entries.filter((e) => e.health_status === "healthy").length;
  const needsReview = entries.filter((e) => (e.health_status ?? "needs_review") === "needs_review").length;
  const duplicateRisk = entries.filter(
    (e) => e.merged_into_id || e.is_primary === false
  ).length;
  const missingIntent = entries.filter((e) => !e.intent_key).length;
  const withVersion = entries.filter((e) => (e.version_number ?? 1) > 1).length;

  const avgKeywords =
    entries.reduce((sum, e) => sum + e.keywords.length, 0) / n;
  const avgPhrases =
    entries.reduce((sum, e) => sum + e.search_phrases.length, 0) / n;
  const avgSynonyms =
    entries.reduce((sum, e) => sum + (e.synonyms?.length ?? 0), 0) / n;

  const coveragePercent = Math.round((withIntent / n) * 100);
  const healthRatio = healthy / n;
  const confidenceFactor = testConfidencePercent / 100;
  const duplicatePenalty =
    coverageStatus === "duplicate_risk" ? 0.12 : duplicateRisk / n / 5;

  const scorePercent = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        healthRatio * 35 +
          coveragePercent * 0.25 +
          confidenceFactor * 30 +
          Math.min(avgKeywords / 8, 1) * 5 +
          Math.min(avgPhrases / 4, 1) * 5 -
          duplicatePenalty * 100
      )
    )
  );

  const stars =
    scorePercent >= 95 ? 5 : scorePercent >= 85 ? 4 : scorePercent >= 70 ? 3 : scorePercent >= 55 ? 2 : 1;

  const grade =
    scorePercent >= 95
      ? "A+"
      : scorePercent >= 90
        ? "A"
        : scorePercent >= 80
          ? "B"
          : scorePercent >= 65
            ? "C"
            : "D";

  return {
    scorePercent,
    stars,
    grade,
    metrics: {
      coveragePercent,
      averageConfidencePercent: testConfidencePercent,
      averageRetrievalMs: Math.round(retrievalMs),
      healthyEntries: healthy,
      needsReviewEntries: needsReview,
      duplicateRiskEntries: duplicateRisk,
      missingIntentEntries: missingIntent,
      averageKeywords: Math.round(avgKeywords * 10) / 10,
      averageSearchPhrases: Math.round(avgPhrases * 10) / 10,
      averageSynonyms: Math.round(avgSynonyms * 10) / 10,
      versionCoveragePercent: Math.round((withVersion / n) * 100),
    },
  };
}

export function buildVersionTimeline(
  entry: AIKnowledgeEntry | null,
  versions: Array<{
    id: string;
    version_number: number;
    question: string;
    created_at: string;
  }>
): VersionTimelineNode[] {
  if (!entry) return [];

  const nodes: VersionTimelineNode[] = versions
    .sort((a, b) => a.version_number - b.version_number)
    .map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      label: `Version ${v.version_number}`,
      question: v.question,
      createdAt: v.created_at,
      isCurrent: false,
      changeSummary: "Historical snapshot",
    }));

  nodes.push({
    id: entry.id,
    versionNumber: entry.version_number ?? 1,
    label: "Current Version",
    question: entry.question,
    createdAt: entry.updated_at,
    isCurrent: true,
    changeSummary: "Active primary answer",
  });

  return nodes;
}

export function buildEnterpriseConsoleDebug(input: {
  query: string;
  entries: AIKnowledgeEntry[];
  retrievalResult: ZeroCostRetrievalResult;
  advanced: AdvancedTestDebug;
  matched: boolean;
  needsClarification: boolean;
  confidencePercent: number;
  winner: AIKnowledgeEntry | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  performance: Omit<RetrievalPerformanceMetrics, "speedLabel" | "speedTier">;
  versionTimeline?: VersionTimelineNode[];
}): EnterpriseConsoleDebug {
  const breakdown = input.winner
    ? scoreEntryBreakdown(input.query, input.winner, {
        allEntries: input.entries,
      })
    : null;

  const speed = resolveSpeedTier(input.performance.totalMs);

  return {
    performance: {
      ...input.performance,
      speedLabel: speed.label,
      speedTier: speed.tier,
    },
    kbStatistics: buildKnowledgeBaseStatistics(
      input.entries,
      input.advanced.candidates,
      input.matched
    ),
    confidenceReasons: buildConfidenceReasons({
      query: input.query,
      breakdown,
      winner: input.winner,
      matchedKeywords: input.matchedKeywords,
      matchedPhrases: input.matchedPhrases,
      matched: input.matched,
    }),
    pipeline: buildRetrievalPipelineStages({
      query: input.query,
      retrievalResult: input.retrievalResult,
      breakdown,
      matched: input.matched,
      needsClarification: input.needsClarification,
      matchedKeywords: input.matchedKeywords,
      matchedPhrases: input.matchedPhrases,
      winner: input.winner,
    }),
    healthExplanation: buildHealthExplanation(input.winner, input.entries),
    actionableRecommendations: buildActionableRecommendations({
      query: input.query,
      matched: input.matched,
      confidencePercent: input.confidencePercent,
      coverageStatus: input.advanced.coverageStatus,
      winner: input.winner,
      matchedKeywords: input.matchedKeywords,
      matchedPhrases: input.matchedPhrases,
      candidates: input.advanced.candidates,
      baseRecommendations: input.advanced.recommendations,
    }),
    qualityScore: buildKnowledgeQualityScore(
      input.entries,
      input.confidencePercent,
      input.performance.retrievalMs,
      input.advanced.coverageStatus
    ),
    versionTimeline:
      input.versionTimeline ??
      buildVersionTimeline(input.winner, []),
    testedAt: new Date().toISOString(),
  };
}
