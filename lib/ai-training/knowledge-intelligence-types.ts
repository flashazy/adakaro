/**
 * Enterprise Knowledge Intelligence — shared types.
 * Layered on top of existing AI Training without changing core workflows.
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import type { KnowledgeQualityReport } from "./knowledge-quality-report";
import type { AIKnowledgeEntry } from "./types";

/* ─── Knowledge Strength (Phase 5) ─── */

export type KnowledgeStrengthLevel =
  | "core"
  | "essential"
  | "advanced"
  | "reference"
  | "optional"
  | "legacy";

export const KNOWLEDGE_STRENGTH_LABELS: Record<KnowledgeStrengthLevel, string> = {
  core: "Core Knowledge",
  essential: "Essential",
  advanced: "Advanced",
  reference: "Reference",
  optional: "Optional",
  legacy: "Legacy",
};

/* ─── Gap Discovery (Phase 2) ─── */

export type GapSource =
  | "curriculum_coverage"
  | "retrieval_failure"
  | "public_chatbot"
  | "copilot"
  | "low_confidence"
  | "reviewer_feedback"
  | "search_trend"
  | "product_feature"
  | "documentation";

export type OpportunityPriority = "critical" | "high" | "normal" | "low";

export interface KnowledgeOpportunity {
  id: string;
  moduleId: CurriculumModuleId;
  moduleName: string;
  topic: string;
  reason: string;
  sources: GapSource[];
  priority: OpportunityPriority;
  estimatedLessons: number;
  impact: "high" | "medium" | "low";
  occurrences?: number;
  sampleQuestions?: string[];
}

/* ─── Missions (Phase 3) ─── */

export type MissionType =
  | "complete_module"
  | "improve_confidence"
  | "reduce_duplicates"
  | "fill_gaps"
  | "recover_module";

export interface KnowledgeMission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  moduleId?: CurriculumModuleId;
  moduleName?: string;
  lessonsRemaining: number;
  estimatedMinutes: number;
  expectedQuality?: number;
  coverageAfter?: number;
  coverageGain?: number;
  currentConfidence?: number;
  targetConfidence?: number;
  duplicateSavings?: number;
  priority: OpportunityPriority;
  progress: number;
}

/* ─── Knowledge Graph (Phase 4) ─── */

export type GraphNodeType = "lesson" | "concept" | "module";

export interface KnowledgeGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  moduleId?: string;
  strength?: KnowledgeStrengthLevel;
  quality?: number;
  entryId?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relation:
    | "prerequisite"
    | "references"
    | "parent"
    | "child"
    | "related"
    | "alternative"
    | "depends_on";
  label?: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  paths: Array<{ label: string; nodeIds: string[] }>;
}

/* ─── Intelligence Recommendations (Phase 1) ─── */

export type RecommendationKind =
  | "missing_concept"
  | "weak_lesson"
  | "duplicate_overlap"
  | "outdated"
  | "rarely_used"
  | "low_confidence"
  | "unanswered_demand"
  | "orphan"
  | "broken_reference";

export interface IntelligenceRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  description: string;
  moduleId?: CurriculumModuleId;
  entryId?: string;
  priority: OpportunityPriority;
  actionLabel: string;
}

/* ─── Health Engine (Phase 7) ─── */

export interface KnowledgeHealthSnapshot {
  overallHealth: number;
  coverage: number;
  freshness: number;
  confidence: number;
  retrievability: number;
  knowledgeDensity: number;
  duplicateRisk: number;
  orphanCount: number;
  outdatedCount: number;
  brokenReferenceCount: number;
  missingPrerequisiteCount: number;
  grade: "excellent" | "good" | "fair" | "poor";
}

export interface ModuleHealthRow {
  moduleId: CurriculumModuleId;
  moduleName: string;
  health: number;
  coverage: number;
  lessonCount: number;
  targetCount: number;
  weakCount: number;
  duplicateRisk: number;
  remainingLessons?: number;
}

/* ─── Intelligence Scorecard (Phase 13) ─── */

