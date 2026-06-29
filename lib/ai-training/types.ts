export type KnowledgePriority = "low" | "normal" | "high" | "critical";
export type KnowledgeStatus = "active" | "archived";
export type UnansweredStatus = "pending" | "answered" | "ignored" | "archived";
export type UnansweredSource =
  | "public_ai"
  | "copilot"
  | "whatsapp"
  | "website"
  | "demo"
  | "support"
  | "other";

export type QualityLevel = "excellent" | "good" | "needs_improvement";
export type HealthStatus = "excellent" | "good" | "needs_training";

export interface AIKnowledgeEntry {
  id: string;
  category: string;
  question: string;
  keywords: string[];
  search_phrases: string[];
  alternative_wording: string[];
  synonyms: string[];
  related_terms: string[];
  answer: string;
  priority: KnowledgePriority;
  usage_count: number;
  last_used_at: string | null;
  status: KnowledgeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  intent_key?: string | null;
  intent_name?: string | null;
  intent_group?: string | null;
  related_intents?: string[];
  intent_confidence?: number | null;
  intent_recalculated_at?: string | null;
  normalized_question?: string | null;
  is_primary?: boolean;
  root_entry_id?: string | null;
  version_number?: number;
  merged_into_id?: string | null;
  updated_by?: string | null;
  health_status?: KnowledgeHealthLevel;
  curriculum_module?: string | null;
}

export type KnowledgeHealthLevel = "healthy" | "needs_review";

export type DuplicateSaveAction =
  | "create"
  | "update_existing"
  | "replace_answer"
  | "new_version";

export type {
  DuplicateClassification,
  DuplicateCheckResult,
  DuplicateScoreBreakdown,
  IntentComparison,
  SimilarEntryMatch,
} from "./knowledge-duplicates";

export interface IntentHealthSummary {
  registryVersion: string;
  activeEntries: number;
  nullIntentCount: number;
  staleIntentCount: number;
  needsRecalculation: number;
}

export interface IntentChangePreview {
  id: string;
  question: string;
  category: string;
  oldIntentKey: string | null;
  oldIntentName: string | null;
  newIntentKey: string | null;
  newIntentName: string | null;
  confidence: number | null;
  reason: string;
}

export interface BulkRecalculatePreview {
  scanned: number;
  wouldUpdate: number;
  unchanged: number;
  changes: IntentChangePreview[];
}

export interface BulkRecalculateResult {
  scanned: number;
  updated: number;
  unchanged: number;
  failed: number;
  durationMs: number;
}

