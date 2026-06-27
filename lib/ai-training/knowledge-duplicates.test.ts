import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkQuestionDuplicates,
  computeQuestionSimilarity,
  findSimilarEntries,
  normalizedQuestionField,
} from "@/lib/ai-training/knowledge-duplicates";
import { applyRetrievalPriority } from "@/lib/ai-training/knowledge-retrieval-priority";
import { scoreEntryBreakdown } from "@/lib/ai-training/knowledge-scoring";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "platform", "school"],
    search_phrases: ["what is adakaro"],
    alternative_wording: ["tell me about adakaro"],
    synonyms: ["adakaro app"],
    related_terms: ["school management"],
    answer: "Adakaro is a school management platform.",
    priority: "normal",
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    is_primary: true,
    version_number: 1,
    ...overrides,
  };
}

describe("knowledge-duplicates", () => {
  it("normalizes questions for deduplication", () => {
    assert.equal(
      normalizedQuestionField("What is Adakaro?"),
      normalizedQuestionField("what is adakaro")
    );
  });

  it("detects exact normalized duplicates", () => {
    const entries = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "Tell me about billing." }),
    ];
    const result = checkQuestionDuplicates("what is adakaro?", entries);
    assert.ok(result.exactMatch);
    assert.equal(result.exactMatch?.entry.id, "1");
  });

  it("finds similar entries above threshold", () => {
    const entries = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({
        id: "2",
        question: "What does Adakaro do?",
        alternative_wording: ["explain adakaro"],
      }),
    ];
    const similar = findSimilarEntries("Tell me about Adakaro.", entries, {
      minSimilarity: 0.7,
    });
    assert.ok(similar.length >= 1);
    assert.ok(similar[0]!.similarity >= 0.7);
  });

  it("scores semantic overlap via shared keywords", () => {
    const target = entry({ id: "1", question: "What is Adakaro?" });
    const { similarity } = computeQuestionSimilarity("Explain Adakaro platform", target);
    assert.ok(similarity > 0.5);
  });
});

describe("knowledge-retrieval-priority", () => {
  it("prefers primary newer higher-version entries", () => {
    const older = entry({
      id: "old",
      question: "What is Adakaro?",
      version_number: 1,
      updated_at: "2026-01-01T00:00:00Z",
      usage_count: 50,
      is_primary: false,
    });
    const newer = entry({
      id: "new",
      question: "What is Adakaro?",
      version_number: 3,
      updated_at: "2026-06-01T00:00:00Z",
      usage_count: 5,
      is_primary: true,
    });

    const ranked = applyRetrievalPriority([
      {
        entry: older,
        score: 0.9,
        breakdown: scoreEntryBreakdown("what is adakaro", older, { allEntries: [older, newer] }),
      },
      {
        entry: newer,
        score: 0.895,
        breakdown: scoreEntryBreakdown("what is adakaro", newer, { allEntries: [older, newer] }),
      },
    ]);

    assert.equal(ranked[0]?.entry.id, "new");
  });
});
