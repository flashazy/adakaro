import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEligibleForApprovalQueue,
  processBatchThroughQualityEngine,
  QUALITY_PASS_THRESHOLD,
} from "@/lib/ai-training/knowledge-quality-engine";
import {
  scoreDuplicateDetection,
  scoreLessonDraft,
  scoreQuestionQuality,
} from "@/lib/ai-training/knowledge-quality-scorer";
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

const CURRICULUM_QUESTIONS = [
  "Why choose Adakaro?",
  "Why was Adakaro created?",
  "What makes Adakaro different?",
  "Is Adakaro cloud based?",
  "Can Adakaro scale to large schools?",
  "How secure is Adakaro?",
];

describe("knowledge quality engine", () => {
  it("scores natural questions highly", () => {
    const good = scoreQuestionQuality("What can Adakaro do?");
    const bad = scoreQuestionQuality("Tell me about Adakaro");
    assert.ok(good.score > bad.score);
    assert.ok(good.score >= 90);
  });

  it("does not penalize short useful curriculum questions", () => {
    for (const question of CURRICULUM_QUESTIONS) {
      const result = scoreQuestionQuality(question);
      assert.ok(
        result.score >= 88,
        `"${question}" scored ${result.score}, expected >= 88`
      );
    }
  });

  it("treats different-intent questions as non-duplicates", () => {
    const batch = CURRICULUM_QUESTIONS.map((question, i) => ({
      question,
      intentLabel: `Intent ${i}`,
    }));
    for (const question of CURRICULUM_QUESTIONS) {
      const result = scoreDuplicateDetection(
        { question, intentLabel: question },
        [],
        batch.filter((b) => b.question !== question)
      );
      assert.ok(
        result.score >= 85,
        `"${question}" duplicate score ${result.score}, expected >= 85`
      );
    }
  });

  it("includes explainable score breakdown", () => {
    const analysis = analyzeModuleCurriculum("about-adakaro", [], 80);
    const report = scoreLessonDraft(draft({ question: "Why choose Adakaro?" }), {
      existingEntries: [],
      batchDrafts: [],
      analysis,
      coveredConcepts: new Set(),
    });
    assert.ok(report.breakdown.length === 8);
    assert.ok(report.breakdown.every((b) => b.max > 0 && b.earned >= 0));
    assert.equal(
      Math.round(report.breakdown.reduce((s, b) => s + b.earned, 0)),
      report.overallQuality
    );
    assert.ok(report.reviewerConfidence >= 70);
  });

  it("passes threshold constant is 90", () => {
    assert.equal(QUALITY_PASS_THRESHOLD, 90);
  });

  it("marks high-confidence ready lessons eligible for approval queue", () => {
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
    assert.equal(report.overallQuality, 95);
    assert.equal(isEligibleForApprovalQueue(report), true);
  });

  it("scores good curriculum drafts above 90", () => {
    const analysis = analyzeModuleCurriculum("about-adakaro", [], 80);
    const questions = [
      { question: "Why choose Adakaro?", topicTag: "benefits", intentLabel: "Benefits" },
      { question: "Why was Adakaro created?", topicTag: "origin", intentLabel: "History" },
      { question: "What makes Adakaro different?", topicTag: "differentiation", intentLabel: "Benefits" },
      { question: "Is Adakaro cloud based?", topicTag: "cloud", intentLabel: "Technology" },
      { question: "Can Adakaro scale to large schools?", topicTag: "scale", intentLabel: "Deployment" },
      { question: "How secure is Adakaro?", topicTag: "security", intentLabel: "Security" },
    ];

    let passCount = 0;
    for (const q of questions) {
      const report = scoreLessonDraft(
        draft({
          id: q.question,
          question: q.question,
          topicTag: q.topicTag,
          intentLabel: q.intentLabel,
        }),
        {
          existingEntries: [],
          batchDrafts: questions.filter((x) => x.question !== q.question),
          analysis,
          coveredConcepts: new Set(),
        }
      );
      if (report.overallQuality >= 90) passCount++;
    }
    assert.ok(passCount >= 5, `Only ${passCount}/6 curriculum drafts scored >= 90`);
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
    assert.ok(result.metrics.averageQualityScore >= 0);
    assert.ok(typeof result.metrics.highestScore === "number");
    assert.ok(typeof result.metrics.lowestScore === "number");
  });
});
