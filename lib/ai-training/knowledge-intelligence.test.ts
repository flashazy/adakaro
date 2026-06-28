import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverKnowledgeGaps } from "@/lib/ai-training/knowledge-gap-discovery";
import { buildKnowledgeGraph, summarizeGraph } from "@/lib/ai-training/knowledge-graph-builder";
import { computeKnowledgeHealthSnapshot, computeModuleHealthRows } from "@/lib/ai-training/knowledge-health-engine";
import { analyzeKnowledgeBase } from "@/lib/ai-training/knowledge-intelligence-engine";
import { aggregateScorecard, computeEntryScorecard } from "@/lib/ai-training/knowledge-intelligence-score";
import { buildKnowledgeMissions } from "@/lib/ai-training/knowledge-missions";
import { computeKnowledgeStrength, strengthToScore } from "@/lib/ai-training/knowledge-strength";
import { generateAutonomousSuggestions } from "@/lib/ai-training/knowledge-autonomous-suggestions";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "school", "platform"],
    search_phrases: ["what is adakaro"],
    alternative_wording: [],
    synonyms: ["sms"],
    related_terms: ["school"],
    answer: "**Short Answer**\n\nAdakaro is a school platform.\n\n**Overview**\n\nFull overview here with enough content for quality checks.",
    priority: "normal",
    usage_count: 5,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    intent_key: "what_is_adakaro",
    curriculum_module: "about-adakaro",
    ...overrides,
  };
}

describe("knowledge intelligence", () => {
  it("computes knowledge strength levels", () => {
    const core = computeKnowledgeStrength(entry({ id: "1", question: "Q", priority: "critical", is_primary: true }));
    assert.equal(core, "core");
    assert.ok(strengthToScore(core) >= 88);
  });

  it("builds knowledge graph with nodes and edges", () => {
    const graph = buildKnowledgeGraph([
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "What can Adakaro do?", intent_key: "capabilities" }),
    ]);
    assert.ok(graph.nodes.length >= 2);
    const summary = summarizeGraph(graph);
    assert.ok(summary.nodeCount >= 2);
  });

  it("discovers curriculum gaps", () => {
    const gaps = discoverKnowledgeGaps({
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
      unanswered: [],
    });
    assert.ok(gaps.length > 0);
    assert.ok(gaps.some((g) => g.sources.includes("curriculum_coverage")));
  });

  it("builds missions from module health", () => {
    const moduleHealth = computeModuleHealthRows([entry({ id: "1", question: "What is Adakaro?" })]);
    const missions = buildKnowledgeMissions({
      opportunities: [],
      moduleHealth,
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
    });
    assert.ok(missions.length > 0);
    assert.ok(missions[0].estimatedMinutes > 0);
  });

  it("computes health snapshot", () => {
    const health = computeKnowledgeHealthSnapshot([entry({ id: "1", question: "What is Adakaro?" })]);
    assert.ok(health.overallHealth >= 0);
    assert.ok(["excellent", "good", "fair", "poor"].includes(health.grade));
  });

  it("produces intelligence scorecard", () => {
    const scorecard = computeEntryScorecard(entry({ id: "1", question: "What is Adakaro?" }));
    assert.ok(scorecard.composite > 0);
    assert.ok(scorecard.knowledgeQuality > 0);
  });

  it("aggregates scorecard across entries", () => {
    const agg = aggregateScorecard([
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "Who uses Adakaro?" }),
    ]);
    assert.ok(agg.composite > 0);
  });

  it("analyzes knowledge base for recommendations", () => {
    const recs = analyzeKnowledgeBase({
      entries: [entry({ id: "1", question: "What is Adakaro?", keywords: ["a"] })],
      unansweredQuestions: [{ question: "How do parents log in?", occurrences: 5 }],
    });
    assert.ok(recs.length > 0);
  });

  it("generates autonomous suggestions from health", () => {
    const health = computeKnowledgeHealthSnapshot([]);
    const suggestions = generateAutonomousSuggestions({
      health,
      opportunities: [],
      learningSignals: {
        questionsAsked: 0,
        questionsAbandoned: 0,
        searches: 0,
        reviewerEdits: 0,
        approvals: 0,
        regenerations: 0,
        rejections: 0,
        lowConfidenceRetrievals: 0,
        successfulAnswers: 0,
        topRepeatedQuestions: [],
        risingTopics: [{ topic: "parent portal", count: 12 }],
      },
    });
    assert.ok(suggestions.length > 0);
  });
});
