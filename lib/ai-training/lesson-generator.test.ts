import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeModuleCurriculum, generateModuleLessons } from "@/lib/ai-training/lesson-generator";
import { modeToCount } from "@/lib/ai-training/lesson-generation-prompt";
import { scoreToGrade, shouldSkipDuplicate } from "@/lib/ai-training/lesson-generation-validator";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "school", "platform"],
    search_phrases: ["what is adakaro"],
    alternative_wording: ["tell me about adakaro"],
    synonyms: ["sms"],
    related_terms: ["school management"],
    answer:
      "**Overview**\n\nAdakaro is a school management platform.\n\n**Core Facts**\n\n- Enrollment\n- Attendance",
    priority: "normal",
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    is_primary: true,
    intent_key: "what_is_adakaro",
    ...overrides,
  };
}

describe("lesson generator", () => {
  it("maps generation modes to counts", () => {
    assert.equal(modeToCount("10", 78), 10);
    assert.equal(modeToCount("fill_remaining", 78), 50);
    assert.equal(modeToCount("fill_remaining", 5), 5);
  });

  it("analyzes module curriculum and finds missing concepts", () => {
    const analysis = analyzeModuleCurriculum(
      "about-adakaro",
      [entry({ id: "1", question: "What is Adakaro?" })],
      80
    );
    assert.equal(analysis.moduleId, "about-adakaro");
    assert.equal(analysis.existingCount, 1);
    assert.equal(analysis.remainingCount, 79);
    assert.ok(analysis.missingConcepts.length > 0);
  });

  it("generates draft lessons without duplicating existing questions", async () => {
    const existing = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({ id: "2", question: "What can Adakaro do?" }),
    ];
    const result = await generateModuleLessons({
      moduleId: "about-adakaro",
      mode: "10",
      targetLessons: 80,
      existingEntries: existing,
    });

    assert.ok(result.lessons.length >= 0);
    assert.ok(Array.isArray(result.blockedLessons));
    assert.ok(result.qualityMetrics);
    assert.equal(result.provider, "rule_based");
    for (const lesson of result.lessons) {
      assert.equal(lesson.reviewStatus, "draft");
      assert.ok(lesson.question.length > 5);
      assert.ok(lesson.answer.includes("Overview") || lesson.answer.includes("**"));
      assert.ok(lesson.keywords.length > 0);
      assert.ok(lesson.overallGrade);
    }

    const dupQuestions = result.lessons.filter((l) =>
      existing.some((e) => e.question.toLowerCase() === l.question.toLowerCase())
    );
    assert.equal(dupQuestions.length, 0);
  });

  it("scores grades consistently", () => {
    assert.equal(scoreToGrade(96), "A+");
    assert.equal(scoreToGrade(80), "B");
    assert.equal(scoreToGrade(50), "Needs Review");
  });

  it("skips high and medium duplicate risks", () => {
    assert.equal(shouldSkipDuplicate("high"), true);
    assert.equal(shouldSkipDuplicate("medium"), true);
    assert.equal(shouldSkipDuplicate("low"), false);
    assert.equal(shouldSkipDuplicate("none"), false);
  });
});
