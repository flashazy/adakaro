/**
 * Adakaro AI Knowledge Writing Standard
 *
 * Defines HOW knowledge entries must be written (facts, structure, retrieval metadata).
 * Conversation tone belongs in the Global System Prompt — not here.
 *
 * Bump KNOWLEDGE_WRITING_STANDARD_VERSION when making material changes.
 */

export const KNOWLEDGE_WRITING_STANDARD_VERSION = "1.0.0";

export const KNOWLEDGE_WRITING_STANDARD_META = {
  version: KNOWLEDGE_WRITING_STANDARD_VERSION,
  id: "adakaro-knowledge-writing-standard",
  title: "Adakaro AI Knowledge Writing Standard",
} as const;

/** Canonical module names — Rule 7. */
export const ADAKARO_MODULE_TERMS = [
  "Student Management",
  "Parent Portal",
  "School Finance",
  "Report Cards",
  "Attendance",
  "Teacher Management",
  "Enrollment Desk",
  "Syllabus Coverage",
  "Promotions",
  "Communications",
] as const;

/** Recommended answer section headings — Rule 5. */
export const RECOMMENDED_ANSWER_SECTIONS = [
  "Overview",
  "Core Facts",
  "Key Capabilities",
  "Benefits",
  "Limitations",
  "Related Features",
] as const;

const CONVERSATIONAL_PHRASES = [
  /\bi'?d be happy to help\b/i,
  /\bif you'?d like\b/i,
  /\blet me know\b/i,
  /\bfeel free to\b/i,
  /\bhello\b/i,
  /\bhi there\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
  /\bthank you for asking\b/i,
  /\bi hope this helps\b/i,
];

const MARKETING_WORDS = [
  /\bamazing\b/i,
  /\brevolutionary\b/i,
  /\bworld[- ]class\b/i,
  /\bbest\b/i,
  /\bincredible\b/i,
  /\bcutting[- ]edge\b/i,
  /\bgame[- ]changer\b/i,
  /\bunmatched\b/i,
];

const TIME_BOUND_WORDS = [
  /\btoday\b/i,
  /\bcurrently\b/i,
  /\bsoon\b/i,
  /\bnext month\b/i,
  /\bthis month\b/i,
  /\bat the moment\b/i,
  /\bfor now\b/i,
];

const MULTI_INTENT_PATTERNS = [
  /\band also\b/i,
  /\bas well as\b/i,
  /\?.*\?/,
  /\bwhat is .+ and how (much|do|does|can)\b/i,
  /\bhow .+ and (what|how|can|does)\b/i,
];

export interface KnowledgeWritingDraft {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  search_phrases: string[];
  alternative_wording: string[];
  synonyms: string[];
  related_terms: string[];
  priority: string;
  intent_key?: string | null;
}

export interface WritingStandardCheckItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  hint?: string;
}

export interface WritingStandardValidation {
  version: string;
  passed: boolean;
  requiredPassed: boolean;
  checklist: WritingStandardCheckItem[];
  issues: string[];
  warnings: string[];
}

