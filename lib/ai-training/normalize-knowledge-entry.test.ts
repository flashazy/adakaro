import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeKnowledgeEntry, resolveDisplayHealth } from "@/lib/ai-training/normalize-knowledge-entry";

describe("normalizeKnowledgeEntry", () => {
  it("keeps answer when present", () => {
    const entry = normalizeKnowledgeEntry({
      id: "1",
      question: "What is Adakaro?",
      answer: "**Overview**\n\nAdakaro is a school platform.",
      keywords: ["adakaro"],
      search_phrases: [],
      alternative_wording: [],
      synonyms: [],
      related_terms: [],
      category: "General",
      priority: "normal",
    });
    assert.ok(entry.answer.includes("school platform"));
  });

  it("falls back to proposed_answer when answer missing", () => {
    const entry = normalizeKnowledgeEntry({
      id: "1",
      question: "Q",
      proposed_answer: "Stored proposed answer body",
      keywords: [],
      search_phrases: [],
      alternative_wording: [],
      synonyms: [],
      related_terms: [],
      category: "General",
      priority: "normal",
    });
    assert.equal(entry.answer, "Stored proposed answer body");
  });

  it("defaults to empty string when no answer-like field exists", () => {
    const entry = normalizeKnowledgeEntry({
      id: "1",
      question: "Q",
      keywords: [],
      search_phrases: [],
      alternative_wording: [],
      synonyms: [],
      related_terms: [],
      category: "General",
      priority: "normal",
    });
    assert.equal(entry.answer, "");
  });

  it("overrides stale needs_review when quality is excellent", () => {
    const entry = normalizeKnowledgeEntry({
      id: "1",
      question: "What is Adakaro?",
      answer:
        "**Overview**\nAdakaro is a school management platform that helps schools run enrollment, attendance, academics, and parent communication in one place.\n\n**Core Facts**\n- Enrollment\n- Attendance\n- Report cards",
      keywords: ["adakaro", "school", "platform", "enrollment", "attendance", "reports"],
      search_phrases: ["what is adakaro", "adakaro overview", "adakaro platform"],
      alternative_wording: ["Tell me about Adakaro?", "What does Adakaro do?"],
      synonyms: ["school software", "education platform", "school system"],
      related_terms: ["School Management", "Student Records", "Education Technology"],
      category: "General",
      priority: "normal",
      usage_count: 12,
      health_status: "needs_review",
    });
    assert.equal(resolveDisplayHealth(entry), "healthy");
  });
});
