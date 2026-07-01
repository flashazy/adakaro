import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAlternativeWordingRelation,
  suggestShorterSearchPhrases,
  validateAlternativeWordingItem,
  validateMetadataDraft,
  validateSearchPhrase,
} from "@/lib/ai-training/knowledge-metadata-validator";

describe("validateSearchPhrase", () => {
  it("accepts realistic lowercase noun-phrase searches", () => {
    for (const phrase of [
      "finance module",
      "student payment management",
      "fee management system",
      "bulk import students",
      "what is adakaro",
    ]) {
      assert.equal(validateSearchPhrase(phrase).valid, true, phrase);
    }
  });

  it("accepts natural long-form search queries up to 8 words", () => {
    for (const phrase of [
      "request demo",
      "book demo",
      "how do i request a demo",
      "where can i request a demo",
      "how do parents download report cards",
      "how do teachers enter grades",
      "can report cards be exported",
      "view attendance report",
      "student fee balance",
      "school finance report",
    ]) {
      const result = validateSearchPhrase(phrase);
      assert.equal(result.valid, true, `${phrase}: ${result.error ?? ""}`);
    }
  });

  it("rejects uppercase, punctuation, and overly long phrases", () => {
    assert.equal(validateSearchPhrase("Finance Module").valid, false);
    assert.equal(validateSearchPhrase("fee-management").valid, false);
    assert.equal(
      validateSearchPhrase("how do i import students in bulk today for my school").valid,
      false
    );
  });

  it("provides shorter suggestions for long phrases", () => {
    const result = validateSearchPhrase("how do i import students in bulk today for my school");
    assert.equal(result.valid, false);
    assert.ok((result.suggestions?.length ?? 0) >= 1);
    assert.ok(result.error?.includes("longer than recommended"));
  });

  it("rejects stopword-only phrases", () => {
    assert.equal(validateSearchPhrase("how to").valid, false);
    assert.equal(validateSearchPhrase("is it").valid, false);
  });

  it("suggests compact variants", () => {
    const suggestions = suggestShorterSearchPhrases("how do i request a demo");
    assert.ok(suggestions.includes("request demo") || suggestions.includes("request a demo"));
  });
});

describe("validateAlternativeWordingItem", () => {
  const original = "How do I request a demo?";

  it("accepts equivalent demo-request paraphrases", () => {
    for (const alt of [
      "How can I request a demo?",
      "Where do I request a demo?",
      "How do schools request a demo?",
    ]) {
      const result = validateAlternativeWordingItem(original, alt);
      assert.equal(result.valid, true, `${alt}: ${result.error ?? ""}`);
      assert.notEqual(
        classifyAlternativeWordingRelation(original, alt),
        "different_intent",
        alt
      );
    }
  });

  it("rejects alternatives that change lesson intent", () => {
    const result = validateAlternativeWordingItem(
      original,
      "How much does Adakaro cost?"
    );
    assert.equal(result.valid, false);
    assert.equal(classifyAlternativeWordingRelation(original, "How much does Adakaro cost?"), "different_intent");
  });
});

describe("validateMetadataDraft search phrases", () => {
  const base = {
    keywords: ["finance", "fees", "payments"],
    synonyms: ["school finance"],
    search_phrases: [
      "finance module",
      "student payment management",
      "fee management system",
    ],
    alternative_wording: ["How does finance work?"],
    related_terms: ["School Finance"],
  };

  it("does not flag valid user-entered search phrases", () => {
    const result = validateMetadataDraft(base, "How does school finance work?");
    assert.equal(result.fieldErrors.search_phrases, undefined);
  });

  it("accepts demo request metadata", () => {
    const result = validateMetadataDraft(
      {
        ...base,
        search_phrases: ["how do i request a demo", "book demo", "request demo"],
        alternative_wording: [
          "How can I request a demo?",
          "Where do I request a demo?",
        ],
      },
      "How do I request a demo?"
    );
    assert.equal(result.valid, true, JSON.stringify(result.fieldErrors));
  });

  it("reports duplicate search phrases", () => {
    const result = validateMetadataDraft(
      {
        ...base,
        search_phrases: ["finance module", "finance module"],
      },
      "How does school finance work?"
    );
    assert.ok(result.fieldErrors.search_phrases?.some((msg) => msg.includes("Duplicate")));
  });

  it("never requires specific example phrases", () => {
    const result = validateMetadataDraft(
      {
        ...base,
        search_phrases: ["attendance tracking", "parent portal access"],
      },
      "How does attendance work?"
    );
    assert.equal(result.fieldErrors.search_phrases, undefined);
    assert.ok(
      !JSON.stringify(result.fieldErrors).includes("finance module"),
      "should not reference hardcoded examples"
    );
  });
});
