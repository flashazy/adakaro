import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateLearningSuggestions } from "./learning-analyzer";
import {
  clusterLearningEvents,
  extractDistinctPhrase,
  inferBestIntentFromQuestion,
} from "./learning-cluster";
import { mergeEntryWithSuggestionPreview } from "./learning-apply";
import {
  buildSuggestionClusterKey,
  isValidSuggestionText,
  meetsOccurrenceThreshold,
  phraseAlreadyExists,
} from "./learning-quality";
import { isPaidEmbeddingsEnabled, isPublicPaidLlmEnabled } from "./retrieval-config";
import type { AIKnowledgeEntry } from "./types";
import type { LearningEventRow } from "./learning-types";

function makeEvent(
  partial: Partial<LearningEventRow> & { original_question: string }
): LearningEventRow {
  const id = partial.id ?? crypto.randomUUID();
  return {
    id,
    original_question: partial.original_question,
    normalized_question:
      partial.normalized_question ??
      partial.original_question.toLowerCase().replace(/\s+/g, " "),
    source: "public_ai",
    matched_entry_id: partial.matched_entry_id ?? null,
    matched_intent_key: partial.matched_intent_key ?? null,
    final_score: partial.final_score ?? null,
    confidence_level: partial.confidence_level ?? "low",
    answer_status: partial.answer_status ?? "unanswered",
    top_candidate_entries: partial.top_candidate_entries ?? [],
    top_candidate_intents: partial.top_candidate_intents ?? [],
    reason_signals: partial.reason_signals ?? [],
    page_path: null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

function makeEntry(partial: Partial<AIKnowledgeEntry>): AIKnowledgeEntry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    category: partial.category ?? "Students",
    question: partial.question ?? "Test question",
    answer: partial.answer ?? "Test answer",
    keywords: partial.keywords ?? [],
    search_phrases: partial.search_phrases ?? [],
    alternative_wording: partial.alternative_wording ?? [],
    synonyms: partial.synonyms ?? [],
    related_terms: partial.related_terms ?? [],
    related_intents: partial.related_intents ?? [],
    intent_key: partial.intent_key ?? null,
    intent_name: partial.intent_name ?? null,
    intent_group: partial.intent_group ?? null,
    priority: partial.priority ?? "normal",
    status: partial.status ?? "active",
    usage_count: partial.usage_count ?? 0,
    last_used_at: partial.last_used_at ?? null,
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

describe("learning cluster", () => {
  it("clusters similar bulk import questions", () => {
    const events = [
      makeEvent({
        original_question: "Can I migrate students from another system?",
        answer_status: "unanswered",
        matched_intent_key: "student.bulk_import",
      }),
      makeEvent({
        original_question: "Can I migrate students from another school?",
        answer_status: "unanswered",
        matched_intent_key: "student.bulk_import",
      }),
      makeEvent({
        original_question: "Can I migrate students from excel?",
        answer_status: "fallback",
        matched_intent_key: "student.bulk_import",
      }),
    ];

    const clusters = clusterLearningEvents(events);
    const learnable = clusters.filter((c) => c.occurrenceCount >= 2);

    assert.ok(learnable.length >= 1);
    const bulkCluster = learnable.find(
      (c) => c.intentKey === "student.bulk_import" || c.occurrenceCount >= 2
    );
    assert.ok(bulkCluster);
    assert.ok(bulkCluster.occurrenceCount >= 2);
  });

  it("infers bulk import intent from migration phrasing", () => {
    const intent = inferBestIntentFromQuestion(
      "Can I migrate students from another system?"
    );
    assert.equal(intent, "student.bulk_import");
  });
});

describe("learning suggestions", () => {
  it("generates search phrase suggestions for repeated questions", () => {
    const entry = makeEntry({
      intent_key: "student.bulk_import",
      search_phrases: ["import students"],
    });

    const events = [
      makeEvent({
        original_question: "Can I migrate students from another system?",
        answer_status: "unanswered",
        matched_intent_key: "student.bulk_import",
      }),
      makeEvent({
        original_question: "Can I migrate students from another school?",
        answer_status: "unanswered",
        matched_intent_key: "student.bulk_import",
      }),
    ];

    const suggestions = generateLearningSuggestions(events, [entry]);
    assert.ok(suggestions.length > 0);
    const searchPhrase = suggestions.find((s) => s.suggestion_type === "search_phrase");

    assert.ok(searchPhrase);
    assert.ok(isValidSuggestionText(searchPhrase.suggested_text, "search_phrase"));
    assert.ok(meetsOccurrenceThreshold(searchPhrase.occurrence_count));
  });

  it("prevents duplicate suggestions via cluster keys", () => {
    const phrase = extractDistinctPhrase("Can I migrate students?");
    const key = buildSuggestionClusterKey(
      "search_phrase",
      phrase,
      "student.bulk_import",
      "entry-1"
    );

    const existing = new Set([key]);
    const entry = makeEntry({
      id: "entry-1",
      intent_key: "student.bulk_import",
    });

    const events = [
      makeEvent({
        original_question: "Can I migrate students?",
        answer_status: "unanswered",
      }),
      makeEvent({
        original_question: "Can I migrate students from excel?",
        answer_status: "unanswered",
      }),
    ];

    const suggestions = generateLearningSuggestions(events, [entry], existing);
    assert.equal(suggestions.some((s) => s.cluster_key === key), false);
  });

  it("merge preview adds phrase without duplicating existing entry data", () => {
    const entry = makeEntry({
      search_phrases: ["import students"],
    });

    const merged = mergeEntryWithSuggestionPreview(entry, {
      suggestion_type: "search_phrase",
      suggested_text: "migrate students",
      target_entry_id: entry.id,
      target_intent_key: "student.bulk_import",
      source_questions: [],
      source_event_ids: [],
      occurrence_count: 2,
      confidence: 0.8,
      reason: "test",
      cluster_key: "test",
    });

    assert.equal(merged.search_phrases.length, 2);
    assert.ok(phraseAlreadyExists("import students", merged.search_phrases));
    assert.ok(phraseAlreadyExists("migrate students", merged.search_phrases));
  });

  it("wrong-match learning creates negative phrase suggestions", () => {
    const archiveEntry = makeEntry({
      id: "archive-entry",
      intent_key: "student.archive_inactive",
      search_phrases: [],
    });
    const historyEntry = makeEntry({
      id: "history-entry",
      intent_key: "student.class_history",
      search_phrases: [],
    });

    const events = [
      makeEvent({
        original_question:
          "Can I remove learner from active lists but keep history?",
        answer_status: "clarified",
        final_score: 0.48,
        top_candidate_entries: [
          {
            entryId: historyEntry.id,
            question: historyEntry.question,
            intentKey: "student.class_history",
            score: 0.48,
          },
          {
            entryId: archiveEntry.id,
            question: archiveEntry.question,
            intentKey: "student.archive_inactive",
            score: 0.44,
          },
        ],
      }),
    ];

    const suggestions = generateLearningSuggestions(events, [
      archiveEntry,
      historyEntry,
    ]);

    const negative = suggestions.find(
      (s) =>
        s.suggestion_type === "intent_negative" &&
        s.target_intent_key === "student.class_history"
    );
    const trigger = suggestions.find(
      (s) =>
        s.suggestion_type === "intent_trigger" &&
        s.target_intent_key === "student.archive_inactive"
    );

    assert.ok(negative, "expected negative phrase suggestion");
    assert.ok(trigger, "expected trigger phrase suggestion");
  });

  it("rejects generic one-word keyword suggestions", () => {
    assert.equal(isValidSuggestionText("student", "keyword"), false);
    assert.equal(isValidSuggestionText("migrate students", "search_phrase"), true);
  });
});

describe("zero-cost learning guardrails", () => {
  it("does not enable paid embeddings or LLM by default", () => {
    assert.equal(isPaidEmbeddingsEnabled(), false);
    assert.equal(isPublicPaidLlmEnabled(), false);
  });
});
