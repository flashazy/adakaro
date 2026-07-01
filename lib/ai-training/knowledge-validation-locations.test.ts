import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyWordSuggestionToSentence,
  locatePhraseInAnswer,
  parseAnswerSentences,
  replaceSentenceAtLocation,
} from "@/lib/ai-training/knowledge-validation-locations";

describe("knowledge-validation-locations", () => {
  const sample = [
    "**Overview**",
    "Adakaro is a school management platform.",
    "",
    "**Notes**",
    "Always use the latest import template.",
    "- Use CSV format for bulk imports",
  ].join("\n");

  it("parses sections and sentences with char offsets", () => {
    const sentences = parseAnswerSentences(sample);
    const notesSentence = sentences.find((s) => s.text.includes("latest import"));
    assert.ok(notesSentence);
    assert.equal(notesSentence.sectionTitle, "Notes");
    assert.equal(notesSentence.paragraphIndex, 0);
  });

  it("locates phrases in answer sections", () => {
    const location = locatePhraseInAnswer(sample, "latest");
    assert.ok(location);
    assert.equal(location.field, "Notes");
    assert.equal(location.section, "Answer");
  });

  it("replaces only the targeted sentence", () => {
    const location = locatePhraseInAnswer(sample, "Always use the latest import template.");
    assert.ok(location);
    const replacement = "Use the official Adakaro import template to ensure the file format is correct.";
    const next = replaceSentenceAtLocation(sample, location, replacement);
    assert.ok(next.includes(replacement));
    assert.ok(!next.includes("latest import template"));
    assert.ok(next.includes("**Overview**"));
    assert.ok(next.includes("CSV format"));
  });

  it("applies word-level suggestions to sentences", () => {
    const result = applyWordSuggestionToSentence(
      "Always use the latest import template.",
      "latest",
      "official"
    );
    assert.ok(result.includes("official"));
    assert.ok(!result.includes("latest"));
  });
});
