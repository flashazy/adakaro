import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessEnterpriseReadiness,
  fixAllQualityIssues,
  buildPostSaveRecommendations,
} from "@/lib/ai-training/knowledge-authoring";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

const baseDraft = {
  category: "General",
  question: "What is Adakaro?",
  answer: [
    "**Overview**",
    "Adakaro is a school management platform for African schools.",
    "",
    "**Core Facts**",
    "- Supports student enrollment and attendance",
    "- Provides report cards and parent communication",
    "- Enables school finance and staff management",
  ].join("\n"),
  keywords: ["adakaro", "school", "platform", "management"],
  search_phrases: ["what is adakaro", "how does adakaro work"],
  alternative_wording: ["Tell me what Adakaro is?"],
  synonyms: ["school software", "education platform"],
  related_terms: ["School Management System", "Student Information System"],
  priority: "normal",
};

function entry(overrides: Partial<AIKnowledgeEntry>): AIKnowledgeEntry {
  return {
    id: "e1",
    question: "What is Adakaro?",
    answer: "Overview",
    category: "General",
    status: "active",
    priority: "normal",
    keywords: [],
    search_phrases: [],
    alternative_wording: [],
    synonyms: [],
    related_terms: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as AIKnowledgeEntry;
}

describe("knowledge authoring", () => {
  it("passes enterprise readiness when metadata is synced", () => {
    const result = assessEnterpriseReadiness({
      draft: baseDraft,
      metadataBaseline: { question: baseDraft.question, answer: baseDraft.answer },
      allEntries: [entry({ id: "e1", question: baseDraft.question })],
    });
    assert.equal(result.metadataValid, true);
    assert.ok(result.checks.find((c) => c.id === "metadata-synced")?.passed);
  });

  it("blocks save when metadata is outdated", () => {
    const result = assessEnterpriseReadiness({
      draft: { ...baseDraft, answer: baseDraft.answer + " Updated." },
      metadataBaseline: { question: baseDraft.question, answer: baseDraft.answer },
    });
    assert.equal(result.ready, false);
    assert.ok(result.blockers.some((b) => b.includes("Metadata matches")));
  });

  it("flags marketing language in professional check", () => {
    const result = assessEnterpriseReadiness({
      draft: {
        ...baseDraft,
        answer: baseDraft.answer.replace("platform", "amazing platform"),
      },
      metadataBaseline: { question: baseDraft.question, answer: baseDraft.answer },
    });
    const prof = result.writingValidation.checklist.find((c) => c.id === "professional-language");
    assert.equal(prof?.passed, false);
    assert.ok((prof?.detectedWords ?? []).includes("amazing"));
  });

  it("fixAllQualityIssues produces valid metadata", () => {
    const result = fixAllQualityIssues({
      category: "General",
      question: "How do I get started with Adakaro?",
      answer:
        "Getting started is easy and seamless. Currently you can sign up today for the best experience.",
    });
    assert.ok(result.metadata.keywords.length >= 3);
    assert.ok(!/amazing|currently|today|\bbest\b/i.test(result.answer));
    assert.ok(result.iterations >= 1);
  });

  it("recommends follow-up lessons after saving identity entry", () => {
    const saved = entry({ id: "saved", question: "What is Adakaro?" });
    const recs = buildPostSaveRecommendations(saved, [saved]);
    assert.ok(recs.length > 0);
    assert.ok(recs.some((r) => r.question.includes("cost") || r.question.includes("started")));
  });

  it("deduplicates post-save recommendations by normalized lesson question", () => {
    const saved = entry({ id: "saved", question: "What is Adakaro?" });
    const recs = buildPostSaveRecommendations(saved, [saved]);
    const seen = new Set<string>();

    for (const rec of recs) {
      const key = rec.question
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      assert.ok(!seen.has(key), `duplicate recommendation: ${rec.question}`);
      seen.add(key);
    }

    const whyChoose = recs.find((rec) =>
      rec.question.toLowerCase().includes("why choose adakaro")
    );
    if (whyChoose) {
      assert.equal(
        recs.filter((rec) =>
          rec.question.toLowerCase().includes("why choose adakaro")
        ).length,
        1
      );
    }
  });
});
