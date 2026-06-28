import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePendingByModule,
  computeQueueSummary,
  evaluatePublishDuplicate,
  gradeFromQualityScore,
  mapGeneratedLessonToQueueInsert,
} from "@/lib/ai-training/knowledge-approval-queue";
import type { AIKnowledgeApprovalQueueItem, AIKnowledgeEntry } from "@/lib/ai-training/types";

function queueItem(
  overrides: Partial<AIKnowledgeApprovalQueueItem> & Pick<AIKnowledgeApprovalQueueItem, "id">
): AIKnowledgeApprovalQueueItem {
  return {
    proposed_question: "What is Adakaro?",
    proposed_answer: "Overview\n\nAdakaro is a school platform.",
    proposed_category: "General",
    proposed_priority: "normal",
    proposed_keywords: ["adakaro"],
    proposed_synonyms: [],
    proposed_search_phrases: [],
    proposed_alternative_wording: [],
    proposed_related_terms: [],
    proposed_intent_key: "what_is_adakaro",
    proposed_intent_name: "Identity",
    proposed_intent_group: null,
    proposed_curriculum_module: "about-adakaro",
    source_type: "ai_lesson_generator",
    source_metadata: {},
    quality_score: 85,
    duplicate_risk: "none",
    coverage_score: 80,
    approval_status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("knowledge approval queue", () => {
  it("maps generated lessons to queue inserts", () => {
    const row = mapGeneratedLessonToQueueInsert({
      id: "draft-1",
      question: "Who uses Adakaro?",
      answer: "**Overview**\n\nSchools use Adakaro.",
      intentKey: "who_uses",
      intentLabel: "Identity",
      category: "General",
      curriculumModule: "about-adakaro",
      priority: "normal",
      keywords: ["adakaro", "schools"],
      synonyms: [],
      search_phrases: [],
      alternative_wording: [],
      related_terms: [],
      topicTag: "users",
      duplicateRisk: "low",
      duplicateReason: null,
      scores: {
        knowledgeScore: 80,
        writingScore: 85,
        retrievalScore: 75,
        intentScore: 90,
        coverageScore: 80,
        duplicateRiskPercent: 10,
        overallScore: 82,
      },
      overallGrade: "B",
      coverageContribution: 8,
      estimatedConfidence: 85,
      reviewStatus: "draft",
      version: 1,
    });

    assert.equal(row.proposed_question, "Who uses Adakaro?");
    assert.equal(row.approval_status, "pending");
    assert.equal(row.duplicate_risk, "low");
  });

  it("computes queue summary counts", () => {
    const summary = computeQueueSummary([
      queueItem({ id: "1", approval_status: "pending" }),
      queueItem({ id: "2", approval_status: "approved" }),
      queueItem({ id: "3", approval_status: "published" }),
      queueItem({ id: "4", approval_status: "rejected" }),
      queueItem({ id: "5", approval_status: "edited" }),
    ]);
    assert.equal(summary.pending, 1);
    assert.equal(summary.approved, 1);
    assert.equal(summary.published, 1);
    assert.equal(summary.rejected, 1);
    assert.equal(summary.total, 5);
  });

  it("computes pending counts by module", () => {
    const counts = computePendingByModule([
      queueItem({ id: "1", proposed_curriculum_module: "about-adakaro" }),
      queueItem({ id: "2", proposed_curriculum_module: "about-adakaro" }),
      queueItem({ id: "3", proposed_curriculum_module: "pricing", approval_status: "published" }),
    ]);
    assert.equal(counts["about-adakaro"], 2);
    assert.equal(counts.pricing, undefined);
  });

  it("evaluates publish duplicate outcomes", () => {
    const existing: AIKnowledgeEntry[] = [
      {
        id: "e1",
        category: "General",
        question: "What is Adakaro?",
        keywords: [],
        search_phrases: [],
        alternative_wording: [],
        synonyms: [],
        related_terms: [],
        answer: "Adakaro is a platform.",
        priority: "normal",
        usage_count: 0,
        last_used_at: null,
        status: "active",
        created_by: null,
        created_at: "",
        updated_at: "",
      },
    ];

    assert.equal(
      evaluatePublishDuplicate("What is Adakaro?", "General", existing),
      "blocked"
    );
    assert.equal(
      evaluatePublishDuplicate("Who uses Adakaro?", "General", existing),
      "safe"
    );
  });

  it("maps quality score to grade", () => {
    assert.equal(gradeFromQualityScore(96), "A+");
    assert.equal(gradeFromQualityScore(70), "C");
  });
});
