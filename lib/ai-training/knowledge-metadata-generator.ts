/**
 * Enterprise AI Metadata Generator — structured retrieval metadata from
 * Category + Question + Answer only. No sentences, no marketing copy.
 */

import { AI_CONFIG } from "@/lib/ai/config";
import { inferIntentSignature } from "./intent-signature";
import {
  MAX_SEARCH_PHRASE_WORDS,
  validateAlternativeWordingItem,
  validateSearchPhrase,
} from "./knowledge-metadata-validator";
import { normalizeText } from "./knowledge-scoring";
import { ADAKARO_MODULE_TERMS } from "./knowledge-writing-standard";
import type { KeywordGenerationResult } from "./types";

export type MetadataField =
  | "keywords"
  | "synonyms"
  | "search_phrases"
  | "alternative_wording"
  | "related_terms";

export interface KnowledgeMetadataInput {
  category: string;
  question: string;
  answer: string;
}

export interface KnowledgeMetadataGenerationResult extends KeywordGenerationResult {
  generatedFrom: "question+answer";
  validationPassed: boolean;
  fieldValidation: Record<MetadataField, boolean>;
}

const MAX_RETRIES = 3;
const MAX_KEYWORD_WORDS = 4;
const MAX_SYNONYM_WORDS = 5;
const MAX_RELATED_WORDS = 5;

const MARKETING_PATTERN =
  /\b(amazing|revolutionary|world[- ]class|best|incredible|cutting[- ]edge|game[- ]changer|unmatched|powerful platform|leading solution)\b/i;

const SENTENCE_PATTERN = /[.!?].+[.!?]|;\s*\w+|\b(is|are|was|were|will|should|because|therefore|however)\b/i;

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  start: ["begin", "start using", "initial setup", "activation", "configuration", "onboarding"],
  attendance: ["attendance tracking", "daily attendance", "absence records", "presence"],
  parent: ["parent portal", "guardian access", "family portal", "parent notifications"],
  report: ["report cards", "term results", "academic results", "grade reports"],
  finance: ["school finance", "fee management", "fee collection", "payments"],
  student: ["student records", "student profiles", "enrollment", "learner management"],
  teacher: ["staff management", "teacher accounts", "faculty"],
  admission: ["enrollment desk", "admissions", "student intake", "applications"],
  pricing: ["billing", "subscription", "plans", "cost"],
  security: ["permissions", "access control", "user roles", "data protection"],
};

