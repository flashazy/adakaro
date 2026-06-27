import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConfidenceReasons,
  buildKnowledgeBaseStatistics,
  resolveSpeedTier,
} from "@/lib/ai-training/test-observability-console";
import { resolveConfidenceDisplay } from "@/lib/ai-training/retrieval-observability";
import { testKnowledgeQuery } from "@/lib/ai-training/test-match";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "school", "platform"],
    search_phrases: ["what is adakaro"],
    alternative_wording: [],
    synonyms: ["sms"],
    related_terms: ["school software"],
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

describe("test observability console", () => {
  it("labels retrieval speed tiers", () => {
    assert.equal(resolveSpeedTier(14).label, "Extremely Fast");
    assert.equal(resolveSpeedTier(14).tier, "green");
    assert.equal(resolveSpeedTier(120).tier, "red");
  });

  it("builds knowledge base statistics", () => {
    const stats = buildKnowledgeBaseStatistics(
      [
        entry({ id: "1", question: "A" }),
        entry({ id: "2", question: "B", health_status: "needs_review" }),
      ],
      [],
      false
    );
    assert.equal(stats.entriesScanned, 2);
    assert.equal(stats.healthyEntries, 1);
    assert.equal(stats.needsReviewEntries, 1);
  });

  it("includes enterprise console on test results", () => {
    const result = testKnowledgeQuery("What is Adakaro?", [
      entry({
        id: "1",
        question: "What is Adakaro?",
        intent_key: "what_is_adakaro",
      }),
    ]);
    assert.ok(result.console.pipeline.length >= 6);
    assert.ok(result.console.confidenceReasons.length > 0);
    assert.match(result.console.qualityScore.grade, /^A\+|[A-D]$/);
    assert.ok(result.console.performance.totalMs >= 0);
    assert.ok(result.console.kbStatistics.entriesScanned === 1);
  });

  it("marks confidence reasons for exact matches", () => {
    const row = entry({ id: "1", question: "What is Adakaro?" });
    const reasons = buildConfidenceReasons({
      query: "What is Adakaro?",
      breakdown: {
        score: 1,
        phraseOverlap: 1,
        questionScore: 1,
        searchPhraseScore: 0.5,
        intentScore: 0,
        graphScore: 0,
        contextBoost: 0,
        priorityBoost: 0,
        matchedIntentKey: null,
      },
      winner: row,
      matchedKeywords: ["adakaro"],
      matchedPhrases: [],
      matched: true,
    });
    assert.ok(reasons.find((r) => r.label === "Exact title match")?.met);
  });

  it("maps confidence display tiers", () => {
    assert.equal(resolveConfidenceDisplay(95).label, "Excellent Match");
    assert.equal(resolveConfidenceDisplay(50).label, "Weak Match");
  });
});
