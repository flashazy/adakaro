import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeIntentSignals,
  applyIntentReasoning,
} from "./intent-reasoning";
import type { AIKnowledgeEntry } from "./types";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import { scoreEntryBreakdown } from "./knowledge-scoring";

function mockEntry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "Student Management",
    keywords: [],
    search_phrases: [],
    alternative_wording: [],
    synonyms: [],
    related_terms: [],
    related_intents: [],
    intent_key: null,
    intent_name: null,
    intent_group: "Student Management",
    answer: "Answer",
    priority: "normal",
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function rankEntry(query: string, entry: AIKnowledgeEntry): RankedKnowledgeEntry {
  const breakdown = scoreEntryBreakdown(query, entry, { allEntries: [entry] });
  return { entry, score: breakdown.score, breakdown };
}

describe("intent reasoning signals", () => {
  it("boosts archive intent for active list removal with history", () => {
    const query =
      "Can I remove a learner from active lists but keep history?";

    const archive = analyzeIntentSignals(query, "student.archive_inactive");
    const history = analyzeIntentSignals(query, "student.class_history");

    assert.ok(archive.triggerMatches.length >= 2);
    assert.ok(archive.netSignalScore > history.netSignalScore);
    assert.ok(history.negativeMatches.length >= 1);
  });

  it("prefers archive entry over class history after reasoning", () => {
    const query =
      "Can I remove a learner from active lists but keep history?";

    const archiveEntry = mockEntry({
      id: "archive",
      question: "Can I deactivate or archive students?",
      intent_key: "student.archive_inactive",
      related_intents: ["student.class_history"],
      alternative_wording: [
        "remove learner from active lists but keep history",
      ],
    });

    const historyEntry = mockEntry({
      id: "history",
      question: "Can I see a student's class movement history?",
      intent_key: "student.class_history",
      related_intents: ["student.archive_inactive"],
      keywords: ["history", "movement"],
      related_terms: ["keep history"],
    });

    const base = [
      rankEntry(query, historyEntry),
      rankEntry(query, archiveEntry),
    ];

    const result = applyIntentReasoning(query, base);
    const winner = result.ranked[0]!;

    assert.equal(
      winner.entry.intent_key,
      "student.archive_inactive",
      "archive should win after intent reasoning"
    );
    assert.ok(result.selectionSummary);
    assert.ok(result.signals.some((s) => s.type === "trigger_match"));
  });

  it("keeps class history for movement history queries", () => {
    const query = "Can I view a student's movement history?";

    const archiveEntry = mockEntry({
      id: "archive",
      question: "Can I deactivate or archive students?",
      intent_key: "student.archive_inactive",
    });

    const historyEntry = mockEntry({
      id: "history",
      question: "Can I see a student's class movement history?",
      intent_key: "student.class_history",
      alternative_wording: ["view a student's movement history"],
      search_phrases: ["movement history"],
    });

    const base = [
      rankEntry(query, archiveEntry),
      rankEntry(query, historyEntry),
    ];

    const result = applyIntentReasoning(query, base);
    assert.equal(result.ranked[0]!.entry.intent_key, "student.class_history");
  });
});
