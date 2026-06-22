import type { KeywordGenerationResult } from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "i",
  "me",
  "my",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "about",
  "there",
  "here",
  "also",
  "just",
  "only",
  "very",
  "so",
  "not",
  "no",
  "yes",
  "adakaro",
  "school",
  "schools",
]);

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  attendance: [
    "attendance",
    "attendance updates",
    "attendance tracking",
    "absence",
    "absences",
    "absent",
    "present",
    "late",
    "lateness",
    "daily attendance",
  ],
  parent: [
    "parent",
    "parents",
    "parent portal",
    "parent notifications",
    "parent alerts",
    "guardian",
    "guardians",
    "family",
  ],
  report: [
    "report card",
    "report cards",
    "term results",
    "grades",
    "rankings",
    "pdf export",
    "report templates",
  ],
  finance: [
    "finance",
    "fees",
    "fee",
    "payment",
    "payments",
    "receipt",
    "receipts",
    "balance",
    "outstanding",
    "fee collection",
  ],
  pricing: ["pricing", "price", "cost", "billing", "subscription", "plan"],
  demo: ["demo", "walkthrough", "trial", "request demo"],
  student: [
    "student",
    "students",
    "enrollment",
    "streaming",
    "class placement",
    "promotion",
  ],
  syllabus: ["syllabus", "coverage", "curriculum", "lesson plans"],
  messaging: ["message", "messages", "broadcast", "communication", "notify"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function detectDomains(tokens: string[], question: string): string[] {
  const haystack = `${question} ${tokens.join(" ")}`.toLowerCase();
  const domains: string[] = [];
  for (const [domain, terms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (terms.some((term) => haystack.includes(term))) {
      domains.push(domain);
    }
  }
  return domains;
}

function buildAlternativePhrasing(question: string, tokens: string[]): string[] {
  const cleaned = question.trim().replace(/\?+$/, "");
  const alternatives = [
    cleaned,
    cleaned.replace(/^can\s+/i, ""),
    cleaned.replace(/^does\s+adakaro\s+/i, "adakaro "),
    cleaned.replace(/^how\s+(do|does|can)\s+/i, "how to "),
    tokens.slice(0, 4).join(" "),
    tokens.slice(-4).join(" "),
  ];
  return unique(alternatives.filter((a) => a.length > 3));
}

export function generateKeywordsFromQuestion(
  question: string,
  category?: string
): KeywordGenerationResult {
  const tokens = tokenize(question);
  const domains = detectDomains(tokens, question);
  const keywords: string[] = [...tokens];
  const synonyms: string[] = [];
  const searchPhrases: string[] = [];
  const relatedTerms: string[] = [];

  for (const domain of domains) {
    const domainSynonyms = DOMAIN_SYNONYMS[domain] ?? [];
    synonyms.push(...domainSynonyms);
    keywords.push(...domainSynonyms.slice(0, 4));
    relatedTerms.push(...domainSynonyms.slice(0, 6));
  }

  if (category && category !== "General") {
    keywords.push(category.toLowerCase());
    relatedTerms.push(`${category.toLowerCase()} adakaro`);
    synonyms.push(category.toLowerCase());
  }

  if (tokens.length >= 2) {
    for (let i = 0; i < tokens.length - 1; i++) {
      searchPhrases.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }

  if (tokens.length >= 3) {
    searchPhrases.push(tokens.slice(0, 3).join(" "));
    searchPhrases.push(tokens.slice(-3).join(" "));
  }

  const questionLower = question.toLowerCase();
  if (questionLower.includes("parent")) {
    synonyms.push("guardian", "family portal", "parent portal");
  }
  if (questionLower.includes("notification") || questionLower.includes("alert")) {
    synonyms.push("notifications", "alerts", "updates", "messages");
  }
  if (questionLower.includes("report card")) {
    synonyms.push("term results", "grades", "academic results");
  }

  const alternative_wording = buildAlternativePhrasing(question, tokens);

  return {
    keywords: unique(keywords).slice(0, 14),
    synonyms: unique(synonyms).slice(0, 12),
    search_phrases: unique(searchPhrases).slice(0, 10),
    alternative_wording: unique(alternative_wording).slice(0, 8),
    related_terms: unique(relatedTerms).slice(0, 12),
  };
}

export function normalizeQuestionForDedup(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