const RELATED_CONCEPTS = [
  "School Management System",
  "Education Technology",
  "School Administration",
  "Digital Transformation",
  "Student Information System",
  "Academic Management",
];

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "to", "of", "in", "for", "on", "with",
  "at", "by", "from", "as", "and", "or", "but", "if", "that", "this",
  "it", "its", "they", "them", "their", "we", "our", "you", "your", "i",
  "me", "my", "how", "what", "when", "where", "which", "who", "why", "about",
]);

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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function detectDomains(text: string): string[] {
  const haystack = text.toLowerCase();
  const domains: string[] = [];
  for (const [domain, terms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (terms.some((term) => haystack.includes(term)) || haystack.includes(domain)) {
      domains.push(domain);
    }
  }
  return domains;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function titleCasePhrase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function isMarketingOrSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (MARKETING_PATTERN.test(t)) return true;
  if (wordCount(t) > 14) return true;
  if (SENTENCE_PATTERN.test(t) && wordCount(t) > 6) return true;
  if (t.includes("**") || t.includes("\n\n")) return true;
  return false;
}

function sanitizeKeyword(item: string): string | null {
  let value = stripMarkdown(item).replace(/[.!?]+$/g, "").trim();
  if (!value || isMarketingOrSentence(value)) return null;
  value = truncateWords(value, MAX_KEYWORD_WORDS);
  if (wordCount(value) < 1) return null;
  return value.toLowerCase();
}

function sanitizeSynonym(item: string): string | null {
  let value = stripMarkdown(item).replace(/[.!?]+$/g, "").trim();
  if (!value || isMarketingOrSentence(value)) return null;
  value = truncateWords(value, MAX_SYNONYM_WORDS);
  if (wordCount(value) < 1) return null;
  return value.toLowerCase();
}

function sanitizeSearchPhrase(item: string): string | null {
  let value = stripMarkdown(item).replace(/[.!?]+$/g, "").trim().toLowerCase();
  if (!value || isMarketingOrSentence(value)) return null;
  value = truncateWords(value, MAX_SEARCH_PHRASE_WORDS);
  if (wordCount(value) < 1) return null;
  if (!validateSearchPhrase(value).valid) return null;
  return value;
}

function sanitizeAlternativeWording(item: string, originalQuestion: string): string | null {
  let value = stripMarkdown(item).trim();
  if (!value || isMarketingOrSentence(value)) return null;
  if (wordCount(value) > 16) return null;
  if (!value.endsWith("?")) value = `${value.replace(/[.!?]+$/g, "")}?`;
  if (value.charAt(0) === value.charAt(0).toLowerCase()) {
    value = value.charAt(0).toUpperCase() + value.slice(1);
  }
  const check = validateAlternativeWordingItem(originalQuestion, value);
  if (!check.valid) return null;
  return value;
}

function sanitizeRelatedTerm(item: string): string | null {
  let value = stripMarkdown(item).replace(/[.!?]+$/g, "").trim();
  if (!value || isMarketingOrSentence(value)) return null;
  value = truncateWords(value, MAX_RELATED_WORDS);
  if (wordCount(value) < 1) return null;
  return titleCasePhrase(value);
}

function validateKeywords(items: string[]): boolean {
  if (items.length < 3) return false;
  return items.every((item) => {
    const w = wordCount(item);
    return w >= 1 && w <= MAX_KEYWORD_WORDS && !item.includes(".") && !isMarketingOrSentence(item);
  });
}

function validateSynonyms(items: string[]): boolean {
  if (items.length < 2) return false;
  return items.every((item) => wordCount(item) <= MAX_SYNONYM_WORDS && !isMarketingOrSentence(item));
}

function validateSearchPhrases(items: string[]): boolean {
  if (items.length < 2) return false;
  const seen = new Set<string>();
  return items.every((item) => {
    const result = validateSearchPhrase(item);
    if (!result.valid) return false;
    const key = item.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateAlternativeWording(items: string[], question: string): boolean {
  if (items.length < 2) return false;
  return items.every(
    (item) => validateAlternativeWordingItem(question, item).valid && !isMarketingOrSentence(item)
  );
}

function validateRelatedTerms(items: string[]): boolean {
  if (items.length < 2) return false;
  return items.every((item) => wordCount(item) <= MAX_RELATED_WORDS && !isMarketingOrSentence(item));
}

function extractAnswerPhrases(answer: string): string[] {
  const phrases: string[] = [];
  const lines = answer.split(/\n+/).map((l) => stripMarkdown(l)).filter(Boolean);
  for (const line of lines) {
    if (line.length < 4 || line.length > 48) continue;
    if (/^(overview|core facts|key capabilities|benefits|limitations|related features)$/i.test(line)) {
      continue;
    }
    phrases.push(line.toLowerCase());
  }
  return phrases;
}

function buildKeywords(input: KnowledgeMetadataInput): string[] {
  const tokens = tokenize(`${input.question} ${input.answer}`);
  const domains = detectDomains(`${input.question} ${input.category} ${input.answer}`);
  const keywords: string[] = [];

  if (input.category && input.category !== "General") {
    keywords.push(input.category.toLowerCase());
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    keywords.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) {
      keywords.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
  }

  keywords.push(...tokens.filter((t) => t.length >= 4).slice(0, 8));

  for (const domain of domains) {
    keywords.push(...(DOMAIN_SYNONYMS[domain] ?? []).slice(0, 3));
  }

  keywords.push(...extractAnswerPhrases(input.answer).slice(0, 4));

  return unique(
    keywords
      .map((k) => sanitizeKeyword(k))
      .filter((k): k is string => Boolean(k))
  ).slice(0, 14);
}

function buildSynonyms(input: KnowledgeMetadataInput): string[] {
  const domains = detectDomains(`${input.question} ${input.answer}`);
  const synonyms: string[] = [];

  for (const domain of domains) {
    synonyms.push(...(DOMAIN_SYNONYMS[domain] ?? []));
  }

  const q = input.question.toLowerCase();
  if (q.includes("get started") || q.includes("onboard")) {
    synonyms.push("begin", "start using", "initial setup", "activation", "configuration");
  }
  if (q.includes("report card")) {
    synonyms.push("term results", "academic reports", "grade reports");
  }
  if (q.includes("fee") || q.includes("payment")) {
    synonyms.push("fee collection", "school finance", "billing");
  }

  return unique(
    synonyms
      .map((s) => sanitizeSynonym(s))
      .filter((s): s is string => Boolean(s))
  ).slice(0, 12);
}

function buildSearchPhrases(input: KnowledgeMetadataInput): string[] {
  const intent = inferIntentSignature(input.question);
  const core = input.question.trim().replace(/\?+$/, "").toLowerCase();
  const phrases: string[] = [core];

  const templates: string[] = [];
  if (intent.category === "process") {
    templates.push(
      `how do i ${core.replace(/^how do i\s+/i, "")}`,
      `how to ${core.replace(/^how (?:do i|to)\s+/i, "")}`,
      `steps to ${core.replace(/^how (?:do i|to)\s+/i, "")}`
    );
  } else if (intent.category === "identity") {
    templates.push(
      core,
      core.replace(/^what is\s+/i, "what is "),
      `${core} adakaro`
    );
  } else if (intent.category === "eligibility" || intent.category === "permission") {
    templates.push(
      core,
      core.replace(/^can\s+/i, "can i "),
      core.replace(/^can\s+/i, "is it possible to ")
    );
  } else if (intent.category === "capability") {
    templates.push(core, `${core} in adakaro`, `does adakaro support ${tokenize(input.question).slice(-3).join(" ")}`);
  } else {
    templates.push(
      `how do i ${tokenize(input.question).slice(-4).join(" ")}`,
      core,
      `${core} in adakaro`
    );
  }

  if (!core.includes("adakaro")) {
    templates.push(`${core} adakaro`, `adakaro ${tokenize(input.question).slice(0, 3).join(" ")}`);
  }

  phrases.push(...templates);

  return unique(
    phrases
      .map((p) => sanitizeSearchPhrase(p))
      .filter((p): p is string => Boolean(p))
  ).slice(0, 10);
}

function buildAlternativeWording(input: KnowledgeMetadataInput): string[] {
  const q = input.question.trim().replace(/\?+$/, "");
  const alternatives: string[] = [];

  const variants = [
    q,
    q.replace(/^how do i\s+/i, "How can I "),
    q.replace(/^how do i\s+/i, "How to "),
    q.replace(/^how does\s+/i, "How do "),
    q.replace(/^what is\s+/i, "What's "),
    q.replace(/^can i\s+/i, "Is it possible to "),
    q.replace(/^can parents\s+/i, "Are parents able to "),
    q.replace(/adakaro/i, "the platform"),
    q.replace(/adakaro/i, "Adakaro"),
  ];

  if (q.toLowerCase().includes("get started")) {
    alternatives.push(
      "How do I begin using Adakaro?",
      "How can my school get started?",
      "How do I start using the platform?"
    );
  }

  alternatives.push(...variants);

  return unique(
    alternatives
      .map((a) => sanitizeAlternativeWording(a, input.question))
      .filter((a): a is string => Boolean(a))
  ).slice(0, 8);
}

function buildRelatedTerms(input: KnowledgeMetadataInput): string[] {
  const terms: string[] = [...RELATED_CONCEPTS];
  const haystack = `${input.question} ${input.answer} ${input.category}`.toLowerCase();

  for (const module of ADAKARO_MODULE_TERMS) {
    if (haystack.includes(module.toLowerCase())) {
      terms.push(module);
    }
  }

  if (input.category && input.category !== "General") {
    terms.push(input.category);
  }

  const domains = detectDomains(haystack);
  for (const domain of domains) {
    if (domain === "finance") terms.push("School Finance");
    if (domain === "student") terms.push("Student Management");
    if (domain === "parent") terms.push("Parent Portal");
    if (domain === "report") terms.push("Report Cards");
    if (domain === "attendance") terms.push("Attendance");
  }

  return unique(
    terms
      .map((t) => sanitizeRelatedTerm(t))
      .filter((t): t is string => Boolean(t))
  ).slice(0, 12);
}

function ruleBasedGenerate(input: KnowledgeMetadataInput): KeywordGenerationResult {
  return {
    keywords: buildKeywords(input),
    synonyms: buildSynonyms(input),
    search_phrases: buildSearchPhrases(input),
    alternative_wording: buildAlternativeWording(input),
    related_terms: buildRelatedTerms(input),
  };
}

async function openAIMetadataGenerate(
  input: KnowledgeMetadataInput
): Promise<KeywordGenerationResult | null> {
  const apiKey = AI_CONFIG.openaiApiKey.trim();
  if (!apiKey) return null;

  const system = `You generate structured retrieval metadata for a school management knowledge base.
Return ONLY valid JSON with these keys: keywords, synonyms, search_phrases, alternative_wording, related_terms.
Each value is a string array.

RULES:
- keywords: one keyword or key phrase per item, max 4 words, lowercase, never full sentences
- synonyms: short synonym phrases, max 5 words, lowercase
- search_phrases: realistic lowercase user searches (how/what/can...), max 12 words
- alternative_wording: alternative ways to ask the same question, proper capitalization, end with ?
- related_terms: related concepts, title case, max 5 words each

NEVER include paragraphs, explanations, marketing language, or answer text.`;

  const user = `Category: ${input.category}
Question: ${input.question}
Answer (extract topics only, do not copy sentences):
${stripMarkdown(input.answer).slice(0, 1200)}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) return null;
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<KeywordGenerationResult>;
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.map(String) : [],
      search_phrases: Array.isArray(parsed.search_phrases) ? parsed.search_phrases.map(String) : [],
      alternative_wording: Array.isArray(parsed.alternative_wording)
        ? parsed.alternative_wording.map(String)
        : [],
      related_terms: Array.isArray(parsed.related_terms) ? parsed.related_terms.map(String) : [],
    };
  } catch {
    return null;
  }
}

function sanitizeField(
  field: MetadataField,
  items: string[],
  question: string
): string[] {
  const sanitizer =
    field === "keywords"
      ? sanitizeKeyword
      : field === "synonyms"
        ? sanitizeSynonym
        : field === "search_phrases"
          ? sanitizeSearchPhrase
          : field === "alternative_wording"
            ? (item: string) => sanitizeAlternativeWording(item, question)
            : sanitizeRelatedTerm;

  return unique(
    items
      .map((item) => sanitizer(item))
      .filter((item): item is string => Boolean(item))
  );
}

function validateField(
  field: MetadataField,
  items: string[],
  question: string
): boolean {
  switch (field) {
    case "keywords":
      return validateKeywords(items);
    case "synonyms":
      return validateSynonyms(items);
    case "search_phrases":
      return validateSearchPhrases(items);
    case "alternative_wording":
      return validateAlternativeWording(items, question);
    case "related_terms":
      return validateRelatedTerms(items);
    default:
      return false;
  }
}

function buildField(field: MetadataField, input: KnowledgeMetadataInput): string[] {
  switch (field) {
    case "keywords":
      return buildKeywords(input);
    case "synonyms":
      return buildSynonyms(input);
    case "search_phrases":
      return buildSearchPhrases(input);
    case "alternative_wording":
      return buildAlternativeWording(input);
    case "related_terms":
      return buildRelatedTerms(input);
    default:
      return [];
  }
}

function validateAll(
  result: KeywordGenerationResult,
  question: string
): Record<MetadataField, boolean> {
  return {
    keywords: validateKeywords(result.keywords),
    synonyms: validateSynonyms(result.synonyms),
    search_phrases: validateSearchPhrases(result.search_phrases),
    alternative_wording: validateAlternativeWording(result.alternative_wording, question),
    related_terms: validateRelatedTerms(result.related_terms),
  };
}

function mergeWithFallback(
  candidate: KeywordGenerationResult,
  fallback: KeywordGenerationResult,
  input: KnowledgeMetadataInput
): KeywordGenerationResult {
  const fields: MetadataField[] = [
    "keywords",
    "synonyms",
    "search_phrases",
    "alternative_wording",
    "related_terms",
  ];

  const merged = { ...candidate };
  for (const field of fields) {
    const sanitized = sanitizeField(field, candidate[field], input.question);
    if (!validateField(field, sanitized, input.question)) {
      const ruleItems = buildField(field, input);
      merged[field] =
        sanitized.length >= 2 ? sanitized : ruleItems.length ? ruleItems : fallback[field];
    } else {
      merged[field] = sanitized;
    }
    merged[field] = sanitizeField(field, merged[field], input.question);
    if (!validateField(field, merged[field], input.question)) {
      merged[field] = fallback[field];
    }
  }

  return merged;
}

export async function generateKnowledgeMetadata(
  input: KnowledgeMetadataInput,
  options?: { field?: MetadataField }
): Promise<KnowledgeMetadataGenerationResult> {
  const normalized: KnowledgeMetadataInput = {
    category: input.category?.trim() || "General",
    question: input.question.trim(),
    answer: input.answer.trim(),
  };

  const fallback = ruleBasedGenerate(normalized);
  let candidate = fallback;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt === 0) {
      const ai = await openAIMetadataGenerate(normalized);
      if (ai) candidate = ai;
    } else {
      candidate = ruleBasedGenerate(normalized);
    }

    candidate = mergeWithFallback(candidate, fallback, normalized);
    const fieldValidation = validateAll(candidate, normalized.question);
    const validationPassed = Object.values(fieldValidation).every(Boolean);

    if (validationPassed) {
      if (options?.field) {
        const single = buildField(options.field, normalized);
        const sanitized = sanitizeField(options.field, single, normalized.question);
        candidate = {
          ...candidate,
          [options.field]:
            validateField(options.field, sanitized, normalized.question)
              ? sanitized
              : fallback[options.field],
        };
      }

      return {
        ...candidate,
        generatedFrom: "question+answer",
        validationPassed: true,
        fieldValidation: validateAll(candidate, normalized.question),
      };
    }
  }

  const final = mergeWithFallback(fallback, fallback, normalized);
  return {
    ...final,
    generatedFrom: "question+answer",
    validationPassed: Object.values(validateAll(final, normalized.question)).every(Boolean),
    fieldValidation: validateAll(final, normalized.question),
  };
}

export function generateKnowledgeMetadataSync(
  input: KnowledgeMetadataInput,
  options?: { field?: MetadataField }
): KnowledgeMetadataGenerationResult {
  const normalized: KnowledgeMetadataInput = {
    category: input.category?.trim() || "General",
    question: input.question.trim(),
    answer: input.answer.trim(),
  };

  const fallback = ruleBasedGenerate(normalized);
  let candidate = mergeWithFallback(fallback, fallback, normalized);

  if (options?.field) {
    const single = buildField(options.field, normalized);
    candidate = {
      ...candidate,
      [options.field]: sanitizeField(options.field, single, normalized.question),
    };
  }

  const fieldValidation = validateAll(candidate, normalized.question);
  return {
    ...candidate,
    generatedFrom: "question+answer",
    validationPassed: Object.values(fieldValidation).every(Boolean),
    fieldValidation,
  };
}

export function metadataFieldsMatchSource(
  metadataBaseline: { question: string; answer: string } | null,
  question: string,
  answer: string
): boolean {
  if (!metadataBaseline) return true;
  return (
    normalizeText(metadataBaseline.question) === normalizeText(question) &&
    normalizeText(metadataBaseline.answer) === normalizeText(answer)
  );
}
