import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKnowledgeMetadataSync } from "@/lib/ai-training/knowledge-metadata-generator";

describe("knowledge-metadata-generator", () => {
  const input = {
    category: "Getting Started",
    question: "How do I get started with Adakaro?",
    answer: `**Overview**

Adakaro helps schools manage students, attendance, and finance.

**Key Capabilities**
- Student enrollment
- Attendance tracking
- Parent portal access`,
  };

  it("generates structured metadata without sentences in keywords", () => {
    const result = generateKnowledgeMetadataSync(input);

    assert.ok(result.keywords.length >= 3);
    for (const keyword of result.keywords) {
      assert.ok(!keyword.includes("."));
      assert.ok(keyword.split(/\s+/).length <= 4);
      assert.ok(keyword === keyword.toLowerCase());
    }
  });

  it("generates realistic search phrases", () => {
    const result = generateKnowledgeMetadataSync(input);

    assert.ok(result.search_phrases.length >= 2);
    for (const phrase of result.search_phrases) {
      assert.ok(phrase === phrase.toLowerCase());
      assert.ok(
        phrase.startsWith("how ") ||
          phrase.startsWith("what ") ||
          phrase.startsWith("can ") ||
          phrase.includes("adakaro")
      );
    }
  });

  it("generates alternative wording as questions", () => {
    const result = generateKnowledgeMetadataSync(input);

    assert.ok(result.alternative_wording.length >= 2);
    for (const alt of result.alternative_wording) {
      assert.ok(alt.includes("?"));
    }
  });

  it("generates related terms as concepts", () => {
    const result = generateKnowledgeMetadataSync(input);

    assert.ok(result.related_terms.length >= 2);
    assert.ok(result.related_terms.some((t) => t.includes("School")));
  });

  it("validates and reports field status", () => {
    const result = generateKnowledgeMetadataSync(input);
    assert.equal(result.generatedFrom, "question+answer");
    assert.ok(result.fieldValidation.keywords);
    assert.ok(result.fieldValidation.search_phrases);
  });
});
