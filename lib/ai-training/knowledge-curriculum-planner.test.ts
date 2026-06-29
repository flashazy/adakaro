import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCurriculumPlannerSnapshot,
  buildCurriculumPlannerContext,
  mergePriorityLessonSuggestions,
  prioritizeRelatedLessons,
  scoreDependencyFollowUp,
} from "@/lib/ai-training/knowledge-curriculum-planner";
import { checkQuestionDuplicates } from "@/lib/ai-training/knowledge-duplicates";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "About Adakaro",
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
    health_status: "healthy",
    curriculum_module: "about-adakaro",
    ...overrides,
  };
}

describe("knowledge-curriculum-planner", () => {
  it("ranks missing foundational lessons above existing related lessons", () => {
    const entries = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "Why choose Adakaro?" }),
    ];

    const dup = checkQuestionDuplicates("What is Adakaro?", entries);
    const context = buildCurriculumPlannerContext({ entries });
    const prioritized = prioritizeRelatedLessons(
      "What is Adakaro?",
      dup.suggestedRelatedLessons,
      context
    );

    assert.ok(prioritized.length > 0);
    const missing = prioritized.filter((p) => !p.inDatabase);
    const existing = prioritized.filter((p) => p.inDatabase);
    if (missing.length > 0 && existing.length > 0) {
      assert.ok(missing[0]!.priorityScore >= existing[0]!.priorityScore);
    }
  });

  it("boosts business-critical questions in global recommendations", () => {
    const snapshot = buildCurriculumPlannerSnapshot({
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
    });

    assert.ok(
      snapshot.topRecommendations.some((r) =>
        r.question.toLowerCase().includes("what can adakaro do")
      )
    );
    assert.ok(snapshot.topRecommendations[0]!.priorityScore >= 50);
  });

  it("builds roadmap tracks with completion status", () => {
    const snapshot = buildCurriculumPlannerSnapshot({
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
    });

    const identity = snapshot.roadmap.find((t) => t.id === "identity");
    assert.ok(identity);
    assert.equal(identity.completedCount, 1);
    assert.ok(identity.lessons.some((l) => l.status === "missing"));
  });

  it("detects weak module coverage gaps", () => {
    const entries = [
      entry({
        id: "1",
        question: "How does enrollment desk work?",
        category: "Admissions",
        curriculum_module: "admissions",
      }),
    ];

    const snapshot = buildCurriculumPlannerSnapshot({
      entries,
      moduleTargets: { admissions: 100 },
    });

    assert.ok(snapshot.gapIssues.some((i) => i.kind === "weak_coverage"));
  });

  it("merges duplicate recommendations and aggregates dependency reasons", () => {
    const context = buildCurriculumPlannerContext({
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
    });

    const merged = mergePriorityLessonSuggestions([
      scoreDependencyFollowUp("Why choose Adakaro?", "What is Adakaro?", context),
      scoreDependencyFollowUp("Why choose Adakaro?", "Who is Adakaro built for?", context),
      scoreDependencyFollowUp("Why choose Adakaro?", "What can Adakaro do?", context),
    ]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.question, "Why choose Adakaro?");
    assert.equal(merged[0]!.dependentLessonCount, 3);
    assert.match(merged[0]!.reason, /Recommended because:/);
    assert.match(merged[0]!.reason, /What is Adakaro\?/);
    assert.match(merged[0]!.reason, /Who is Adakaro built for\?/);
    assert.match(merged[0]!.reason, /What can Adakaro do\?/);
  });

  it("returns unique top recommendations", () => {
    const snapshot = buildCurriculumPlannerSnapshot({
      entries: [entry({ id: "1", question: "What is Adakaro?" })],
    });

    const seen = new Set<string>();
    for (const rec of snapshot.topRecommendations) {
      const key = rec.question.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
      assert.ok(!seen.has(key), `duplicate top recommendation: ${rec.question}`);
      seen.add(key);
    }
  });
});
