import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferIntentWithConfidence } from "./intent-registry";
import {
  computeIntentRecalculation,
  intentFieldsChanged,
  previewBulkIntentRecalculation,
  previewEntryIntentChange,
} from "./intent-recalculate";
import type { AIKnowledgeEntry } from "./types";

function makeEntry(partial: Partial<AIKnowledgeEntry>): AIKnowledgeEntry {
  return {
    id: partial.id ?? "entry-1",
    category: partial.category ?? "Students",
    question: partial.question ?? "Can I migrate students?",
    answer: partial.answer ?? "Yes.",
    keywords: partial.keywords ?? [],
    search_phrases: partial.search_phrases ?? [],
    alternative_wording: partial.alternative_wording ?? [],
    synonyms: partial.synonyms ?? [],
    related_terms: partial.related_terms ?? [],
    priority: partial.priority ?? "normal",
    usage_count: partial.usage_count ?? 0,
    last_used_at: partial.last_used_at ?? null,
    status: partial.status ?? "active",
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
    intent_key: partial.intent_key ?? null,
    intent_name: partial.intent_name ?? null,
    intent_group: partial.intent_group ?? null,
    related_intents: partial.related_intents ?? [],
    intent_confidence: partial.intent_confidence ?? null,
    intent_recalculated_at: partial.intent_recalculated_at ?? null,
  };
}

describe("intent inference confidence", () => {
  it("returns confidence for bulk import phrasing", () => {
    const result = inferIntentWithConfidence(
      "Can I migrate students from another system?",
      "Students"
    );
    assert.ok(result);
    assert.equal(result.key, "student.bulk_import");
    assert.ok(result.confidence >= 0.55 && result.confidence <= 1);
    assert.ok(result.reason.length > 0);
  });
});

describe("intent recalculation", () => {
  it("detects change when stored intent is wrong", () => {
    const entry = makeEntry({
      intent_key: "student.class_history",
      intent_name: "Class History",
      question: "Can I migrate students from excel?",
    });

    const change = previewEntryIntentChange(entry);
    assert.ok(change);
    assert.equal(change.newIntentKey, "student.bulk_import");
  });

  it("does not mark unchanged intent as needing update", () => {
    const inference = inferIntentWithConfidence(
      "Can I migrate students from another system?",
      "Students"
    );
    assert.ok(inference);

    const entry = makeEntry({
      intent_key: inference.key,
      intent_name: inference.name,
      intent_group: inference.group,
      related_intents: inference.relatedIntents,
      question: "Can I migrate students from another system?",
    });

    assert.equal(previewEntryIntentChange(entry), null);
    assert.equal(intentFieldsChanged(entry, {
      intent_key: inference.key,
      intent_name: inference.name,
      intent_group: inference.group,
      related_intents: inference.relatedIntents,
      intent_confidence: inference.confidence,
      intent_recalculated_at: null,
    }), false);
  });

  it("bulk preview counts only changed entries", () => {
    const entries = [
      makeEntry({
        id: "a",
        intent_key: "student.class_history",
        question: "Can I migrate students?",
      }),
      makeEntry({
        id: "b",
        intent_key: "student.bulk_import",
        intent_name: "Bulk Import",
        intent_group: "Student Management",
        related_intents: ["student.excel_upload"],
        question: "Can I migrate students from another system?",
      }),
    ];

    const preview = previewBulkIntentRecalculation(entries);
    assert.equal(preview.scanned, 2);
    assert.ok(preview.wouldUpdate >= 1);
    assert.ok(preview.changes.some((c) => c.id === "a"));
  });

  it("recalculates when question text changes", () => {
    const previous = makeEntry({
      intent_key: "student.class_history",
      question: "Where did this student move?",
    });

    const { changed, next } = computeIntentRecalculation(
      "Can I migrate students from excel?",
      previous.category,
      previous
    );

    assert.equal(changed, true);
    assert.equal(next.intent_key, "student.bulk_import");
  });
});
