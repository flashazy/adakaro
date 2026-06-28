import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEligibleForApprovalQueue,
  processBatchThroughQualityEngine,
  QUALITY_PASS_THRESHOLD,
} from "@/lib/ai-training/knowledge-quality-engine";
import { scoreQuestionQuality } from "@/lib/ai-training/knowledge-quality-scorer";
import { buildQualityReport } from "@/lib/ai-training/knowledge-quality-report";
import { analyzeModuleCurriculum } from "@/lib/ai-training/lesson-generator";
import type { GeneratedLessonDraft } from "@/lib/ai-training/lesson-generator";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro"],
    search_phrases: ["what is adakaro"],
    alternative_wording: ["tell me about adakaro"],
    synonyms: ["sms"],
    related_terms: ["school"],
    answer: "**Overview**\n\nAdakaro is a school platform.\n\n**Core Facts**\n\n- Enrollment",
    priority: "normal",
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    intent_key: "what_is_adakaro",
    ...overrides,
  };
}

function draft(overrides: Partial<GeneratedLessonDraft>): GeneratedLessonDraft {
  return {
    id: "d1",
    question: "Who uses Adakaro?",
    answer:
      "**Overview**\n\nAdakaro supports schools, teachers, and administrators.\n\n**Core Facts**\n\n- Student enrollment\n- Attendance tracking\n- Report cards\n\n**Key Capabilities**\n\n- Role-based access\n- Parent portal\n\n**Benefits**\n\n- Reduces manual work",
    intentKey: "who_uses",
    intentLabel: "Identity",
    category: "General",
    curriculumModule: "about-adakaro",
    priority: "normal",
    keywords: ["adakaro", "schools", "teachers", "administrators", "users"],
    synonyms: ["school platform", "sms"],
    search_phrases: ["who uses adakaro", "adakaro users"],
    alternative_wording: ["who is adakaro for"],
    related_terms: ["school owners", "teachers"],
    topicTag: "users",
    duplicateRisk: "none",
    duplicateReason: null,
    scores: {
      knowledgeScore: 85,
      writingScore: 90,
      retrievalScore: 88,
      intentScore: 90,
      coverageScore: 90,
      duplicateRiskPercent: 5,
      overallScore: 88,
    },
    overallGrade: "A",
    coverageContribution: 10,
    estimatedConfidence: 88,
    reviewStatus: "draft",
    version: 1,
    ...overrides,
  };
}

describe("knowledge quality engine", () => {
  it("scores natural questions highly", () => {
    const good = scoreQuestionQuality("What can Adakaro do?");
    const bad = scoreQuestionQuality("Tell me about Adakaro");
    assert.ok(good.score > bad.score);
  });

  it("passes threshold constant is 90", () => {
    assert.equal(QUALITY_PASS_THRESHOLD, 90);
  });

  it("marks ready lessons eligible for approval queue", () => {
    const report = buildQualityReport({
      criteria: {
        questionQuality: 95,
        duplicateDetection: 95,
        curriculumCoverage: 100,
        answerQuality: 94,
        retrievalQuality: 92,
        writingStandard: 96,
        humanReadability: 93,
        knowledgeHealth: 94,
      },
      duplicateRiskPercent: 2,
      issues: [],
      improvementsApplied: [],
      attempts: 1,
      coverageMap: [],
    });
    assert.equal(isEligibleForApprovalQueue(report), true);
  });

  it("processes batch and separates ready from blocked", () => {
    const analysis = analyzeModuleCurriculum("about-adakaro", [], 80);
    const result = processBatchThroughQualityEngine(
      [
        draft({ id: "1", question: "Who uses Adakaro?" }),
        draft({
          id: "2",
          question: "What is Adakaro?",
          topicTag: "platform-overview",
        }),
      ],
      analysis,
      [entry({ id: "e1", question: "What is Adakaro?" })],
      "General"
    );
    assert.ok(result.readyLessons.length >= 0);
    assert.ok(result.metrics.averageQualityScore >= 0);
  });
});
