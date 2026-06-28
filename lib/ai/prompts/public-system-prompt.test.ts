import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublicSystemPromptBody,
  buildRetrievedKnowledgeAppendix,
  PUBLIC_SYSTEM_PROMPT_META,
  PUBLIC_SYSTEM_PROMPT_VERSION,
} from "@/lib/ai/prompts/public-system-prompt";
import { buildPublicSystemPrompt } from "@/lib/ai/prompts/system-prompts";

describe("public system prompt", () => {
  it("exports a stable version and metadata", () => {
    assert.match(PUBLIC_SYSTEM_PROMPT_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(PUBLIC_SYSTEM_PROMPT_META.scope, "public");
    assert.equal(PUBLIC_SYSTEM_PROMPT_META.id, "public-global-system-prompt");
  });

  it("defines consultant role and conversation rules", () => {
    const body = buildPublicSystemPromptBody();
    assert.ok(body.includes("school management consultant"));
    assert.ok(body.includes("Never copy long knowledge entries verbatim"));
    assert.ok(body.includes("First sentence rule"));
    assert.ok(body.includes("I don't have enough information"));
  });

  it("includes answer length guidance", () => {
    const body = buildPublicSystemPromptBody();
    assert.ok(body.includes("80–180 words"));
    assert.ok(body.includes("150–250 words"));
  });

  it("appends retrieved knowledge separately from personality rules", () => {
    const appendix = buildRetrievedKnowledgeAppendix({
      question: "What is Adakaro?",
      answer: "Adakaro is a school management platform.",
      category: "General",
      keywords: ["adakaro", "school"],
    });
    assert.ok(appendix.includes("rewrite, do not copy verbatim"));
    assert.ok(appendix.includes("Adakaro is a school management platform"));

    const full = buildPublicSystemPrompt({
      retrievedKnowledge: {
        question: "What is Adakaro?",
        answer: "Adakaro is a school management platform.",
        category: "General",
        keywords: ["adakaro"],
      },
      includeReferenceKnowledge: false,
    });
    assert.ok(full.includes("school management consultant"));
    assert.ok(full.includes("Retrieved knowledge"));
    assert.ok(!full.includes("Reference knowledge"));
  });

  it("uses reference knowledge only when no retrieved entry is provided", () => {
    const withReference = buildPublicSystemPrompt();
    assert.ok(withReference.includes("Reference knowledge"));
    assert.ok(withReference.includes("Adakaro Platform Knowledge"));
  });
});
