import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeKnowledgeEntry } from "@/lib/ai-training/normalize-knowledge-entry";

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
});