export const KNOWLEDGE_WRITING_STANDARD_SECTIONS = [
  {
    id: "purpose",
    title: "Purpose",
    body: `This standard ensures every knowledge entry is accurate, consistent, easy to retrieve, easy to maintain, human-friendly when used by the AI, and scalable to thousands of entries.`,
  },
  {
    id: "rule-1",
    title: "Rule 1 — One Intent Per Entry",
    body: `Each entry must answer one primary user intent.

Good: "What is Adakaro?", "What can Adakaro do?", "Can I import students?"
Bad: "What is Adakaro and how much does it cost and how do I register students?"

One question. One intent.`,
  },
  {
    id: "rule-2",
    title: "Rule 2 — Facts, Not Conversation",
    body: `Knowledge entries store facts. They do NOT sound like a chatbot.

Avoid: greetings, "I'd be happy to help", "If you'd like...", "Let me know..."

The conversation engine is responsible for sounding human.`,
  },
  {
    id: "rule-3",
    title: "Rule 3 — Be Accurate",
    body: `Never describe features that do not exist. Never speculate. Never exaggerate. If a feature is not implemented, do not mention it.`,
  },
  {
    id: "rule-4",
    title: "Rule 4 — Professional Language",
    body: `Use clear, professional English.

Avoid: Amazing, Revolutionary, Best, Incredible, Cutting-edge
Prefer: Helps, Allows, Supports, Enables, Provides`,
  },
  {
    id: "rule-5",
    title: "Rule 5 — Structure Every Answer",
    body: `When appropriate, structure answers with: Overview, Core Facts, Key Capabilities, Benefits, Limitations (if applicable), Related Features.

Keep paragraphs short. Use bullet lists when they improve readability.`,
  },
  {
    id: "rule-6",
    title: "Rule 6 — Keep Answers Focused",
    body: `Answer only what the user asked. Do not explain unrelated modules. Mention related features only when they naturally add value.`,
  },
  {
    id: "rule-7",
    title: "Rule 7 — Use Consistent Terminology",
    body: `Always use the same module names: ${ADAKARO_MODULE_TERMS.join(", ")}. Do not invent new names for existing modules.`,
  },
  {
    id: "rule-8",
    title: "Rule 8 — Retrieval Friendly",
    body: `Every entry should include: Question, Keywords, Synonyms, Search Phrases, Alternative Wording, Related Terms — representing how real users naturally ask questions.`,
  },
  {
    id: "rule-9",
    title: "Rule 9 — Avoid Duplicates",
    body: `Before creating an entry, check if the intent already exists. Update the existing entry if yes. Create a new entry only when the intent is different.`,
  },
  {
    id: "rule-10",
    title: "Rule 10 — Keep Knowledge Modular",
    body: `Split large topics into multiple focused entries. Each entry should answer one clear question.`,
  },
  {
    id: "rule-11",
    title: "Rule 11 — Keep Answers Timeless",
    body: `Avoid: Today, Currently, Next month, Soon. Describe how the system works — not temporary states.`,
  },
  {
    id: "rule-12",
    title: "Rule 12 — Human Verification",
    body: `Before saving, ask: "If a school principal asked me this in person, would this answer fully satisfy them?" If not, improve it.`,
  },
  {
    id: "rule-13",
    title: "Rule 13 — Enterprise Quality Checklist",
    body: `Verify: correct category, priority, one clear intent, accurate answer, strong keywords, natural synonyms, real search phrases, alternative wording, related terms, no duplicate intent, professional language, consistent terminology, factual correctness.`,
  },
  {
    id: "rule-14",
    title: "Rule 14 — Knowledge Is Separate From Conversation",
    body: `Knowledge stores information. The Global System Prompt controls tone, conversation flow, answer length, follow-ups, warmth, and personality. Do not mix these responsibilities.`,
  },
  {
    id: "rule-15",
    title: "Rule 15 — Continuous Improvement",
    body: `Knowledge is never finished. When product features change: update entries, create new ones, merge duplicates, improve retrieval quality, and version every meaningful change.`,
  },
  {
    id: "mission",
    title: "Mission Statement",
    body: `Every knowledge entry should make Adakaro AI more accurate, trustworthy, and helpful. The goal is not the largest knowledge base — it is the highest-quality school management knowledge base in Africa.`,
  },
] as const;

/** Full standard as markdown for export and reference panels. */
export function buildKnowledgeWritingStandardMarkdown(): string {
  const header = `# ${KNOWLEDGE_WRITING_STANDARD_META.title} (v${KNOWLEDGE_WRITING_STANDARD_VERSION})\n\n`;
  const body = KNOWLEDGE_WRITING_STANDARD_SECTIONS.map(
    (section) => `## ${section.title}\n\n${section.body}`
  ).join("\n\n");
  return header + body;
}

function findPatternMatches(text: string, patterns: RegExp[]): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => p.source);
}

function hasMultiIntentQuestion(question: string): boolean {
  return MULTI_INTENT_PATTERNS.some((p) => p.test(question.trim()));
}

function countAnswerSections(answer: string): number {
  const normalized = answer.toLowerCase();
  return RECOMMENDED_ANSWER_SECTIONS.filter((section) =>
    normalized.includes(section.toLowerCase())
  ).length;
}

/**
 * Validates a draft entry against the Enterprise Quality Checklist (Rule 13)
 * and writing-standard content rules.
 */
