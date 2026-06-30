import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkQuestionDuplicates } from "@/lib/ai-training/knowledge-duplicates";
import { assessEnterpriseReadiness } from "@/lib/ai-training/knowledge-authoring";
import {
  buildCurriculumPlannerContext,
  getLessonPrerequisites,
  prioritizeRelatedLessons,
} from "@/lib/ai-training/knowledge-curriculum-planner";
import {
  findKnowledgeCoverage,
  isKnowledgeCovered,
  resolvePrerequisite,
} from "@/lib/ai-training/prerequisite-resolver";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "Report Cards",
    keywords: ["report", "cards", "generate", "grades"],
    search_phrases: ["how do report cards work", "generate report cards"],
    alternative_wording: ["how are report cards created"],
    synonyms: ["report card generation"],
    related_terms: ["grades", "assessment"],
    answer:
      "Report cards in Adakaro summarize student performance. Schools generate them from the Report Cards module after marks are entered.",
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
    curriculum_module: "report-cards",
    ...overrides,
  };
}

describe("prerequisite-resolver workflow consistency", () => {
  const reportCardsEntry = entry({
    id: "rc-1",
    question: "How do report cards work in Adakaro?",
    category: "Report Cards",
  });

  it("semantically satisfies report-card prerequisite variants", () => {
    const entries = [reportCardsEntry];

    for (const variant of [
      "How do I generate report cards?",
      "How are report cards created?",
      "How do schools generate report cards?",
    ]) {
      const coverage = findKnowledgeCoverage(variant, entries);
      assert.ok(coverage, `expected coverage for: ${variant}`);
      assert.equal(coverage!.entry.id, "rc-1");
      assert.ok(coverage!.similarity >= 0.65);
    }
  });

  it("marks prerequisite complete when semantically covered", () => {
    const context = buildCurriculumPlannerContext({ entries: [reportCardsEntry] });

    const prereqs = getLessonPrerequisites(
      "Can parents view report cards?",
      context
    );

    const generateDep = prereqs.find((p) =>
      p.question.toLowerCase().includes("generate report cards")
    );
    assert.ok(generateDep);
    assert.equal(generateDep!.completed, true);
    assert.ok(generateDep!.satisfiedBy);
    assert.equal(generateDep!.satisfiedBy!.entryId, "rc-1");
  });

  it("does not recommend creating lessons already covered semantically", () => {
    const context = buildCurriculumPlannerContext({ entries: [reportCardsEntry] });
    const dup = checkQuestionDuplicates(
      "Can parents view report cards?",
      [reportCardsEntry]
    );

    const suggestions = prioritizeRelatedLessons(
      "Can parents view report cards?",
      dup.suggestedRelatedLessons,
      context
    );

    const redundant = suggestions.filter((s) =>
      isKnowledgeCovered(s.question, [reportCardsEntry])
    );
    assert.equal(redundant.length, 0);
  });

  it("allows enterprise publishing when prerequisites are semantically satisfied", () => {
    const draft = {
      category: "Report Cards",
      question: "Can parents view report cards?",
      answer:
        "**Overview**\nParents can view published report cards from the parent portal.\n\n**Steps**\n- Open the parent app\n- Select Report Cards",
      keywords: ["parents", "report", "cards", "portal", "view"],
      search_phrases: ["can parents view report cards"],
      alternative_wording: ["parent report card access"],
      synonyms: ["parent portal report cards"],
      related_terms: ["parent portal"],
      priority: "normal" as const,
    };

    const readiness = assessEnterpriseReadiness({
      draft,
      metadataBaseline: { question: draft.question, answer: draft.answer },
      allEntries: [reportCardsEntry],
    });

    const depCheck = readiness.checks.find((c) => c.id === "dependency-analysis");
    assert.equal(depCheck?.passed, true, depCheck?.hint);
  });

  it("flags duplicate and satisfied prerequisite consistently for near-duplicate create", () => {
    const draft = {
      category: "Report Cards",
      question: "How do I generate report cards?",
      answer:
        "**Overview**\nGenerate report cards from the Report Cards module after entering marks.",
      keywords: ["report", "cards", "generate", "marks"],
      search_phrases: ["how to generate report cards"],
      alternative_wording: ["create report cards"],
      synonyms: ["report card generation"],
      related_terms: ["grades"],
      priority: "normal" as const,
    };

    const dup = checkQuestionDuplicates(draft.question, [reportCardsEntry], {
      category: draft.category,
    });

    assert.ok(
      dup.nearDuplicateMatch || (dup.similar[0]?.similarity ?? 0) >= 0.72,
      "should detect near-duplicate of existing lesson"
    );

    const prereq = resolvePrerequisite("How do report cards work?", [reportCardsEntry]);
    assert.equal(prereq.completed, true);

    assert.equal(isKnowledgeCovered(draft.question, [reportCardsEntry]), true);
  });
});