export interface IntelligenceScorecard {
  knowledgeQuality: number;
  reviewerConfidence: number;
  knowledgeStrength: number;
  coverageContribution: number;
  retrievalReadiness: number;
  freshness: number;
  dependencyHealth: number;
  keywordRichness: number;
  aiReliability: number;
  learningValue: number;
  composite: number;
}

export interface IntelligenceTrendPoint {
  date: string;
  health: number;
  coverage: number;
  confidence: number;
  lessonsCreated: number;
}

/* ─── Self Learning (Phase 6) ─── */

export interface LearningSignalSummary {
  questionsAsked: number;
  questionsAbandoned: number;
  searches: number;
  reviewerEdits: number;
  approvals: number;
  regenerations: number;
  rejections: number;
  lowConfidenceRetrievals: number;
  successfulAnswers: number;
  topRepeatedQuestions: Array<{ question: string; count: number }>;
  risingTopics: Array<{ topic: string; count: number }>;
}

/* ─── AI Memory (Phase 11) ─── */

export type MemoryCategory =
  | "terminology"
  | "wording"
  | "brand_language"
  | "feature_naming"
  | "reviewer_preference"
  | "writing_style"
  | "faq_pattern";

export interface KnowledgeMemoryItem {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  source: string;
  usageCount: number;
  updatedAt: string;
}

/* ─── Autonomous Suggestions (Phase 12) ─── */

export type AutonomousTrigger =
  | "new_feature"
  | "confidence_drop"
  | "new_searches"
  | "duplicate_increase"
  | "module_health_fall";

export interface AutonomousSuggestion {
  id: string;
  trigger: AutonomousTrigger;
  title: string;
  description: string;
  priority: OpportunityPriority;
  suggestedAction: string;
  moduleId?: CurriculumModuleId;
}

/* ─── Reviewer Intelligence (Phase 9) ─── */

export interface ReviewerIntelligenceHints {
  potentialDuplicates: Array<{ question: string; similarity: number; entryId?: string }>;
  missingRelatedLessons: string[];
  missingKeywords: string[];
  weakEvidence: string[];
  confidenceExplanation: string[];
  coverageContribution: number;
  suggestedImprovements: string[];
  prerequisiteLessons: string[];
  dependentLessons: string[];
  relatedCurriculum: string[];
  expectedRetrievalGain: number;
  oneClickActions: Array<{ id: string; label: string; action: string }>;
}

/* ─── Evolution (Phase 10) ─── */

export type EvolutionEventType =
  | "created"
  | "modified"
  | "improved"
  | "regenerated"
  | "published"
  | "deprecated"
  | "merged"
  | "retired";

export interface KnowledgeEvolutionEvent {
  id: string;
  entryId: string;
  type: EvolutionEventType;
  label: string;
  timestamp: string;
  versionNumber?: number;
  summary?: string;
}

/* ─── Full Intelligence Snapshot ─── */

export interface KnowledgeIntelligenceSnapshot {
  generatedAt: string;
  health: KnowledgeHealthSnapshot;
  moduleHealth: ModuleHealthRow[];
  opportunities: KnowledgeOpportunity[];
  missions: KnowledgeMission[];
  recommendations: IntelligenceRecommendation[];
  autonomousSuggestions: AutonomousSuggestion[];
  learningSignals: LearningSignalSummary;
  scorecard: IntelligenceScorecard;
  trends: IntelligenceTrendPoint[];
  topMissingTopics: Array<{ topic: string; count: number; moduleId?: string }>;
  topUnansweredQuestions: Array<{ question: string; occurrences: number; source: string }>;
  weakestModules: ModuleHealthRow[];
  strongestModules: ModuleHealthRow[];
  graphSummary: { nodeCount: number; edgeCount: number; orphanCount: number };
}

export interface EntryIntelligenceProfile {
  entryId: string;
  strength: KnowledgeStrengthLevel;
  scorecard: IntelligenceScorecard;
  evolution: KnowledgeEvolutionEvent[];
  graphNeighbors: string[];
  qualityReport?: KnowledgeQualityReport;
}

export type { AIKnowledgeEntry };
