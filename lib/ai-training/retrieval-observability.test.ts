import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRetrievalExplanation,
  inferRetrievalMethod,
  resolveConfidenceDisplay,
  resolveCoverageStatus,
  resolveDisplayIntent,
} from "@/lib/ai-training/retrieval-observability";
import { testKnowledgeQuery } from "@/lib/ai-training/test-match";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "school management", "about adakaro"],
    search_phrases: ["what is adakaro"],
    alternative_wording: ["tell me about adakaro"],
    synonyms: ["adakaro sms"],
    related_terms: ["school software"],
    answer: "Adakaro is a school management platform.",
    priority: "normal",
    usage_count: 12,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    is_primary: true,
    version_number: 3,
    health_status: "healthy",
    ...overrides,
  };
}

describe("retrieval observability", () => {
  it("falls back to category when intent key is missing", () => {
    const resolved = resolveDisplayIntent(
      entry({ id: "1", question: "What is Adakaro?", category: "General" })
    );
    assert.equal(resolved.display, "General");
  });

  it("uses stored intent metadata when available", () => {
    const resolved = resolveDisplayIntent(
      entry({
        id: "1",
        question: "What is Adakaro?",
        intent_key: "pricing.cost",
        intent_name: "Adakaro Pricing",
        intent_group: "Pricing",
      })
    );
    assert.equal(resolved.display, "Adakaro Pricing");
    assert.equal(resolved.intentKey, "pricing.cost");
  });
});

describe("test knowledge query observability", () => {
  it("never returns empty matched intent for exact question matches", () => {
    const rows = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "How much does Adakaro cost?" }),
    ];
    const result = testKnowledgeQuery("What is Adakaro?", rows);
    assert.equal(result.matched, true);
    assert.ok(result.matchedIntent);
    assert.notEqual(result.matchedIntent, "—");
    assert.equal(result.matchedQuestion, "What is Adakaro?");
    assert.equal(result.responseSource, "knowledge_base");
    assert.equal(result.knowledgeVersion, 3);
    assert.equal(result.healthStatus, "healthy");
    assert.ok(result.retrievalExplanation.length > 0);
    assert.ok(result.retrievalMethod);
    assert.ok(result.console.performance.totalMs >= 0);
    assert.ok(result.console.kbStatistics.entriesScanned >= 2);
  });

  it("explains why no match was found", () => {
    const result = testKnowledgeQuery("completely unrelated xyz query", [
      entry({ id: "1", question: "What is Adakaro?" }),
    ]);
    assert.equal(result.matched, false);
    assert.ok(result.noMatchReason);
    assert.equal(result.matchedIntent, null);
    assert.ok(result.advanced.candidates.length >= 0);
  });

  it("returns top candidates and score breakdown for matches", () => {
    const rows = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "How does Adakaro work?", category: "General" }),
    ];
    const result = testKnowledgeQuery("What is Adakaro?", rows);
    assert.ok(result.advanced.candidates.length >= 1);
    assert.ok(result.advanced.candidates[0]?.isWinner);
    assert.equal(result.advanced.confidenceDisplay.label, "Excellent Match");
    assert.ok(result.advanced.scoreBreakdown.length > 0);
  });

  it("normalizes messy queries for debug output", () => {
    const result = testKnowledgeQuery("whats adakaro???", [
      entry({ id: "1", question: "What is Adakaro?" }),
    ]);
    assert.equal(result.advanced.queryNormalization.normalizedQuestion, "whats adakaro");
    assert.ok(result.advanced.queryNormalization.normalizedTokens.length > 0);
  });
});

describe("retrieval method inference", () => {
  it("detects keyword match from question score", () => {
    const method = inferRetrievalMethod({
      score: 1,
      phraseOverlap: 1,
      questionScore: 0.9,
      searchPhraseScore: 0.1,
      intentScore: 0,
      graphScore: 0,
      contextBoost: 0,
      priorityBoost: 0,
      matchedIntentKey: null,
    });
    assert.equal(method, "keyword_match");
  });

  it("builds human-readable explanations", () => {
    const explanation = buildRetrievalExplanation(
      {
        score: 1,
        phraseOverlap: 1,
        questionScore: 1,
        searchPhraseScore: 0,
        intentScore: 0,
        graphScore: 0,
        contextBoost: 0,
        priorityBoost: 0,
        matchedIntentKey: null,
      },
      "keyword_match",
      [],
      null
    );
    assert.match(explanation, /closely matched/i);
  });
});

describe("advanced test debug helpers", () => {
  it("labels confidence tiers", () => {
    assert.equal(resolveConfidenceDisplay(95).label, "Excellent Match");
    assert.equal(resolveConfidenceDisplay(80).label, "Strong Match");
    assert.equal(resolveConfidenceDisplay(30).label, "No Strong Match");
  });

  it("builds rejected match reasons for runner-up entries", () => {
    const result = testKnowledgeQuery("What is Adakaro?", [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "How does Adakaro work?" }),
    ]);
    assert.ok(result.advanced.rejectedMatches.length >= 1);
    assert.ok(result.advanced.rejectedMatches[0]?.reason);
  });

  it("flags duplicate risk when top candidates are close", () => {
    const coverage = resolveCoverageStatus(true, 92, [
      {
        rank: 1,
        entryId: "1",
        question: "What is Adakaro?",
        category: "General",
        intentKey: null,
        intentLabel: "General",
        scorePercent: 98,
        scoreRaw: 0.98,
        retrievalMethod: "keyword_match",
        healthStatus: "healthy",
        reasonSummary: "Exact match",
        isWinner: true,
        rejectedReason: null,
      },
      {
        rank: 2,
        entryId: "2",
        question: "Tell me about Adakaro",
        category: "General",
        intentKey: null,
        intentLabel: "General",
        scorePercent: 94,
        scoreRaw: 0.94,
        retrievalMethod: "keyword_match",
        healthStatus: "healthy",
        reasonSummary: "Similar",
        isWinner: false,
        rejectedReason: "Lower match score",
      },
    ]);
    assert.equal(coverage.status, "duplicate_risk");
  });
});
