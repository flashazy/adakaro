import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combineRetrievalScores, passesRetrievalThreshold } from "./knowledge-semantic-rerank";
import { testKnowledgeQuery } from "./test-match";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

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

const SEMANTIC_ENTRIES: AIKnowledgeEntry[] = [
  mockEntry({
    id: "bulk-import",
    category: "Onboarding",
    question: "Can I import students in bulk?",
    keywords: ["import", "bulk", "excel import", "student import"],
    search_phrases: ["import students in bulk", "bulk import students"],
    synonyms: ["bulk upload students"],
    related_terms: ["migration", "external system"],
  }),
  mockEntry({
    id: "archive",
    category: "Student Management",
    question: "Can I deactivate or archive students?",
    keywords: ["hide", "archive", "inactive", "deactivate"],
    search_phrases: ["hide student keep records", "deactivate student"],
    synonyms: ["hide student", "inactive student"],
    related_terms: ["student lifecycle"],
  }),
  mockEntry({
    id: "free-plan",
    category: "Pricing",
    question: "Is there a free plan?",
    keywords: ["free", "free plan", "trial"],
    search_phrases: ["free plan", "try adakaro free"],
    related_terms: ["pricing", "starter"],
  }),
  mockEntry({
    id: "when-pay",
    category: "Pricing",
    question: "When do I start paying?",
    keywords: ["billing", "payment start", "when pay", "subscription"],
    search_phrases: ["when do i start paying", "start paying"],
    related_terms: ["trial end", "billing cycle"],
  }),
  mockEntry({
    id: "transfer",
    category: "Student Management",
    question: "Can I transfer students between classes?",
    keywords: ["transfer", "move class", "change class", "stream"],
    search_phrases: [
      "transfer students between classes",
      "move student to another class",
    ],
    synonyms: ["change student class"],
    related_terms: ["class movement", "streaming"],
  }),
  mockEntry({
    id: "excel-upload",
    category: "Onboarding",
    question: "Can I upload Excel files?",
    keywords: ["excel", "upload excel", "spreadsheet"],
    search_phrases: ["upload excel files"],
  }),
  mockEntry({
    id: "what-is",
    category: "General",
    question: "What is Adakaro?",
    keywords: ["adakaro", "platform"],
    search_phrases: ["what is adakaro"],
  }),
];

function semanticScores(
  scores: Record<string, number>
): Map<string, number> {
  return new Map(Object.entries(scores));
}

function expectSemanticMatch(
  query: string,
  expectedQuestion: string | string[],
  scores: Record<string, number>
) {
  const expected = Array.isArray(expectedQuestion)
    ? expectedQuestion
    : [expectedQuestion];

  const result = testKnowledgeQuery(query, SEMANTIC_ENTRIES, {
    semanticScores: semanticScores(scores),
  });

  assert.equal(result.matched, true, `expected semantic match for: ${query}`);
  assert.ok(
    result.entry && expected.includes(result.entry.question),
    `query "${query}" should match one of [${expected.join(", ")}] but got "${result.entry?.question ?? "none"}" (final ${result.finalScore})`
  );
  assert.ok(
    result.semanticScore !== null && result.semanticScore > 0,
    "semantic score should be present"
  );
  assert.ok(result.finalScore >= MATCH_SCORE_THRESHOLD);
}

describe("semantic score combination", () => {
  it("combines keyword and semantic scores with configured weights", () => {
    const combined = combineRetrievalScores(0.62, 0.7);
    assert.ok(Math.abs(combined - (0.62 * 0.55 + 0.7 * 0.45)) < 0.001);
  });

  it("blocks weak keyword + moderate semantic matches", () => {
    assert.equal(passesRetrievalThreshold(0.2, 0.65, 0.5), false);
  });

  it("allows weak keyword when semantic confidence is very high", () => {
    const final = combineRetrievalScores(0.2, 0.88);
    assert.equal(passesRetrievalThreshold(0.2, 0.88, final), true);
  });
});

describe("semantic retrieval meaning-based queries", () => {
  it("maps external learner migration to bulk import", () => {
    expectSemanticMatch(
      "Can I bring my learners from another system?",
      "Can I import students in bulk?",
      {
        "bulk-import": 0.91,
        "excel-upload": 0.72,
        archive: 0.18,
        transfer: 0.22,
        "free-plan": 0.1,
        "when-pay": 0.08,
        "what-is": 0.05,
      }
    );
  });

  it("maps hide learner with history to archive students", () => {
    expectSemanticMatch(
      "Can I remove a learner from active lists but keep history?",
      "Can I deactivate or archive students?",
      {
        archive: 0.89,
        transfer: 0.3,
        "bulk-import": 0.15,
        "free-plan": 0.05,
        "when-pay": 0.05,
        "excel-upload": 0.1,
        "what-is": 0.02,
      }
    );
  });

  it("maps try-before-pay to free plan or billing start", () => {
    expectSemanticMatch(
      "Can school owners try the system before paying?",
      ["Is there a free plan?", "When do I start paying?"],
      {
        "free-plan": 0.86,
        "when-pay": 0.84,
        "bulk-import": 0.1,
        archive: 0.08,
        transfer: 0.06,
        "excel-upload": 0.05,
        "what-is": 0.12,
      }
    );
  });

  it("maps pupil stream change to class transfer", () => {
    expectSemanticMatch(
      "Can I change a pupil to another stream?",
      "Can I transfer students between classes?",
      {
        transfer: 0.9,
        archive: 0.25,
        "bulk-import": 0.12,
        "free-plan": 0.05,
        "when-pay": 0.04,
        "excel-upload": 0.08,
        "what-is": 0.03,
      }
    );
  });
});