export interface AIUnansweredQuestion {
  id: string;
  question: string;
  normalized_question: string;
  occurrences: number;
  source: UnansweredSource;
  status: UnansweredStatus;
  linked_knowledge_entry_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface KeywordGenerationResult {
  keywords: string[];
  synonyms: string[];
  search_phrases: string[];
  alternative_wording: string[];
  related_terms: string[];
}

export interface KnowledgeSearchMatch {
  entry: AIKnowledgeEntry;
  /** Final combined score used for selection. */
  score: number;
  keywordScore?: number;
  semanticScore?: number | null;
  finalScore?: number;
  matchedIntentKey?: string | null;
}

export interface UnansweredMatchDebug {
  query: string;
  expandedQuery?: string;
  topScore?: number;
  matchedIntentKey?: string | null;
  matchedIntent?: string | null;
  matchedCategory?: string | null;
  matchedEntryId?: string | null;
  matchedQuestion?: string | null;
  retrievalMethod?: string | null;
  matchScore?: number;
  matchedKeywords?: string[];
  matchedSearchPhrase?: string | null;
  knowledgeVersion?: number | null;
  isPrimaryEntry?: boolean;
  healthStatus?: string | null;
  retrievalExplanation?: string;
  responseSource?: string;
  noMatchReason?: string | null;
  candidates?: Array<{
    entryId: string;
    question: string;
    intentKey?: string | null;
    score: number;
  }>;
  resultType?: string;
  reasonSignals?: string[];
  selectionSummary?: string;
}

export interface KnowledgeEmbeddingRow {
  id: string;
  knowledge_entry_id: string;
  embedding_text: string;
  embedding_model: string;
  created_at: string;
  updated_at: string;
}

export interface IntentCoverageSummary {
  totalIntents: number;
  coveredIntents: number;
  missingIntents: number;
  weakIntents: number;
  intents: Array<{
    key: string;
    name: string;
    group: string;
    entryCount: number;
    status: "covered" | "missing" | "weak";
  }>;
  categoriesNeedingTraining: Array<{
    group: string;
    missingCount: number;
  }>;
}

export interface AIHealthScore {
  score: number;
  status: HealthStatus;
}

export interface AIActivityItem {
  id: string;
  type: "unanswered" | "created" | "edited" | "archived";
  label: string;
  timestamp: string;
}

export interface CategoryCoverage {
  category: string;
  entryCount: number;
  usageCount: number;
  coveragePercent: number;
}

export interface EntryWithMetrics extends AIKnowledgeEntry {
  qualityScore: number;
  qualityLevel: QualityLevel;
  successRate: number;
}

export interface AITrainingAnalytics {
  totalKnowledgeEntries: number;
  activeKnowledgeEntries: number;
  unansweredCount: number;
  pendingUnansweredCount: number;
  knowledgeCoveragePercent: number;
  answerSuccessRate: number;
  aiHealth: AIHealthScore;
  recentTrainingActions: number;
  mostUsedQuestions: Array<{
    id: string;
    question: string;
    category: string;
    usage_count: number;
    last_used_at: string | null;
  }>;
  mostSearchedKeywords: Array<{ keyword: string; count: number }>;
  topCategories: Array<{ category: string; count: number; usage: number }>;
  coverageByCategory: CategoryCoverage[];
  usageTrend: Array<{ date: string; count: number }>;
  questionFrequency: Array<{ date: string; count: number }>;
  trendingUnanswered: Array<{
    id: string;
    question: string;
    occurrences: number;
    source: UnansweredSource;
    first_seen_at: string;
    last_seen_at: string;
  }>;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"
  | "published";

export type ApprovalSourceType =
  | "ai_lesson_generator"
  | "manual"
  | "import"
  | "other";

export type ApprovalDuplicateRisk = "none" | "low" | "medium" | "high";

export interface AIKnowledgeApprovalQueueItem {
  id: string;
  proposed_question: string;
  proposed_answer: string;
  proposed_category: string;
  proposed_priority: KnowledgePriority;
  proposed_keywords: string[];
  proposed_synonyms: string[];
  proposed_search_phrases: string[];
  proposed_alternative_wording: string[];
  proposed_related_terms: string[];
  proposed_intent_key: string | null;
  proposed_intent_name: string | null;
  proposed_intent_group: string | null;
  proposed_curriculum_module: string | null;
  source_type: ApprovalSourceType;
  source_metadata: Record<string, unknown>;
  quality_score: number;
  duplicate_risk: ApprovalDuplicateRisk;
  coverage_score: number;
  approval_status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalQueueSummary {
  pending: number;
  approved: number;
  published: number;
  rejected: number;
  needsReview: number;
  duplicateRisk: number;
  total: number;
}

export interface BulkPublishPreviewItem {
  id: string;
  question: string;
  outcome: "safe" | "warning" | "blocked";
  reason: string | null;
}

export interface BulkPublishPreview {
  totalSelected: number;
  safeToPublish: number;
  duplicateWarnings: number;
  blockedDuplicates: number;
  estimatedNewEntries: number;
  items: BulkPublishPreviewItem[];
}

export {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_TAXONOMY,
  type KnowledgeCategory,
} from "./knowledge-categories";

export const STARTER_QUESTIONS = [
  "Can Adakaro generate report cards?",
  "Can parents see attendance?",
  "How does pricing work?",
  "Can I import students from Excel?",
] as const;

export const MATCH_SCORE_THRESHOLD = 0.58;
