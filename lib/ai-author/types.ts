/**
 * AI Knowledge Author V3 — Enterprise Knowledge Intelligence Engine types.
 */

import type { AIKnowledgeEntry, KnowledgePriority } from "@/lib/ai-training/types";

export type DraftGenerationStage =
  | "understanding_question"
  | "ranking_lessons"
  | "extracting_facts"
  | "analyzing_coverage"
  | "composing_draft"
  | "validating_quality";

export const DRAFT_GENERATION_STAGE_LABELS: Record<DraftGenerationStage, string> = {
  understanding_question: "Understanding question context...",
  ranking_lessons: "Ranking published lessons...",
  extracting_facts: "Extracting atomic facts...",
  analyzing_coverage: "Analyzing coverage and gaps...",
  composing_draft: "Composing documentation...",
  validating_quality: "Validating draft quality...",
};

export const DRAFT_GENERATION_STAGES: DraftGenerationStage[] = [
  "understanding_question",
  "ranking_lessons",
  "extracting_facts",
  "analyzing_coverage",
  "composing_draft",
  "validating_quality",
];

export type AuthorIntent =
  | "identity"
  | "capabilities"
  | "process"
  | "pricing"
  | "finance"
  | "general";

export type ExpectedAnswerType =
  | "audience"
  | "definition"
  | "capabilities"
  | "step_by_step"
  | "pricing_only"
  | "configuration"
  | "general_facts";

export interface DraftMetadataInput {
  keywords?: string[];
  synonyms?: string[];
  search_phrases?: string[];
  alternative_wording?: string[];
  related_terms?: string[];
}

export interface DraftGenerationRequest {
  question: string;
  category: string;
  priority: KnowledgePriority | string;
  structure?: string;
  curriculumModule?: string | null;
  metadata?: DraftMetadataInput;
  prerequisiteQuestions?: string[];
  dependencyQuestions?: string[];
  relatedQuestions?: string[];
  excludeEntryId?: string;
}

export interface DraftSection {
  title: string;
  content: string;
  sources: string[];
  sourceEntryIds?: string[];
  sourceFactIds?: string[];
  confidence?: number;
}

export interface ExtractedFact {
  id: string;
  text: string;
  normalizedText: string;
  sourceEntryId: string;
  sourceQuestion: string;
  sectionHint: string | null;
  tokens: string[];
}

export type FactRejectionReason =
  | "duplicate"
  | "wrong_intent"
  | "low_confidence"
  | "no_matching_section"
  | "contradiction"
  | "empty_text"
  | "missing_evidence"
  | "unsupported_claim";

export interface FactScoreBreakdown {
  semantic: number;
  entity: number;
  intent: number;
  evidence: number;
  published: number;
  lessonProvenance: number;
  penalties: number;
  final: number;
}

export interface ScoredFact extends ExtractedFact {
  relevanceScore: number;
  intentScore: number;
  topicScore: number;
  scoreBreakdown?: FactScoreBreakdown;
  detectedEntity?: string | null;
  detectedIntent?: AuthorIntent;
  discarded?: boolean;
  discardReason?: string;
  rejectionCategory?: FactRejectionReason | null;
}

export interface RankingFactorBreakdown {
  intentMatch: number;
  entityMatch: number;
  topicOverlap: number;
  questionType: number;
  sectionRelevance: number;
  categoryRelevance: number;
  dependencyRelationship: number;
  metadataRelevance: number;
  publishedConfidence: number;
  coverageContribution: number;
}

export interface RankedLesson {
  entry: AIKnowledgeEntry;
  score: number;
  breakdown: RankingFactorBreakdown;
  /** @deprecated legacy alias fields */
  legacyBreakdown?: {
    intent: number;
    entity: number;
    keywords: number;
    category: number;
    dependency: number;
    metadata: number;
    topic: number;
  };
}

export interface LessonRankingExplanation {
  question: string;
  entryId: string;
  score: number;
  selected: boolean;
  reasons: string[];
  factsExtracted: number;
  factsUsed: number;
  factsDiscarded: number;
  confidence: number;
  breakdown: RankingFactorBreakdown;
}

export interface ExplainedFact {
  id: string;
  text: string;
  sourceQuestion: string;
  sourceEntryId: string;
  score: number;
  used: boolean;
  accepted: boolean;
  reason: string;
  rejectionCategory?: FactRejectionReason | null;
}

export interface FactRejectionSummary {
  reason: FactRejectionReason;
  label: string;
  count: number;
}

export interface SectionPopulation {
  section: string;
  factCount: number;
}

export interface KnowledgeGapItem {
  topic: string;
  category: string;
  covered: boolean;
}

