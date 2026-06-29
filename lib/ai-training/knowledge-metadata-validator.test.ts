import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("rejects uppercase, punctuation, and long phrases", () => {
    assert.equal(validateSearchPhrase("Finance Module").valid, false);
    assert.equal(validateSearchPhrase("fee-management").valid, false);
    assert.equal(validateSearchPhrase("how do i import students in bulk today").valid, false);
  });

  it("rejects stopword-only phrases", () => {
    assert.equal(validateSearchPhrase("how to").valid, false);
    assert.equal(validateSearchPhrase("is it").valid, false);
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
