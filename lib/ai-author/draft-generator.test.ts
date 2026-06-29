import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuestionContext } from "@/lib/ai-author/context-engine";
import { generateDraft } from "@/lib/ai-author/draft-generator";
import { extractFactsFromLesson, isValidFactText } from "@/lib/ai-author/fact-extractor";
import { filterFacts } from "@/lib/ai-author/fact-filter";
import { scoreFact, scoreFacts } from "@/lib/ai-author/fact-scorer";
import { routeIntent } from "@/lib/ai-author/intent-router";
import { rankLessons, selectTopLessons } from "@/lib/ai-author/lesson-ranker";
import { buildDraftGenerationContext } from "@/lib/ai-author/related-content";
import { FACT_SCORE_THRESHOLD } from "@/lib/ai-author/types";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(overrides: Partial<AIKnowledgeEntry>): AIKnowledgeEntry {
  return {
    id: "e1",
    question: "What is Adakaro?",
    answer: [
      "**Overview**",
      "Adakaro is a cloud-based school management platform.",
      "",
      "**Audience**",
      "- Built for schools and administrators.",
      "- Teachers manage classes.",
      "- Parents use the portal.",
      "",
      "**Core Facts**",
      "- Adakaro includes finance and attendance.",
      "- Adakaro has an AI assistant.",
    ].join("\n"),
    category: "About Adakaro",
    status: "active",
    priority: "normal",
    keywords: ["adakaro", "school", "platform"],
    search_phrases: ["what is adakaro"],
    alternative_wording: [],
    synonyms: [],
    related_terms: ["school management"],
    usage_count: 0,
    last_used_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as AIKnowledgeEntry;
}

describe("enterprise knowledge author v3", () => {
  it("routes audience intent for who-is-built-for questions", () => {
    const route = routeIntent("Who is Adakaro built for?", "About Adakaro");
    assert.equal(route.intent, "identity");
    assert.equal(route.expectedAnswerType, "audience");
    assert.ok(route.sectionPlan.includes("Audience"));
  });

  it("extracts atomic facts from lessons", () => {
    const facts = extractFactsFromLesson(entry({ id: "1" }));
    assert.ok(facts.length >= 4);
    assert.ok(facts.some((f) => f.text.toLowerCase().includes("cloud-based")));
    assert.ok(facts.every((f) => f.sourceEntryId === "1"));
    assert.ok(facts.every((f) => isValidFactText(f.text)));
  });

  it("rejects malformed extracted facts", () => {
    assert.equal(isValidFactText(""), false);
    assert.equal(isValidFactText("Overview"), false);
    assert.equal(isValidFactText("word"), false);
    assert.equal(isValidFactText("Fact one"), false);
    assert.ok(isValidFactText("Adakaro is a school management platform."));
  });

  it("accepts facts from selected published lessons with provenance scoring", () => {
    const facts = extractFactsFromLesson(entry({ id: "1" }));
    const context = buildDraftGenerationContext(
      { question: "What is Adakaro?", category: "About Adakaro", priority: "normal" },
      [entry({ id: "1" })]
    );
    const questionContext = buildQuestionContext(context);
    const lessonScores = new Map([["1", 92]]);
    const scored = scoreFacts(facts, questionContext, { selectedLessonScores: lessonScores });
    const { kept } = filterFacts(scored, questionContext, FACT_SCORE_THRESHOLD, {
      selectedLessonIds: new Set(["1"]),
    });

    assert.ok(kept.length >= facts.length - 1, "most facts from selected lesson should be accepted");
    for (const fact of kept) {
      assert.ok(fact.relevanceScore >= FACT_SCORE_THRESHOLD || (fact.scoreBreakdown?.lessonProvenance ?? 0) >= 25);
      assert.ok(Number.isFinite(fact.relevanceScore));
      assert.ok(fact.scoreBreakdown);
    }
  });

  it("scores individual fact with full breakdown", () => {
    const fact = extractFactsFromLesson(entry({ id: "1" }))[0]!;
    const context = buildDraftGenerationContext(
      { question: "What is Adakaro?", category: "About Adakaro", priority: "normal" },
      [entry({ id: "1" })]
    );
    const scored = scoreFact(fact, buildQuestionContext(context), {
      selectedLessonScores: new Map([["1", 95]]),
    });

    assert.ok(scored.scoreBreakdown);
    assert.ok(scored.scoreBreakdown!.final >= 50);
    assert.ok(scored.scoreBreakdown!.lessonProvenance >= 30);
    assert.equal(scored.detectedEntity, "Adakaro");
  });

  it("produces wide ranking score separation", () => {
    const published = [
      entry({ id: "1", question: "What is Adakaro?" }),
      entry({
        id: "2",
        question: "What can Adakaro do?",
        answer: "**Overview**\n\n- Supports attendance\n- Includes finance",
        category: "About Adakaro",
      }),
      entry({
        id: "3",
        question: "How much does Adakaro cost?",
        answer: "**Overview**\n\n- Free up to 20 students",
        category: "Pricing",
        keywords: ["pricing", "cost"],
      }),
      entry({
        id: "4",
        question: "How do I archive students?",
        answer: "**Steps**\n\n- Open student record\n- Archive student",
        category: "Student Management",
        keywords: ["archive", "students"],
      }),
    ];

    const context = buildDraftGenerationContext(
      { question: "Who is Adakaro built for?", category: "About Adakaro", priority: "normal" },
      published
    );
    const questionContext = buildQuestionContext(context);
    const ranked = rankLessons(questionContext, published);
    const selected = selectTopLessons(ranked);

    const top = ranked[0]!.score;
    const archive = ranked.find((r) => r.entry.id === "4")!.score;
    const pricing = ranked.find((r) => r.entry.id === "3")!.score;

    assert.ok(top >= 80, `top score ${top} should be >= 80`);
    assert.ok(archive <= 15, `archive score ${archive} should be <= 15`);
    assert.ok(pricing <= 20, `pricing score ${pricing} should be <= 20`);
    assert.ok(top - archive >= 60, "wide separation between relevant and irrelevant");
    assert.ok(!selected.some((s) => s.entry.question.includes("archive")));
  });

  it("discards wrong-intent pricing facts for audience questions", () => {
    const facts = extractFactsFromLesson(
      entry({
        id: "pricing",
        question: "How much does Adakaro cost?",
        answer: "**Overview**\n\n- Free up to 20 students\n- Subscription plans available",
        category: "Pricing",
      })
    );
    const context = buildDraftGenerationContext(
      { question: "Who is Adakaro built for?", category: "About Adakaro", priority: "normal" },
      [entry({ id: "1" })]
    );
    const questionContext = buildQuestionContext(context);
    const scored = scoreFacts(facts, questionContext, {
      selectedLessonScores: new Map([["pricing", 90]]),
    });
    const { kept, discarded } = filterFacts(scored, questionContext, FACT_SCORE_THRESHOLD, {
      selectedLessonIds: new Set(["1"]),
    });
    assert.equal(kept.length, 0);
    assert.ok(discarded.length >= 2);
    assert.ok(discarded.every((f) => f.rejectionCategory === "wrong_intent" || f.rejectionCategory === "low_confidence"));
  });

  it("generates composed documentation with reasoning report", () => {
    const published = [
      entry({ id: "1" }),
      entry({
        id: "2",
        question: "What can Adakaro do?",
        answer: "**Overview**\n\n- Supports attendance\n- Includes finance",
        category: "About Adakaro",
      }),
    ];

    const result = generateDraft(
      {
        question: "Who is Adakaro built for?",
        category: "About Adakaro",
        priority: "high",
      },
      published
    );

    assert.ok(result.diagnostics.lessonsRead >= 2);
    assert.ok(result.diagnostics.factsAccepted > 0);
    assert.ok(result.diagnostics.factsUsed > 0);
    assert.ok(result.diagnostics.factsAccepted >= result.diagnostics.factsUsed);
    assert.ok(result.pipelineTrace.factsAccepted > 0);
    assert.ok(result.pipelineTrace.acceptanceRate > 0);
    assert.ok(result.diagnostics.confidence.overall >= 50);
    assert.ok(result.draft.length > 40);
    assert.match(result.draft, /\n\n/);
    assert.ok(
      result.draft.includes("Suitable for") ||
        result.draft.includes("administrator") ||
        result.draft.includes("Teachers")
    );
    assert.doesNotMatch(result.draft, /\.\s+•\s+/);
    assert.ok(!/\bfact one\b/i.test(result.draft));
  });

  it("never outputs template placeholder text", () => {
    const result = generateDraft(
      {
        question: "What is Adakaro?",
        category: "About Adakaro",
        priority: "normal",
      },
      [entry({ id: "1" })]
    );

    const placeholders = [
      /\bfact one\b/i,
      /\bfact two\b/i,
      /\bcapability one\b/i,
      /\bexample text\b/i,
      /\bdirect summary\b/i,
      /\blorem ipsum\b/i,
      /\bkey fact about\b/i,
    ];

    for (const pattern of placeholders) {
      assert.ok(!pattern.test(result.draft), `draft must not match ${pattern}`);
    }

    assert.ok(result.diagnostics.factsAccepted > 0);
    assert.ok(result.diagnostics.factsUsed > 0);
    assert.ok(result.pipelineTrace.sectionsGenerated > 0);
  });

  it("includes explainable fact traces with scores", () => {
    const result = generateDraft(
      {
        question: "What is Adakaro?",
        category: "About Adakaro",
        priority: "normal",
      },
      [entry({ id: "1" })]
    );

    assert.ok(result.pipelineTrace.factTraces.length > 0);
    const accepted = result.pipelineTrace.factTraces.filter((f) => f.accepted);
    assert.ok(accepted.length > 0);
    for (const trace of accepted) {
      assert.ok(trace.scores.final >= FACT_SCORE_THRESHOLD || trace.scores.lessonProvenance >= 25);
      assert.ok(Number.isFinite(trace.scores.semantic));
      assert.ok(trace.rejectionReason.length > 0);
    }
  });

  it("detects pricing knowledge conflicts", () => {
    const published = [
      entry({
        id: "a",
        question: "Is Adakaro free?",
        answer: "**Plans**\n\n- Free forever for all schools",
        category: "Pricing",
      }),
      entry({
        id: "b",
        question: "How much does Adakaro cost?",
        answer: "**Plans**\n\n- Free up to 20 students",
        category: "Pricing",
      }),
    ];

    const result = generateDraft(
      {
        question: "How much does Adakaro cost?",
        category: "Pricing",
        priority: "normal",
      },
      published
    );

    assert.ok(result.diagnostics.conflicts.length >= 1);
    assert.ok(result.diagnostics.factsAccepted > 0);
    assert.ok(result.diagnostics.factsUsed > 0);
  });

  it("ignores archived and merged entries", () => {
    const result = generateDraft(
      {
        question: "How does attendance work?",
        category: "Attendance",
        priority: "normal",
      },
      [
        entry({
          id: "archived",
          status: "archived",
          question: "Archived lesson",
          answer: "Should not appear",
        }),
        entry({
          id: "merged",
          merged_into_id: "1",
          question: "Merged lesson",
          answer: "Should not appear",
        } as Partial<AIKnowledgeEntry> as AIKnowledgeEntry),
      ]
    );

    assert.equal(result.sourcesUsed.length, 0);
    assert.equal(result.diagnostics.factsUsed, 0);
    assert.equal(result.diagnostics.factsAccepted, 0);
    assert.ok(!/\bfact one\b/i.test(result.draft));
  });
});
