import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AIKnowledgeEntry } from "./types";
import { rankKnowledgeEntries } from "./knowledge-search";
import { testKnowledgeQuery } from "./test-match";
import {
  GENERIC_SINGLE_TERMS,
  phraseOverlapRatio,
  SCORING_STOP_WORDS,
  scoreCandidate,
  substringScore,
} from "./knowledge-scoring";

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

const REGRESSION_ENTRIES: AIKnowledgeEntry[] = [
  mockEntry({
    id: "archive",
    category: "Student Management",
    question: "Can I deactivate or archive students?",
    keywords: ["hide", "archive", "inactive", "deactivate", "soft delete"],
    search_phrases: [
      "hide student keep records",
      "hide student but keep records",
      "archive student keep records",
      "deactivate student keep records",
    ],
    alternative_wording: [
      "can i hide a student",
      "hide student but keep records",
    ],
    synonyms: ["hide student", "inactive student"],
    related_terms: ["student lifecycle", "leave school"],
  }),
  mockEntry({
    id: "store-info",
    category: "Student Management",
    question: "What information can I store for each student?",
    keywords: ["student", "information", "store", "records", "profile", "data"],
    search_phrases: ["student information", "store student data", "student records"],
    related_terms: ["student management", "enrollment data"],
  }),
  mockEntry({
    id: "starter-plan",
    category: "Pricing",
    question: "Is there a starter plan?",
    keywords: ["starter", "starter plan", "free plan", "free tier"],
    search_phrases: ["starter plan", "is there a starter plan"],
  }),
  mockEntry({
    id: "monthly-billing",
    category: "Pricing",
    question: "Do I lose features on monthly billing?",
    keywords: ["monthly", "billing", "plan", "features", "subscription"],
    search_phrases: ["monthly billing", "lose features monthly"],
  }),
  mockEntry({
    id: "report-cards",
    category: "Report Cards",
    question: "How do report cards work?",
    keywords: ["report cards", "report card", "grades"],
    search_phrases: ["how do report cards work"],
  }),
  mockEntry({
    id: "pricing",
    category: "Pricing",
    question: "How much does Adakaro cost?",
    keywords: ["pricing", "cost", "price", "adakaro cost"],
    search_phrases: ["how much does adakaro cost"],
  }),
  mockEntry({
    id: "excel-upload",
    category: "Onboarding",
    question: "Can I upload Excel files?",
    keywords: ["excel", "upload excel", "spreadsheet"],
    search_phrases: ["upload excel files", "excel files"],
  }),
  mockEntry({
    id: "bulk-import",
    category: "Onboarding",
    question: "Can I import students in bulk?",
    keywords: ["import", "bulk", "excel import", "student import"],
    search_phrases: ["import students in bulk", "bulk import students"],
  }),
  mockEntry({
    id: "what-is",
    category: "General",
    question: "What is Adakaro?",
    keywords: ["adakaro", "platform", "school management"],
    search_phrases: ["what is adakaro"],
  }),
];

function expectBestMatch(
  query: string,
  expectedQuestion: string,
  mustNotMatch: string[] = []
) {
  const result = testKnowledgeQuery(query, REGRESSION_ENTRIES);
  assert.equal(result.matched, true, `expected match for: ${query}`);
  assert.equal(
    result.entry?.question,
    expectedQuestion,
    `query "${query}" should match "${expectedQuestion}" but got "${result.entry?.question ?? "none"}" (confidence ${result.confidence}%)`
  );

  for (const bad of mustNotMatch) {
    assert.notEqual(
      result.entry?.question,
      bad,
      `query "${query}" must not match "${bad}"`
    );
  }
}

describe("knowledge-scoring substring rules", () => {
  const query = "Can I hide a student but keep their records?";

  it("does not award high substring score for generic single words", () => {
    for (const word of ["student", "records", "can", "plan", "data"]) {
      assert.ok(
        substringScore(query, word) < 0.5,
        `substringScore for "${word}" should be low, got ${substringScore(query, word)}`
      );
    }
  });

  it("boosts phrase-aware matches over generic token overlap", () => {
    const phraseScore = scoreCandidate(query, "hide student but keep records");
    const genericScore = scoreCandidate(query, "records");
    assert.ok(
      phraseScore > genericScore,
      `phrase (${phraseScore}) should beat generic keyword (${genericScore})`
    );
    assert.ok(
      phraseOverlapRatio(query, "hide student but keep records") > 0,
      "phrase overlap should detect shared bigrams"
    );
  });
});

describe("knowledge-scoring generic term guard", () => {
  it("marks common generic tokens as protected", () => {
    assert.ok(GENERIC_SINGLE_TERMS.has("student"));
    assert.ok(GENERIC_SINGLE_TERMS.has("records"));
    assert.ok(SCORING_STOP_WORDS.has("can"));
  });
});

describe("knowledge retrieval regressions", () => {
  it('matches hide/archive intent over student profile storage', () => {
    expectBestMatch(
      "Can I hide a student but keep their records?",
      "Can I deactivate or archive students?",
      ["What information can I store for each student?"]
    );

    const ranked = rankKnowledgeEntries(
      "Can I hide a student but keep their records?",
      REGRESSION_ENTRIES
    );
    const archive = ranked.find(
      (r) => r.entry.question === "Can I deactivate or archive students?"
    );
    const store = ranked.find(
      (r) => r.entry.question === "What information can I store for each student?"
    );
    assert.ok(archive, "archive entry should rank");
    if (store) {
      assert.ok(
        archive!.score > store.score,
        `archive (${archive!.score}) should beat store-info (${store.score})`
      );
    }
  });

  it("matches starter plan over monthly billing", () => {
    expectBestMatch("Is there a starter plan?", "Is there a starter plan?", [
      "Do I lose features on monthly billing?",
    ]);
  });

  it("matches report cards over pricing", () => {
    expectBestMatch("How do report cards work?", "How do report cards work?", [
      "How much does Adakaro cost?",
    ]);
  });

  it("matches excel upload exactly", () => {
    expectBestMatch("Can I upload Excel files?", "Can I upload Excel files?");
  });

  it("matches bulk import exactly", () => {
    expectBestMatch(
      "Can I import students in bulk?",
      "Can I import students in bulk?"
    );
  });

  it('still matches "What is Adakaro?"', () => {
    expectBestMatch("What is Adakaro?", "What is Adakaro?");
  });

  it('still matches "How much does Adakaro cost?"', () => {
    expectBestMatch(
      "How much does Adakaro cost?",
      "How much does Adakaro cost?"
    );
  });
});

describe("field weighting", () => {
  it("prefers search phrases over isolated generic keywords", () => {
    const archive = REGRESSION_ENTRIES.find((e) => e.id === "archive")!;
    const store = REGRESSION_ENTRIES.find((e) => e.id === "store-info")!;
    const query = "Can I hide a student but keep their records?";

    const archivePhrase = scoreCandidate(
      query,
      archive.search_phrases.find((p) => p.includes("hide student"))!
    );
    const storeKeyword = scoreCandidate(query, "records");

    assert.ok(
      archivePhrase > storeKeyword,
      `phrase match (${archivePhrase}) should beat generic keyword (${storeKeyword})`
    );
  });
});
