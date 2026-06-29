import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeSectionBlock,
  formatGeneratedDraft,
  normalizeDocumentationDraft,
  normalizeListLines,
  polishDocumentationDraft,
  validateDocumentationFormatting,
} from "@/lib/ai-author/draft-formatter";
import { autoFixProfessionalLanguage } from "@/lib/ai-training/knowledge-language-improver";
import { renderAudienceMarkdown, buildAudienceComposition } from "@/lib/ai-author/audience-template";
import type { ScoredFact } from "@/lib/ai-author/types";

describe("draft-formatter", () => {
  it("preserves blank lines between sections", () => {
    const input = "Overview\n\nFirst paragraph.\n\nPurpose\n\nSecond paragraph.";
    const output = normalizeDocumentationDraft(input);
    assert.match(output, /Overview\n\nFirst paragraph\.\n\nPurpose\n\nSecond paragraph\./);
  });

  it("does not collapse newlines during professional language polish", () => {
    const input = [
      "Overview",
      "",
      "Adakaro is a modern platform.",
      "",
      "Suitable for",
      "",
      "• Teachers",
      "• Parents",
    ].join("\n");

    const polished = autoFixProfessionalLanguage(input);
    assert.match(polished, /Overview\n\nAdakaro is a modern platform\.\n\nSuitable for/);
    assert.match(polished, /• Teachers\n• Parents/);
  });

  it("splits inline bullet walls into vertical lists", () => {
    const input = "It is suitable for: • Teachers • Parents • Students";
    const output = normalizeListLines(input);
    assert.match(output, /• Teachers/);
    assert.match(output, /• Parents/);
    assert.match(output, /• Students/);
    assert.doesNotMatch(output, /Teachers • Parents/);
  });

  it("composes section blocks with heading spacing", () => {
    const block = composeSectionBlock("Overview", "Adakaro is a school platform.");
    assert.equal(block, "Overview\n\nAdakaro is a school platform.");
  });

  it("formats audience drafts with structured sections", () => {
    const facts: ScoredFact[] = [
      {
        id: "f1",
        text: "Adakaro is a cloud-based school management platform.",
        sourceEntryId: "1",
        sourceQuestion: "What is Adakaro?",
        relevanceScore: 80,
        entity: "Adakaro",
        intent: "identity",
        evidence: "published",
      },
      {
        id: "f2",
        text: "Teachers manage classes.",
        sourceEntryId: "1",
        sourceQuestion: "What is Adakaro?",
        relevanceScore: 70,
        entity: "Teachers",
        intent: "identity",
        evidence: "published",
      },
      {
        id: "f3",
        text: "Parents use the portal.",
        sourceEntryId: "1",
        sourceQuestion: "What is Adakaro?",
        relevanceScore: 70,
        entity: "Parents",
        intent: "identity",
        evidence: "published",
      },
    ];

    const composition = buildAudienceComposition(facts);
    const draft = formatGeneratedDraft(renderAudienceMarkdown(composition));

    assert.match(draft, /^Overview\n\n/m);
    assert.match(draft, /\n\nSuitable for\n\n/m);
    assert.match(draft, /• Teachers\n• Parents/);
    assert.doesNotMatch(draft, /Adakaro is designed for schools.*Adakaro is/);
  });

  it("validates multiline list formatting", () => {
    const good = "Overview\n\nText.\n\nSuitable for\n\n• Teachers\n• Parents";
    const bad = "Overview\n\nText. • Teachers • Parents";

    assert.equal(validateDocumentationFormatting(good).valid, true);
    assert.equal(validateDocumentationFormatting(bad).valid, false);
  });

  it("caps excessive blank lines to two empty lines", () => {
    const input = "Overview\n\n\n\nBody";
    assert.equal(normalizeDocumentationDraft(input), "Overview\n\n\nBody");
  });

  it("polishes documentation without merging sections", () => {
    const input = "Overview\n\nAdakaro is great.\n\nBenefits\n\n• Faster administration";
    const output = polishDocumentationDraft(input);
    assert.match(output, /Overview\n\n/);
    assert.match(output, /Benefits\n\n• Faster administration/);
  });
});
