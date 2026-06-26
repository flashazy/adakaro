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

export const KNOWLEDGE_CATEGORIES = [
  "General",
  "Attendance",
  "Report Cards",
  "Finance",
  "Parent Portal",
  "Pricing",
  "Onboarding",
  "Student Management",
  "Syllabus",
  "Support",
] as const;

export const STARTER_QUESTIONS = [
  "Can Adakaro generate report cards?",
  "Can parents see attendance?",
  "How does pricing work?",
  "Can I import students from Excel?",
] as const;

export const MATCH_SCORE_THRESHOLD = 0.58;
