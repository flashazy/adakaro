/**
 * Metadata validation — reject bad metadata before save.
 */

import type { KeywordGenerationResult } from "./types";

const MAX_KEYWORD_WORDS = 4;
const MAX_SYNONYM_WORDS = 5;
const MAX_SEARCH_WORDS = 12;
const MAX_RELATED_WORDS = 5;

const MARKETING_PATTERN =
  /\b(amazing|revolutionary|world[- ]class|best|incredible|cutting[- ]edge|game[- ]changer|unmatched)\b/i;

const SENTENCE_PATTERN = /[.!?].+|[;]\s*\w+|\b(because|therefore|however|this means|which is)\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isSentenceLike(text: string): boolean {
  if (wordCount(text) > 14) return true;
  if (SENTENCE_PATTERN.test(text)) return true;
  if (MARKETING_PATTERN.test(text)) return true;
  return false;
}

export function validateMetadataDraft(
  metadata: KeywordGenerationResult,
  question: string
): { valid: boolean; errors: string[]; fieldErrors: Record<string, string[]> } {
  const errors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  if (metadata.keywords.length < 3) {
    errors.push("At least 3 keywords are required.");
    fieldErrors.keywords = ["Need at least 3 keywords"];
  }
  for (const kw of metadata.keywords) {
    if (wordCount(kw) > MAX_KEYWORD_WORDS) {
      fieldErrors.keywords = [...(fieldErrors.keywords ?? []), `"${kw}" exceeds 4 words`];
    }
    if (isSentenceLike(kw)) {
      fieldErrors.keywords = [...(fieldErrors.keywords ?? []), `"${kw}" looks like a sentence`];
    }
    if (kw !== kw.toLowerCase() && kw.split(/\s+/).length > 1) {
      fieldErrors.keywords = [...(fieldErrors.keywords ?? []), `"${kw}" should be lowercase`];
    }
  }

  if (metadata.synonyms.length < 1) {
    errors.push("At least 1 synonym is required.");
  }
  for (const syn of metadata.synonyms) {
    if (wordCount(syn) > MAX_SYNONYM_WORDS || isSentenceLike(syn)) {
      fieldErrors.synonyms = [...(fieldErrors.synonyms ?? []), `Invalid synonym: "${syn}"`];
    }
  }

  if (metadata.search_phrases.length < 1) {
    errors.push("At least 1 search phrase is required.");
  }
  for (const phrase of metadata.search_phrases) {
    if (wordCount(phrase) > MAX_SEARCH_WORDS || isSentenceLike(phrase)) {
      fieldErrors.search_phrases = [...(fieldErrors.search_phrases ?? []), `Unnatural search: "${phrase}"`];
    }
    const lower = phrase.toLowerCase();
    if (
      lower !== phrase ||
      (!lower.startsWith("how ") &&
        !lower.startsWith("what ") &&
        !lower.startsWith("can ") &&
        !lower.startsWith("is ") &&
        !lower.startsWith("where ") &&
        !lower.includes("adakaro"))
    ) {
      fieldErrors.search_phrases = [
        ...(fieldErrors.search_phrases ?? []),
        `Search phrase should be lowercase and search-like: "${phrase}"`,
      ];
    }
  }

  if (metadata.alternative_wording.length < 1) {
    errors.push("At least 1 alternative wording is required.");
  }
  const qTokens = new Set(
    question
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2)
  );
  for (const alt of metadata.alternative_wording) {
    if (!alt.includes("?")) {
      fieldErrors.alternative_wording = [
        ...(fieldErrors.alternative_wording ?? []),
        `Alternative wording should be a question: "${alt}"`,
      ];
    }
    const altTokens = alt.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const overlap = altTokens.filter((t) => qTokens.has(t)).length;
    if (overlap < 1 && wordCount(question) > 3) {
      fieldErrors.alternative_wording = [
        ...(fieldErrors.alternative_wording ?? []),
        `Alternative wording may change intent: "${alt}"`,
      ];
    }
  }

  if (metadata.related_terms.length < 1) {
    errors.push("At least 1 related term is required.");
  }
  for (const term of metadata.related_terms) {
    if (wordCount(term) > MAX_RELATED_WORDS || isSentenceLike(term)) {
      fieldErrors.related_terms = [...(fieldErrors.related_terms ?? []), `Invalid related term: "${term}"`];
    }
  }

  const allFieldErrors = Object.values(fieldErrors).flat();
  if (allFieldErrors.length) {
    errors.push(...allFieldErrors.slice(0, 6));
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}
