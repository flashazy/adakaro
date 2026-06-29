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
    assert.ok(result.issues.some((i) => i.includes("Facts, not conversation")));
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

  it("allows neutral documentation language", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: [
        "**Overview**",
        "Adakaro is designed to support school management.",
        "",
        "**Capabilities**",
        "- Includes attendance and report cards",
        "- Provides role-based access for authorized users",
        "- Allows administrators to configure the platform",
        "- Accessible through the web system",
      ].join("\n"),
    });
    const prof = result.checklist.find((c) => c.id === "professional-language");
    const timeless = result.checklist.find((c) => c.id === "timeless");
    assert.equal(prof?.passed, true);
    assert.equal(timeless?.passed, true);
  });

  it("flags genuine marketing language with exact context", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: goodDraft.answer.replace(
        "school management platform",
        "the best school management platform"
      ),
    });
    const prof = result.checklist.find((c) => c.id === "professional-language");
    assert.equal(prof?.passed, false);
    const failure = result.failures.find((f) => f.ruleId === "professional-language");
    assert.ok(failure);
    assert.equal(failure.word.toLowerCase(), "best");
    assert.ok(failure.sentence.includes("best"));
    assert.ok(failure.reason.length > 0);
    assert.ok(result.issues[0]?.includes("best"));
  });

  it("does not flag best practices as marketing", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: goodDraft.answer + "\n\nFollow enrollment best practices when importing students.",
    });
    assert.equal(
      result.checklist.find((c) => c.id === "professional-language")?.passed,
      true
    );
  });

  it("flags temporal references only", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: goodDraft.answer + "\n\nThis feature is currently available today.",
    });
    assert.equal(result.checklist.find((c) => c.id === "timeless")?.passed, false);
    assert.ok(result.failures.some((f) => f.ruleId === "timeless" && f.word.toLowerCase().includes("currently")));
  });

  it("detects semantic structure without fixed headings", () => {
    const result = validateKnowledgeWritingStandard({
      ...goodDraft,
      answer: [
        "**Purpose**",
        "Explain deployment for school administrators.",
        "",
        "**Permissions**",
        "- Authorized users can access modules",
        "- Role-based access controls visibility",
        "",
        "**Notes**",
        "- Additional configuration may be required",
      ].join("\n"),
    });
    assert.equal(result.checklist.find((c) => c.id === "structured-answer")?.passed, true);
  });
});
