import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareIntentSignatures,
  inferIntentSignature,
} from "@/lib/ai-training/intent-signature";
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
    alternative_wording: ["tell me about adakaro", "tell me what adakaro is"],
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
    health_status: "healthy",
    ...overrides,
  };
}

describe("intent signature", () => {
  it("detects identity vs capabilities intents", () => {
    assert.equal(inferIntentSignature("What is Adakaro?").category, "identity");
    assert.equal(inferIntentSignature("What can Adakaro do?").category, "capabilities");
    assert.equal(inferIntentSignature("Why choose Adakaro?").category, "reasoning");
  });

  it("separates permission from capability intents", () => {
    const permission = inferIntentSignature("Can parents view report cards?");
    const capability = inferIntentSignature("Can report cards be exported as PDF?");

    assert.equal(permission.category, "permission");
    assert.equal(permission.action, "view");
    assert.equal(capability.category, "capability");
    assert.equal(capability.action, "exported");
    assert.ok(compareIntentSignatures(permission, capability) < 0.85);
  });

  it("differentiates permission actions with the same role", () => {
    const view = inferIntentSignature("Can parents view report cards?");
    const download = inferIntentSignature("Can parents download report cards?");

    assert.equal(view.category, "permission");
    assert.equal(download.category, "permission");
    assert.equal(view.action, "view");
    assert.equal(download.action, "download");
    assert.ok(compareIntentSignatures(view, download) < 0.85);
  });

  it("returns zero similarity for different intent categories", () => {
    const identity = inferIntentSignature("What is Adakaro?");
    const capabilities = inferIntentSignature("What can Adakaro do?");
    assert.equal(compareIntentSignatures(identity, capabilities), 0);
  });
});