export interface SuggestedLesson {
  question: string;
  priority: "critical" | "high" | "normal" | "low";
  businessImpact: string;
  searchDemand: number;
  coverageIncrease: number;
  importance: number;
  status?: "recommended" | "in_progress";
}

export interface CoverageTopicBreakdown {
  topic: string;
  percentage: number;
  missing: string[];
}

export interface CoverageAnalysis {
  overall: number;
  byTopic: CoverageTopicBreakdown[];
  missingSections: string[];
}

export interface SectionConfidence {
  section: string;
  confidence: number;
  reasons: string[];
}

export interface KnowledgeGraphNode {
  type:
    | "prerequisite"
    | "companion"
    | "advanced"
    | "missing"
    | "parent"
    | "child"
    | "related";
  question: string;
  entryId?: string;
}

export interface KnowledgeHealthSummary {
  overall: number;
  gapCount: number;
  recommendedLessons: SuggestedLesson[];
}

export interface ReasoningReport {
  lessonRankings: LessonRankingExplanation[];
  facts: ExplainedFact[];
  knowledgeGaps: KnowledgeGapItem[];
  suggestedLessons: SuggestedLesson[];
  coverage: CoverageAnalysis;
  sectionConfidence: SectionConfidence[];
  factConfidenceReasons: string[];
  knowledgeGraph: KnowledgeGraphNode[];
  knowledgeHealth: KnowledgeHealthSummary;
  validationNotes: string[];
}

export interface KnowledgeConflict {
  id: string;
  topic: string;
  factA: string;
  factB: string;
  sourceA: string;
  sourceB: string;
  message: string;
}

export interface ConfidenceBreakdown {
  intent: number;
  facts: number;
  coverage: number;
  overall: number;
}

export interface DraftValidationIssue {
  code: string;
  message: string;
}

export interface DraftValidationResult {
  valid: boolean;
  issues: DraftValidationIssue[];
  rebuilt: boolean;
  rebuildReason?: string;
}

export interface DraftDiagnostics {
  lessonsRead: number;
  lessonsSelected: number;
  lessonsDiscarded: number;
  factsExtracted: number;
  factsAccepted: number;
  factsRejected: number;
  factsUsed: number;
  factsDiscarded: number;
  duplicatesRemoved: number;
  rejectionSummary: FactRejectionSummary[];
  sectionPopulation: SectionPopulation[];
  rankedLessons: Array<{ question: string; score: number; selected: boolean }>;
  conflicts: KnowledgeConflict[];
  confidence: ConfidenceBreakdown;
  validation: DraftValidationResult;
}

export interface PipelineDebugTrace {
  lessonsRead: number;
  lessonsSelected: number;
  factsExtracted: number;
  factsAccepted: number;
  factsRejected: number;
  factsUsed: number;
  sectionsGenerated: number;
  draftLength: number;
  validationResult: string;
  acceptanceRate: number;
  averageConfidence: number;
  topRejectionReasons: FactRejectionSummary[];
  composerWarning?: string;
  lessonTraces: LessonTraceEntry[];
  factTraces: FactTraceEntry[];
}

export interface LessonTraceEntry {
  question: string;
  entryId: string;
  score: number;
  selected: boolean;
  selectionReasons: string[];
}

export interface FactTraceEntry {
  id: string;
  rawText: string;
  sourceQuestion: string;
  sourceEntryId: string;
  detectedEntity: string | null;
  detectedIntent: AuthorIntent;
  sectionHint: string | null;
  scores: FactScoreBreakdown;
  accepted: boolean;
  used: boolean;
  rejectionCategory: FactRejectionReason | null;
  rejectionReason: string;
  threshold: number;
}

export interface DraftGenerationResult {
  draft: string;
  sections: DraftSection[];
  sourcesUsed: string[];
  confidence: number;
  templateFamily: string;
  diagnostics: DraftDiagnostics;
  reasoning: ReasoningReport;
  pipelineTrace: PipelineDebugTrace;
}

export interface DraftGenerationContext {
  request: DraftGenerationRequest;
  publishedEntries: AIKnowledgeEntry[];
  prerequisiteEntries: AIKnowledgeEntry[];
  dependencyEntries: AIKnowledgeEntry[];
  relatedEntries: AIKnowledgeEntry[];
  categoryEntries: AIKnowledgeEntry[];
  graphNeighborEntries: AIKnowledgeEntry[];
}

export interface KnowledgeDraftEngine {
  generate(context: DraftGenerationContext): DraftGenerationResult;
}

export const LESSON_RANK_THRESHOLD = 35;
export const LESSON_RANK_MAX = 8;
export const FACT_SCORE_THRESHOLD = 40;
