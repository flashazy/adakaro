import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKnowledgeWritingStandardMarkdown,
  buildRecommendedAnswerTemplate,
  KNOWLEDGE_WRITING_STANDARD_VERSION,
  validateKnowledgeWritingStandard,
} from "@/lib/ai-training/knowledge-writing-standard";

const goodDraft = {
  category: "General",
  question: "What is Adakaro?",
  answer: [
    "**Overview**",
    "Adakaro is a school management platform.",
    "",
    "**Core Facts**",
    "- Supports student enrollment",
    "- Provides attendance tracking",
    "- Enables report cards",
    "",
    "**Key Capabilities**",
    "- Parent Portal",
    "- School Finance",
  ].join("\n"),
  keywords: ["adakaro", "school", "platform"],
  search_phrases: ["what is adakaro"],
  alternative_wording: ["tell me about adakaro"],
  synonyms: ["school software"],
  related_terms: ["school management"],
  priority: "normal",
};

describe("knowledge writing standard", () => {
  it("exports version 1.0", () => {
    assert.equal(KNOWLEDGE_WRITING_STANDARD_VERSION, "1.0.0");
  });

  it("builds full markdown guide", () => {
    const md = buildKnowledgeWritingStandardMarkdown();
    assert.ok(md.includes("Rule 1 — One Intent Per Entry"));
    assert.ok(md.includes("Mission Statement"));
  });

  it("passes a well-formed entry checklist", () => {
    const result = validateKnowledgeWritingStandard(goodDraft);
    assert.equal(result.requiredPassed, true);
    assert.equal(result.issues.length, 0);
  });

  it("flags conversational phrasing in answers", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: "I'd be happy to help! Adakaro is a platform.",
    });
    assert.ok(result.issues.some((i) => i.includes("conversational")));
    assert.equal(
      result.checklist.find((c) => c.id === "facts-not-conversation")?.passed,
      false
    );
  });

  it("flags multi-intent questions", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      question: "What is Adakaro and how much does it cost?",
    });
    assert.ok(result.issues.some((i) => i.includes("multiple intents")));
  });

  it("classifies different-intent pairs as separate entries guidance", () => {
    const identity = validateKnowledgeWritingStandard({
      ...goodDraft,
      question: "What is Adakaro?",
    });
    const capabilities = validateKnowledgeWritingStandard({
      ...goodDraft,
      question: "What can Adakaro do?",
      answer: goodDraft.answer.replace("school management platform", "school operations platform with many modules"),
    });
    assert.equal(identity.requiredPassed, true);
    assert.equal(capabilities.requiredPassed, true);
  });

  it("provides a recommended answer template", () => {
    const template = buildRecommendedAnswerTemplate("What is Adakaro?");
    assert.ok(template.includes("**Overview**"));
    assert.ok(template.includes("**Core Facts**"));
  });
});
