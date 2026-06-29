import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBrainHeader,
  buildIntelligenceFeed,
  buildMorningBrief,
  buildWelcomeMessage,
  formatKnowledgeVersion,
} from "@/lib/ai-training/operations-presentation";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";

function snapshot(overrides: Partial<KnowledgeIntelligenceSnapshot> = {}): KnowledgeIntelligenceSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    health: {
      overallHealth: 78,
      coverage: 46,
      freshness: 82,
      confidence: 85,
      retrievability: 80,
      knowledgeDensity: 55,
      duplicateRisk: 8,
      orphanCount: 2,
      outdatedCount: 1,
      brokenReferenceCount: 0,
      missingPrerequisiteCount: 0,
      grade: "good",
    },
    moduleHealth: [
      {
        moduleId: "about-adakaro",
        moduleName: "About Adakaro",
        health: 90,
        coverage: 88,
        lessonCount: 40,
        targetCount: 45,
        weakCount: 1,
        duplicateRisk: 5,
      },
      {
        moduleId: "admissions",
        moduleName: "Admissions",
        health: 52,
        coverage: 38,
        lessonCount: 12,
        targetCount: 40,
        weakCount: 8,
        duplicateRisk: 12,
        remainingLessons: 28,
      },
    ],
    opportunities: [],
    missions: [
      {
        id: "m1",
        type: "complete_module",
        title: "Complete Admissions",
        description: "Fill admissions curriculum",
        moduleId: "admissions",
        moduleName: "Admissions",
        lessonsRemaining: 28,
        estimatedMinutes: 22,
        priority: "critical",
        progress: 30,
      },
    ],
    recommendations: [],
    autonomousSuggestions: [
      {
        id: "s1",
        trigger: "module_health_fall",
        title: "Recover Admissions",
        description: "Module health declining",
        priority: "high",
        suggestedAction: "Generate 28 lessons",
        moduleId: "admissions",
      },
    ],
    learningSignals: {
      questionsAsked: 318,
      questionsAbandoned: 12,
      searches: 45,
      reviewerEdits: 20,
      approvals: 132,
      regenerations: 5,
      rejections: 3,
      lowConfidenceRetrievals: 8,
      successfulAnswers: 290,
      topRepeatedQuestions: [{ question: "How do parents log in?", count: 12 }],
      risingTopics: [{ topic: "Attendance", count: 15 }],
    },
    scorecard: {
      knowledgeQuality: 88,
      reviewerConfidence: 85,
      knowledgeStrength: 82,
      coverageContribution: 46,
      retrievalReadiness: 80,
      freshness: 82,
      dependencyHealth: 90,
      keywordRichness: 78,
      aiReliability: 85,
      learningValue: 76,
      composite: 82,
    },
    trends: [
      { date: "2026-06-17", health: 74, coverage: 44, confidence: 83, lessonsCreated: 10 },
      { date: "2026-06-18", health: 75, coverage: 45, confidence: 84, lessonsCreated: 12 },
      { date: "2026-06-19", health: 76, coverage: 45, confidence: 85, lessonsCreated: 8 },
      { date: "2026-06-20", health: 77, coverage: 46, confidence: 85, lessonsCreated: 15 },
      { date: "2026-06-21", health: 77, coverage: 46, confidence: 86, lessonsCreated: 20 },
      { date: "2026-06-22", health: 78, coverage: 46, confidence: 87, lessonsCreated: 18 },
      { date: "2026-06-23", health: 78, coverage: 46, confidence: 87, lessonsCreated: 14 },
    ],
    topMissingTopics: [{ topic: "Online Admissions", count: 12, moduleId: "admissions" }],
    topUnansweredQuestions: [{ question: "How do I apply online?", occurrences: 8, source: "public_ai" }],
    weakestModules: [],
    strongestModules: [],
    graphSummary: { nodeCount: 120, edgeCount: 340, orphanCount: 2 },
    ...overrides,
  };
}

describe("operations presentation", () => {
  it("builds brain header from snapshot", () => {
    const header = buildBrainHeader(snapshot());
    assert.equal(header.statusLabel, "Needs Attention");
    assert.ok(header.currentMission.includes("Admissions"));
    assert.ok(header.estimatedMastery > 0);
  });

  it("builds intelligence feed events", () => {
    const feed = buildIntelligenceFeed(snapshot());
    assert.ok(feed.length > 0);
    assert.ok(feed.some((e) => e.category === "recommendation"));
  });

  it("builds morning brief", () => {
    const brief = buildMorningBrief(snapshot());
    assert.equal(brief.approved, 132);
    assert.ok(brief.recommendation.includes("Admissions"));
  });

  it("builds welcome message", () => {
    const msg = buildWelcomeMessage(snapshot(), "Abdallah");
    assert.ok(msg.includes("Abdallah"));
    assert.ok(msg.includes("318"));
  });

  it("formats knowledge version", () => {
    assert.equal(formatKnowledgeVersion(82), "v2.7");
  });
});
