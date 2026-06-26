export type LearningAnswerStatus =
  | "answered"
  | "clarified"
  | "unanswered"
  | "fallback"
  | "llm";

export type LearningConfidenceLevel = "high" | "medium" | "low";

export type LearningSuggestionType =
  | "search_phrase"
  | "alternative_wording"
  | "synonym"
  | "keyword"
  | "related_intent"
  | "new_entry"
  | "intent_trigger"
  | "intent_negative";

export type LearningSuggestionStatus = "pending" | "approved" | "rejected";

export interface LearningCandidateEntry {
  entryId: string;
  question: string;
  intentKey: string | null;
  score: number;
}

export interface LearningCaptureInput {
  question: string;
  matchedEntryId: string | null;
  matchedIntentKey: string | null;
  finalScore: number | null;
  answerStatus: LearningAnswerStatus;
  topCandidateEntries: LearningCandidateEntry[];
  topCandidateIntents: string[];
  reasonSignals: string[];
  pagePath?: string | null;
  source?: "public_ai";
}

export interface LearningEventRow {
  id: string;
  original_question: string;
  normalized_question: string;
  source: string;
  matched_entry_id: string | null;
  matched_intent_key: string | null;
  final_score: number | null;
  confidence_level: LearningConfidenceLevel;
  answer_status: LearningAnswerStatus;
  top_candidate_entries: LearningCandidateEntry[];
  top_candidate_intents: string[];
  reason_signals: string[];
  page_path: string | null;
  created_at: string;
}

export interface LearningSuggestionRow {
  id: string;
  suggestion_type: LearningSuggestionType;
  suggested_text: string;
  target_entry_id: string | null;
  target_intent_key: string | null;
  source_questions: string[];
  source_event_ids: string[];
  occurrence_count: number;
  confidence: number;
  reason: string;
  cluster_key: string;
  status: LearningSuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftLearningSuggestion {
  suggestion_type: LearningSuggestionType;
  suggested_text: string;
  target_entry_id: string | null;
  target_intent_key: string | null;
  source_questions: string[];
  source_event_ids: string[];
  occurrence_count: number;
  confidence: number;
  reason: string;
  cluster_key: string;
}

export interface QuestionCluster {
  clusterKey: string;
  intentKey: string | null;
  questions: string[];
  normalizedQuestions: string[];
  eventIds: string[];
  occurrenceCount: number;
  avgScore: number;
  answerStatuses: LearningAnswerStatus[];
  topCandidateIntents: string[];
}

export interface LearningMetricsSummary {
  totalQuestionsCaptured: number;
  answeredRate: number;
  clarificationRate: number;
  unansweredRate: number;
  lowConfidenceRate: number;
  topRepeatedQuestions: Array<{ question: string; count: number }>;
  topWeakIntents: Array<{ intentKey: string; count: number }>;
  suggestionsPending: number;
  suggestionsApproved: number;
  recentApprovedCount: number;
}

export interface IntentLearningOverrides {
  triggerPhrases: Map<string, string[]>;
  negativePhrases: Map<string, string[]>;
}

export const EMPTY_INTENT_OVERRIDES: IntentLearningOverrides = {
  triggerPhrases: new Map(),
  negativePhrases: new Map(),
};
