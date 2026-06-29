import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasSemanticStructure, detectSemanticSections } from "@/lib/ai-training/knowledge-answer-structure";

describe("knowledge answer structure", () => {
  it("detects markdown and plain section titles", () => {
    const answer = [
      "**Purpose**",
      "Summary text here.",
      "",
      "Deployment",
      "- Step one",
      "- Step two",
    ].join("\n");
    const sections = detectSemanticSections(answer);
    assert.ok(sections.length >= 2);
    assert.ok(hasSemanticStructure(answer));
  });

  it("passes short answers without sections", () => {
    assert.equal(hasSemanticStructure("Short answer."), true);
  });
});
