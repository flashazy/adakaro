import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AIKnowledgeEntry } from "./types";
import { testKnowledgeQuery } from "./test-match";
import { resolveEntryIntent } from "./intent-registry";

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

const ZERO_COST_ENTRIES: AIKnowledgeEntry[] = [
  mockEntry({
    id: "bulk-import",
    category: "Onboarding",
    question: "Can I import students in bulk?",
    intent_key: "student.bulk_import",
    intent_name: "Bulk Student Import",
    intent_group: "Student Management",
    related_intents: [
      "student.excel_upload",
      "student.csv_template",
      "student.migration",
    ],
    keywords: ["import", "bulk", "migration", "learners", "external system"],
    search_phrases: ["import students in bulk", "bulk import students"],
    alternative_wording: [
      "bring learners from another system",
      "migrate students from external system",
    ],
    synonyms: ["bulk upload students", "learner migration", "another system"],
    related_terms: ["admissions", "onboarding"],
  }),
  mockEntry({
    id: "excel-upload",
    category: "Onboarding",
    question: "Can I upload Excel files?",
    intent_key: "student.excel_upload",
    intent_name: "Excel Upload",
    intent_group: "Student Management",
    related_intents: ["student.bulk_import", "student.csv_template"],
    keywords: ["excel", "upload excel", "spreadsheet"],
    search_phrases: ["upload excel files", "can i upload excel"],
    alternative_wording: ["do that with excel", "import using excel"],
    synonyms: ["excel import", "xlsx upload"],
  }),
  mockEntry({
    id: "archive",
    category: "Student Management",
    question: "Can I deactivate or archive students?",
    intent_key: "student.archive_inactive",
    intent_name: "Archive / Deactivate Students",
    intent_group: "Student Management",
    related_intents: ["student.class_history", "student.profile_information"],
    keywords: ["hide", "archive", "inactive", "deactivate"],
    search_phrases: [
      "hide student keep records",
      "deactivate student keep records",
      "archive student without deleting",
    ],
    alternative_wording: [
      "remove learner from active lists but keep history",
      "hide student but keep records",
      "archive a student without deleting report cards",
      "remove a student from the active list",
    ],
    synonyms: ["inactive student", "soft delete student", "hide learner"],
    related_terms: ["student lifecycle"],
  }),
  mockEntry({
    id: "class-history",
    category: "Student Management",
    question: "Can I see a student's class movement history?",
    intent_key: "student.class_history",
    intent_name: "Class History",
    intent_group: "Student Management",
    related_intents: ["student.class_transfer", "student.archive_inactive"],
    keywords: ["class history", "movement history", "previous classes"],
    search_phrases: [
      "student movement history",
      "previous classes for a student",
      "view class history",
    ],
    alternative_wording: [
      "see previous classes for a student",
      "view a student's movement history",
    ],
    synonyms: ["class movement log", "stream history"],
    related_terms: ["promotions", "streaming"],
  }),
  mockEntry({
    id: "transfer",
    category: "Student Management",
    question: "Can I transfer students between classes?",
    intent_key: "student.class_transfer",
    intent_name: "Class Transfer",
    intent_group: "Student Management",
    related_intents: ["student.class_history"],
    keywords: ["transfer", "move class", "stream", "pupil"],
    search_phrases: [
      "transfer students between classes",
      "move student to another class",
    ],
    alternative_wording: [
      "change a pupil to another stream",
      "move pupil to different stream",
    ],
    synonyms: ["change student class", "switch stream"],
    related_terms: ["streaming", "promotions"],
  }),
  mockEntry({
    id: "free-plan",
    category: "Pricing",
    question: "Is there a free plan?",
    intent_key: "pricing.free_plan",
    intent_name: "Free Plan",
    intent_group: "Pricing",
    related_intents: ["pricing.starter_plan", "pricing.billing_start", "demo.request"],
    keywords: ["free", "free plan", "trial"],
    search_phrases: ["is there a free plan", "try before paying"],
    alternative_wording: [
      "try the system before paying",
      "school owners try before paying",
    ],
    synonyms: ["free trial", "try adakaro free"],
  }),
  mockEntry({
    id: "when-pay",
    category: "Pricing",
    question: "When do I start paying?",
    intent_key: "pricing.billing_start",
    intent_name: "When Billing Starts",
    intent_group: "Pricing",
    related_intents: ["pricing.free_plan", "pricing.cost"],
    keywords: ["billing start", "when pay", "start paying"],
    search_phrases: ["when do i start paying"],
    alternative_wording: ["try before paying billing starts"],
    synonyms: ["payment start date"],
  }),
  mockEntry({
    id: "starter-plan",
    category: "Pricing",
    question: "Is there a starter plan?",
    intent_key: "pricing.starter_plan",
    intent_name: "Starter Plan",
    intent_group: "Pricing",
    related_intents: ["pricing.free_plan", "pricing.cost"],
    keywords: ["starter", "starter plan", "starter package"],
    search_phrases: ["is there a starter plan", "starter package"],
    synonyms: ["starter tier", "starter bundle"],
  }),
  mockEntry({
    id: "monthly-features",
    category: "Pricing",
    question: "Do I lose features on monthly billing?",
    intent_key: "pricing.monthly_features",
    intent_name: "Monthly Billing Features",
    intent_group: "Pricing",
    related_intents: ["pricing.cost", "pricing.billing_start"],
    keywords: ["monthly", "billing", "lose features", "pay monthly"],
    search_phrases: [
      "lose features on monthly billing",
      "monthly billing features",
    ],
    alternative_wording: [
      "will i lose features if i pay monthly",
      "lose features when paying monthly",
    ],
  }),
];