describe("knowledge-duplicates", () => {
  it("normalizes questions for deduplication", () => {
    assert.equal(
      normalizedQuestionField("What is Adakaro?"),
      normalizedQuestionField("what is adakaro")
    );
  });

  it("classifies What is Adakaro vs what is adakaro as exact duplicate", () => {
    const entries = [entry({ id: "1", question: "What is Adakaro?" })];
    const result = checkQuestionDuplicates("what is adakaro?", entries);
    assert.ok(result.exactMatch);
    assert.equal(result.exactMatch?.classification, "exact_duplicate");
    assert.equal(result.exactMatch?.entry.id, "1");
  });

  it("classifies Tell me what Adakaro is as near duplicate of What is Adakaro", () => {
    const entries = [entry({ id: "1", question: "What is Adakaro?" })];
    const { classification, similarity } = computeQuestionSimilarity(
      "Tell me what Adakaro is.",
      entries[0]!
    );
    assert.equal(classification, "near_duplicate");
    assert.ok(similarity >= 0.72);
  });

  it("classifies What can Adakaro do as different intent from What is Adakaro", () => {
    const existing = entry({ id: "1", question: "What is Adakaro?" });
    const { classification, similarity } = computeQuestionSimilarity(
      "What can Adakaro do?",
      existing
    );
    assert.equal(classification, "different_intent");
    assert.ok(similarity <= 0.35);
  });

  it("classifies Who is Adakaro AI as different entity from What is Adakaro", () => {
    const existing = entry({ id: "1", question: "What is Adakaro?" });
    const { classification, similarity } = computeQuestionSimilarity(
      "Who is Adakaro AI?",
      existing
    );
    assert.equal(classification, "different_intent");
    assert.ok(similarity <= 0.35);
  });

  it("classifies Student Streaming vs Report Cards as different entities", () => {
    const existing = entry({ id: "1", question: "What is Report Cards?" });
    const { classification } = computeQuestionSimilarity(
      "What is Student Streaming?",
      existing
    );
    assert.equal(classification, "different_intent");
  });

  it("classifies Why choose Adakaro as different intent from What is Adakaro", () => {
    const existing = entry({ id: "1", question: "What is Adakaro?" });
    const { classification, similarity } = computeQuestionSimilarity(
      "Why choose Adakaro?",
      existing
    );
    assert.equal(classification, "different_intent");
    assert.ok(similarity <= 0.35);
  });

  it("does not treat capabilities question as exact duplicate", () => {
    const entries = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({
        id: "2",
        question: "What can Adakaro do?",
        search_phrases: ["what can adakaro do"],
        alternative_wording: [],
      }),
    ];
    const result = checkQuestionDuplicates("What can Adakaro do?", entries, {
      excludeId: "2",
    });
    assert.equal(result.exactMatch, null);
    assert.ok(
      result.differentIntentEntries.some((m) => m.entry.id === "1") ||
        result.intentComparison?.status === "different_intent"
    );
  });

  it("finds similar entries above threshold for same-intent rewording", () => {
    const entries = [entry({ id: "1", question: "What is Adakaro?" })];
    const similar = findSimilarEntries("Tell me about Adakaro.", entries, {
      minSimilarity: 0.7,
    });
    assert.ok(similar.length >= 1);
    assert.equal(similar[0]!.classification, "near_duplicate");
    assert.ok(similar[0]!.similarity >= 0.7);
  });

  it("scores semantic overlap via shared keywords without inflating different intents", () => {
    const target = entry({ id: "1", question: "What is Adakaro?" });
    const { similarity, classification } = computeQuestionSimilarity(
      "Explain Adakaro platform",
      target
    );
    assert.ok(similarity > 0.2);
    assert.ok(similarity <= 0.35);
    assert.notEqual(classification, "exact_duplicate");
  });

  it("suggests related lessons for Adakaro AI identity questions", () => {
    const entries = [
      entry({ id: "1", question: "Who is Adakaro AI?" }),
    ];
    const result = checkQuestionDuplicates("Who is Adakaro AI?", entries, {
      excludeId: "1",
    });
    assert.ok(result.suggestedRelatedLessons.length >= 3);
    assert.ok(
      result.suggestedRelatedLessons.some((l) =>
        l.question.includes("What can Adakaro AI do")
      )
    );
  });

  it("includes intent comparison in duplicate check results", () => {
    const entries = [entry({ id: "1", question: "What is Adakaro?" })];
    const result = checkQuestionDuplicates("What can Adakaro do?", entries);
    assert.ok(result.intentComparison);
    assert.equal(result.intentComparison?.currentIntent.category, "capabilities");
    assert.equal(result.intentComparison?.existingIntent.category, "identity");
    assert.equal(result.intentComparison?.status, "different_intent");
  });

  it("classifies permission vs capability report-card questions as related topic", () => {
    const existing = entry({
      id: "1",
      question: "Can parents view report cards?",
      category: "Report Cards",
      keywords: ["parents", "report", "cards", "view"],
      search_phrases: ["can parents view report cards"],
    });
    const { classification, similarity, scores } = computeQuestionSimilarity(
      "Can report cards be exported as PDF?",
      existing,
      { category: "Report Cards" }
    );

    assert.equal(classification, "related_topic");
    assert.ok(similarity < 0.72, `expected below near-duplicate threshold, got ${similarity}`);
    assert.notEqual(scores.intentSimilarity, 1);
  });

  it("classifies permission view vs download as related not near duplicate", () => {
    const existing = entry({
      id: "1",
      question: "Can parents view report cards?",
      category: "Report Cards",
      keywords: ["parents", "report", "cards", "view"],
    });
    const { classification, similarity } = computeQuestionSimilarity(
      "Can parents download report cards?",
      existing,
      { category: "Report Cards" }
    );

    assert.notEqual(classification, "near_duplicate");
    assert.notEqual(classification, "exact_duplicate");
    assert.ok(similarity < 0.72);
  });

  it("preserves near-duplicate behavior for process report-card variants", () => {
    const existing = entry({
      id: "1",
      question: "How do report cards work in Adakaro?",
      category: "Report Cards",
      keywords: ["report", "cards", "work", "generate"],
      search_phrases: ["how do report cards work", "generate report cards"],
      alternative_wording: ["how are report cards created"],
    });
    const { classification, similarity } = computeQuestionSimilarity(
      "How do I generate report cards?",
      existing,
      { category: "Report Cards" }
    );

    assert.ok(
      classification === "near_duplicate" || classification === "related_topic",
      `unexpected classification: ${classification}`
    );
    assert.ok(similarity >= 0.65);
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
