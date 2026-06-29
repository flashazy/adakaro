/**
 * Metadata validation — reject bad metadata before save.
 */

import type { KeywordGenerationResult } from "./types";

const MAX_KEYWORD_WORDS = 4;
const MAX_SYNONYM_WORDS = 5;
export const MIN_SEARCH_PHRASE_WORDS = 1;
export const MAX_SEARCH_PHRASE_WORDS = 5;
const MAX_RELATED_WORDS = 5;

const SEARCH_PHRASE_ALLOWED = /^[a-z0-9\s]+$/;

const SEARCH_STOPWORDS = new Set([
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
  "must",
  "shall",
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
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "and",
  "but",
  "or",
  "if",
  "because",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
]);

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

function isRealisticSearchPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  return words.some((word) => word.length >= 2 && !SEARCH_STOPWORDS.has(word));
}

export function validateSearchPhrase(phrase: string): { valid: boolean; error?: string } {
  const trimmed = phrase.trim();
  if (!trimmed) {
    return { valid: false, error: "Search phrase cannot be empty." };
  }

  if (trimmed !== trimmed.toLowerCase()) {
    return { valid: false, error: `Search phrase must be lowercase: "${phrase}"` };
  }

  if (!SEARCH_PHRASE_ALLOWED.test(trimmed)) {
    return {
      valid: false,
      error: `Search phrase may only use letters, numbers, and spaces: "${phrase}"`,
    };
  }

  const words = wordCount(trimmed);
  if (words < MIN_SEARCH_PHRASE_WORDS || words > MAX_SEARCH_PHRASE_WORDS) {
    return { valid: false, error: `Search phrase must be 1–5 words: "${phrase}"` };
  }

  if (isSentenceLike(trimmed)) {
    return {
      valid: false,
      error: `Search phrase should read like a search query, not a sentence: "${phrase}"`,
    };
  }

  if (!isRealisticSearchPhrase(trimmed)) {
    return {
      valid: false,
      error: `Search phrase needs at least one meaningful word: "${phrase}"`,
    };
  }

  if (MARKETING_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `Search phrase should not use marketing language: "${phrase}"`,
    };
  }

  return { valid: true };
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

  const seenSearchPhrases = new Set<string>();
  for (const phrase of metadata.search_phrases) {
    const normalized = phrase.trim().toLowerCase();
    if (seenSearchPhrases.has(normalized)) {
      fieldErrors.search_phrases = [
        ...(fieldErrors.search_phrases ?? []),
        `Duplicate search phrase: "${phrase}"`,
      ];
      continue;
    }
    seenSearchPhrases.add(normalized);

    const result = validateSearchPhrase(phrase);
    if (!result.valid && result.error) {
      fieldErrors.search_phrases = [...(fieldErrors.search_phrases ?? []), result.error];
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