function expectIntentMatch(
  query: string,
  expectedIntentKey: string,
  expectedQuestion?: string
) {
  const result = testKnowledgeQuery(query, ZERO_COST_ENTRIES);
  assert.equal(result.matched, true, `expected match for: ${query}`);
  assert.equal(
    result.matchedIntentKey,
    expectedIntentKey,
    `query "${query}" should match intent ${expectedIntentKey} but got ${result.matchedIntentKey}`
  );
  if (expectedQuestion) {
    assert.equal(result.entry?.question, expectedQuestion);
  }
}

function expectIntentMatchOneOf(
  query: string,
  expectedIntentKeys: string[]
) {
  const result = testKnowledgeQuery(query, ZERO_COST_ENTRIES);
  assert.equal(result.matched, true, `expected match for: ${query}`);
  assert.ok(
    result.matchedIntentKey &&
      expectedIntentKeys.includes(result.matchedIntentKey),
    `query "${query}" should match one of [${expectedIntentKeys.join(", ")}] but got ${result.matchedIntentKey}`
  );
}

describe("zero-cost retrieval meaning-based queries", () => {
  it("maps external learner migration to bulk import", () => {
    expectIntentMatch(
      "Can I bring my learners from another system?",
      "student.bulk_import",
      "Can I import students in bulk?"
    );
  });

  it("maps excel upload shorthand", () => {
    expectIntentMatch(
      "Can I upload Excel?",
      "student.excel_upload",
      "Can I upload Excel files?"
    );
  });

  it("maps hide learner with history to archive", () => {
    expectIntentMatch(
      "Can I remove a learner from active lists but keep history?",
      "student.archive_inactive",
      "Can I deactivate or archive students?"
    );
  });

  it("maps hide student keep records to archive", () => {
    expectIntentMatch(
      "Can I hide a student but keep their records?",
      "student.archive_inactive",
      "Can I deactivate or archive students?"
    );
  });

  it("maps archive without deleting report cards to archive", () => {
    expectIntentMatch(
      "Can I archive a student without deleting report cards?",
      "student.archive_inactive",
      "Can I deactivate or archive students?"
    );
  });

  it("maps remove from active list to archive", () => {
    expectIntentMatch(
      "Can I remove a student from the active list?",
      "student.archive_inactive",
      "Can I deactivate or archive students?"
    );
  });

  it("maps previous classes query to class history", () => {
    expectIntentMatch(
      "Can I see previous classes for a student?",
      "student.class_history",
      "Can I see a student's class movement history?"
    );
  });

  it("maps movement history query to class history", () => {
    expectIntentMatch(
      "Can I view a student's movement history?",
      "student.class_history",
      "Can I see a student's class movement history?"
    );
  });

  it("does not map archive query to class history", () => {
    const result = testKnowledgeQuery(
      "Can I remove a learner from active lists but keep history?",
      ZERO_COST_ENTRIES
    );
    assert.notEqual(result.matchedIntentKey, "student.class_history");
  });

  it("maps pupil stream change to class transfer", () => {
    expectIntentMatch(
      "Can I change a pupil to another stream?",
      "student.class_transfer",
      "Can I transfer students between classes?"
    );
  });

  it("maps try-before-pay to free plan or billing start", () => {
    expectIntentMatchOneOf(
      "Can school owners try the system before paying?",
      ["pricing.free_plan", "pricing.billing_start"]
    );
  });

  it("maps starter package to starter plan", () => {
    expectIntentMatch(
      "Is there a starter package?",
      "pricing.starter_plan",
      "Is there a starter plan?"
    );
  });

  it("maps monthly feature loss question", () => {
    expectIntentMatch(
      "Will I lose features if I pay monthly?",
      "pricing.monthly_features",
      "Do I lose features on monthly billing?"
    );
  });
});

describe("zero-cost intent inference", () => {
  it("resolves intent metadata on entries", () => {
    const entry = ZERO_COST_ENTRIES[0]!;
    const intent = resolveEntryIntent(entry);
    assert.equal(intent.intent_key, "student.bulk_import");
    assert.equal(intent.intent_name, "Bulk Student Import");
  });
});