export function validateKnowledgeWritingStandard(
  draft: KnowledgeWritingDraft
): WritingStandardValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const answer = draft.answer.trim();
  const question = draft.question.trim();

  const conversational = findPatternMatches(answer, CONVERSATIONAL_PHRASES);
  if (conversational.length) {
    issues.push("Answer contains conversational phrasing — use facts only (Rule 2).");
  }

  const marketing = findPatternMatches(answer, MARKETING_WORDS);
  if (marketing.length) {
    issues.push("Answer contains marketing language — use professional wording (Rule 4).");
  }

  const timeBound = findPatternMatches(answer, TIME_BOUND_WORDS);
  if (timeBound.length) {
    warnings.push("Answer may contain time-bound wording — keep entries timeless (Rule 11).");
  }

  if (hasMultiIntentQuestion(question)) {
    issues.push("Question appears to combine multiple intents — use one intent per entry (Rule 1).");
  }

  if (answer.length > 0 && answer.length < 80) {
    warnings.push("Answer is very short — ensure it fully satisfies the question (Rule 12).");
  }

  const sectionCount = countAnswerSections(answer);
  if (answer.length >= 120 && sectionCount === 0) {
    warnings.push(
      "Consider structuring longer answers with sections like Overview, Core Facts, Key Capabilities (Rule 5)."
    );
  }

  const checklist: WritingStandardCheckItem[] = [
    {
      id: "category",
      label: "Correct category",
      passed: Boolean(draft.category.trim()),
      required: true,
    },
    {
      id: "priority",
      label: "Correct priority",
      passed: Boolean(draft.priority.trim()),
      required: true,
    },
    {
      id: "one-intent",
      label: "One clear intent",
      passed: question.length >= 8 && !hasMultiIntentQuestion(question),
      required: true,
      hint: "One focused question per entry.",
    },
    {
      id: "accurate-answer",
      label: "Substantive accurate answer",
      passed: answer.length >= 80,
      required: true,
      hint: "Verify facts manually before publishing.",
    },
    {
      id: "keywords",
      label: "Strong keywords",
      passed: draft.keywords.length >= 3,
      required: true,
    },
    {
      id: "synonyms",
      label: "Natural synonyms",
      passed: draft.synonyms.length >= 1,
      required: true,
    },
    {
      id: "search-phrases",
      label: "Real search phrases",
      passed: draft.search_phrases.length >= 1,
      required: true,
    },
    {
      id: "alternative-wording",
      label: "Alternative wording",
      passed: draft.alternative_wording.length >= 1,
      required: true,
    },
    {
      id: "related-terms",
      label: "Related terms",
      passed: draft.related_terms.length >= 1,
      required: true,
    },
    {
      id: "facts-not-conversation",
      label: "Facts, not conversation",
      passed: conversational.length === 0,
      required: true,
    },
    {
      id: "professional-language",
      label: "Professional language",
      passed: marketing.length === 0,
      required: true,
    },
    {
      id: "timeless",
      label: "Timeless wording",
      passed: timeBound.length === 0,
      required: false,
    },
    {
      id: "structured-answer",
      label: "Structured answer (recommended)",
      passed: sectionCount >= 1 || answer.length < 120,
      required: false,
    },
  ];

  const requiredPassed = checklist.filter((c) => c.required).every((c) => c.passed);
  const passed = requiredPassed && issues.length === 0;

  return {
    version: KNOWLEDGE_WRITING_STANDARD_VERSION,
    passed,
    requiredPassed,
    checklist,
    issues,
    warnings,
  };
}

/** Suggested answer template aligned with Rule 5. */
export function buildRecommendedAnswerTemplate(question: string): string {
  const topic = question.replace(/\?+$/, "").trim() || "Topic";
  return [
    `**Overview**`,
    ``,
    `${topic} — one or two sentences summarizing the direct answer.`,
    ``,
    `**Core Facts**`,
    ``,
    `- Fact one`,
    `- Fact two`,
    ``,
    `**Key Capabilities**`,
    ``,
    `- Capability one`,
    `- Capability two`,
    ``,
    `**Related Features**`,
    ``,
    `- Related module or feature (only if genuinely relevant)`,
  ].join("\n");
}
