/**
 * Self Learning — aggregate signals from usage and reviewers (Phase 6).
 */

import type { LearningSignalSummary } from "./knowledge-intelligence-types";
import type { LearningEventRow } from "./learning-types";
import type { AIKnowledgeEntry } from "./types";

export function aggregateLearningSignals(input: {
  learningEvents: LearningEventRow[];
  entries: AIKnowledgeEntry[];
  approvalCount?: number;
  rejectionCount?: number;
  regenerationCount?: number;
}): LearningSignalSummary {
  const events = input.learningEvents;
  const answered = events.filter((e) => e.answer_status === "answered").length;
  const unanswered = events.filter(
    (e) => e.answer_status === "unanswered" || e.answer_status === "fallback"
  ).length;
  const lowConf = events.filter(
    (e) => e.confidence_level === "low" || (e.final_score ?? 0) < 0.42
  ).length;

  const questionCounts = new Map<string, number>();
  for (const e of events) {
    questionCounts.set(e.normalized_question, (questionCounts.get(e.normalized_question) ?? 0) + 1);
  }

  const topRepeatedQuestions = [...questionCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  const topicCounts = new Map<string, number>();
  for (const e of events) {
    const topic = e.matched_intent_key ?? "general";
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const risingTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  const editedRecently = input.entries.filter((e) => {
    const days = (Date.now() - new Date(e.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return days < 14 && e.updated_at !== e.created_at;
  }).length;

  return {
    questionsAsked: events.length,
    questionsAbandoned: unanswered,
    searches: events.filter((e) => e.reason_signals?.includes("search")).length,
    reviewerEdits: editedRecently,
    approvals: input.approvalCount ?? 0,
    regenerations: input.regenerationCount ?? 0,
    rejections: input.rejectionCount ?? 0,
    lowConfidenceRetrievals: lowConf,
    successfulAnswers: answered,
    topRepeatedQuestions,
    risingTopics,
  };
}

export function shouldBoostPriority(question: string, signals: LearningSignalSummary): boolean {
  return signals.topRepeatedQuestions.some(
    (q) => q.count >= 3 && q.question.includes(question.toLowerCase().slice(0, 20))
  );
}

export function shouldLowerPriority(entry: AIKnowledgeEntry, signals: LearningSignalSummary): boolean {
  return entry.usage_count < 2 && entry.updated_at < new Date(Date.now() - 90 * 86400000).toISOString();
}
