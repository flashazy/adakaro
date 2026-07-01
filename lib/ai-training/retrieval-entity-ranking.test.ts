import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AIKnowledgeEntry } from "./types";
import { testKnowledgeQuery } from "./test-match";
import {
  mentionsAdakaroAi,
  normalizeRetrievalIntent,
} from "./retrieval-intent-normalizer";

function mockEntry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: [],
    search_phrases: [],
    alternative_wording: [],
    synonyms: [],
    related_terms: [],
    related_intents: [],
    intent_key: null,
    intent_name: null,
    intent_group: null,
    answer: `Answer for ${overrides.question}`,
    priority: "normal",
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ENTITY_ENTRIES: AIKnowledgeEntry[] = [
  mockEntry({
    id: "what-is",
    category: "About Adakaro",
    question: "What is Adakaro?",
    intent_key: "platform.identity",
    intent_name: "Platform Identity",
    keywords: ["adakaro", "platform", "school management", "overview"],
    search_phrases: [
      "what is adakaro",
      "tell me about adakaro",
      "explain adakaro",
      "describe adakaro",
      "overview of adakaro",
    ],
    alternative_wording: [
      "Tell me about Adakaro?",
      "Explain Adakaro?",
      "Describe Adakaro?",
      "What exactly is Adakaro?",
    ],
    synonyms: ["school management platform", "adakaro overview"],
    related_terms: ["School Management System"],
    priority: "critical",
  }),
  mockEntry({
    id: "who-ai",
    category: "AI Copilot",
    question: "Who is Adakaro AI?",
    intent_key: "ai.identity",
    intent_name: "AI Identity",
    keywords: ["adakaro ai", "ai assistant", "copilot", "assistant"],
    search_phrases: [
      "who is adakaro ai",
      "what is adakaro ai",
      "tell me about adakaro ai",
      "explain adakaro ai",
      "ai assistant in adakaro",
    ],
    alternative_wording: [
      "Tell me about Adakaro AI?",
      "Explain Adakaro AI?",
      "What is Adakaro AI?",
    ],
    synonyms: ["adakaro assistant", "school ai assistant"],
    related_terms: ["AI Copilot"],
    priority: "high",
  }),
  mockEntry({
    id: "what-can",
    category: "About Adakaro",
    question: "What can Adakaro do?",
    intent_key: "platform.capabilities",
    intent_name: "Platform Capabilities",
    keywords: ["capabilities", "features", "adakaro", "modules"],
    search_phrases: ["what can adakaro do", "adakaro features"],
    alternative_wording: ["What does Adakaro do?"],
    synonyms: ["adakaro capabilities"],
    related_terms: ["School Management"],
  }),
  mockEntry({
    id: "what-can-ai",
    category: "AI Copilot",
    question: "What can Adakaro AI do?",
    intent_key: "ai.capabilities",
    intent_name: "AI Capabilities",
    keywords: ["adakaro ai", "ai capabilities", "assistant features"],
    search_phrases: ["what can adakaro ai do"],
    alternative_wording: ["What does Adakaro AI do?"],
    synonyms: ["ai assistant capabilities"],
    related_terms: ["AI Copilot"],
  }),
  mockEntry({
    id: "getting-started",
    category: "Getting Started",
    question: "How do I get started with Adakaro?",
    intent_key: "platform.getting_started",
    intent_name: "Getting Started",
    keywords: ["getting started", "onboarding", "setup", "adakaro"],
    search_phrases: [
      "how do i get started with adakaro",
      "get started with adakaro",
    ],
    alternative_wording: ["How to start using Adakaro?"],
    synonyms: ["adakaro onboarding"],
    related_terms: ["Onboarding"],
  }),
  mockEntry({
    id: "migrate",
    category: "Onboarding",
    question: "Can I migrate data from my current system?",
    intent_key: "platform.migration",
    intent_name: "Data Migration",
    keywords: ["migrate", "migration", "import", "current system"],
    search_phrases: [
      "migrate data from my current system",
      "can i migrate data from my current system",
    ],
    alternative_wording: ["Can I move data from another system?"],
    synonyms: ["data migration"],
    related_terms: ["Onboarding"],
  }),
];

function expectMatch(query: string, expectedQuestion: string) {
  const result = testKnowledgeQuery(query, ENTITY_ENTRIES);
  assert.equal(
    result.matched,
    true,
    `expected match for "${query}" (got ${result.matchedQuestion ?? "none"} @ ${result.confidence}%)`
  );
  assert.equal(
    result.entry?.question,
    expectedQuestion,
    `query "${query}" should match "${expectedQuestion}" but got "${result.entry?.question ?? "none"}"`
  );
}

describe("retrieval intent normalizer", () => {
  it("maps broad Adakaro visitor phrases to What is Adakaro?", () => {
    for (const query of [
      "Tell me about Adakaro",
      "Explain Adakaro",
      "Describe Adakaro",
      "Give me an overview of Adakaro",
      "What exactly is Adakaro?",
    ]) {
      const normalized = normalizeRetrievalIntent(query);
      assert.equal(normalized.canonicalQuestion, "What is Adakaro?");
      assert.equal(normalized.mentionsAdakaroOnly, true);
      assert.equal(normalized.mentionsAdakaroAi, false);
    }
  });

  it("maps Adakaro AI identity phrases to Who is Adakaro AI?", () => {
    for (const query of [
      "What is Adakaro AI?",
      "Who is Adakaro AI?",
      "Tell me about Adakaro AI",
      "Explain Adakaro AI",
    ]) {
      const normalized = normalizeRetrievalIntent(query);
      assert.equal(normalized.canonicalQuestion, "Who is Adakaro AI?");
      assert.equal(normalized.mentionsAdakaroAi, true);
    }
  });

  it("does not collapse capability or process questions", () => {
    assert.equal(
      normalizeRetrievalIntent("What can Adakaro do?").canonicalQuestion,
      null
    );
    assert.equal(
      normalizeRetrievalIntent("How do I get started with Adakaro?").canonicalQuestion,
      null
    );
    assert.equal(
      normalizeRetrievalIntent("Can I migrate data from my current system?").canonicalQuestion,
      null
    );
  });

  it("detects AI assistant mentions", () => {
    assert.equal(mentionsAdakaroAi("ai assistant in adakaro"), true);
    assert.equal(mentionsAdakaroAi("Tell me about Adakaro"), false);
  });
});

describe("Adakaro entity retrieval ranking", () => {
  it('routes platform identity paraphrases to "What is Adakaro?"', () => {
    for (const query of [
      "what is adakaro",
      "tell me about adakaro",
      "explain adakaro",
      "describe adakaro",
      "give me an overview of adakaro",
      "what exactly is adakaro",
    ]) {
      expectMatch(query, "What is Adakaro?");
    }
  });

  it('routes Adakaro AI identity questions to "Who is Adakaro AI?"', () => {
    for (const query of [
      "what is adakaro ai",
      "who is adakaro ai",
      "tell me about adakaro ai",
      "explain adakaro ai",
      "ai assistant in adakaro",
    ]) {
      expectMatch(query, "Who is Adakaro AI?");
    }
  });

  it("keeps dedicated capability and onboarding entries", () => {
    expectMatch("what can adakaro do", "What can Adakaro do?");
    expectMatch(
      "how do i get started with adakaro",
      "How do I get started with Adakaro?"
    );
    expectMatch(
      "can i migrate data from my current system",
      "Can I migrate data from my current system?"
    );
  });

  it("prefers platform identity over Adakaro AI for broad Adakaro questions", () => {
    const result = testKnowledgeQuery("Tell me about Adakaro", ENTITY_ENTRIES);
    assert.notEqual(result.entry?.question, "Who is Adakaro AI?");
    assert.equal(result.entry?.question, "What is Adakaro?");
  });
});
