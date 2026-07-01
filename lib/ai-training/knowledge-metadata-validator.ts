/**
 * Metadata validation — reject bad metadata before save.
 */

import { compareKnowledgeEntities, extractKnowledgeEntity } from "./knowledge-entities";
import {
  areDistinctButRelatedIntentFamilies,
  compareIntentSignatures,
  inferIntentSignature,
} from "./intent-signature";
import { meaningfulTokens, normalizeText } from "./knowledge-scoring";
import type { KeywordGenerationResult } from "./types";

const MAX_KEYWORD_WORDS = 4;
const MAX_SYNONYM_WORDS = 5;
export const MIN_SEARCH_PHRASE_WORDS = 1;
export const MAX_SEARCH_PHRASE_WORDS = 8;
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

export type AlternativeWordingRelation =
  | "exact_intent"
  | "equivalent_intent"
  | "related_intent"
  | "different_intent";

export interface MetadataFieldValidation {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function meaningfulTokenCount(text: string): number {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !SEARCH_STOPWORDS.has(word)).length;
}

function hasSpamPattern(text: string): boolean {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const counts = new Map<string, number>();
  for (const word of words) {
    const next = (counts.get(word) ?? 0) + 1;
    counts.set(word, next);
    if (next >= 3) return true;
  }

  return false;
}

function isSentenceLike(text: string): boolean {
  if (wordCount(text) > 14) return true;
  if (SENTENCE_PATTERN.test(text)) return true;
  if (MARKETING_PATTERN.test(text)) return true;
  return false;
}

function isRealisticSearchPhrase(phrase: string): boolean {
  return meaningfulTokenCount(phrase) >= 1;
}

export function suggestShorterSearchPhrases(phrase: string): string[] {
  const trimmed = phrase.trim().toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => word.length >= 2 && !SEARCH_STOPWORDS.has(word));

  const suggestions = new Set<string>();

  if (meaningful.length >= 2) {
    suggestions.add(meaningful.slice(-2).join(" "));
    suggestions.add(meaningful.slice(0, 2).join(" "));
  }
  if (meaningful.length >= 3) {
    suggestions.add(meaningful.slice(-3).join(" "));
    suggestions.add(meaningful.slice(0, 3).join(" "));
  }
  if (meaningful.length === 1) {
    suggestions.add(meaningful[0]!);
  }

  for (const word of meaningful) {
    if (word.length >= 4) suggestions.add(word);
  }

  return [...suggestions]
    .filter((item) => {
      const count = wordCount(item);
      return count >= MIN_SEARCH_PHRASE_WORDS && count <= MAX_SEARCH_PHRASE_WORDS;
    })
    .slice(0, 4);
}

export function validateSearchPhrase(phrase: string): MetadataFieldValidation {
  const trimmed = phrase.trim();
  if (!trimmed) {
    return { valid: false, error: "Search phrase cannot be empty." };
  }

  if (trimmed !== trimmed.toLowerCase()) {
    return {
      valid: false,
      error: `Search phrase must be lowercase: "${phrase}"`,
      suggestions: [trimmed.toLowerCase()],
    };
  }

  if (!SEARCH_PHRASE_ALLOWED.test(trimmed)) {
    return {
      valid: false,
      error: `Search phrase may only use letters, numbers, and spaces: "${phrase}"`,
      suggestions: suggestShorterSearchPhrases(trimmed.replace(/[^a-z0-9\s]/gi, " ")),
    };
  }

  const words = wordCount(trimmed);
  const meaningful = meaningfulTokenCount(trimmed);

  if (words < MIN_SEARCH_PHRASE_WORDS) {
    return { valid: false, error: `Search phrase must include at least one word: "${phrase}"` };
  }

  if (words > MAX_SEARCH_PHRASE_WORDS) {
    const suggestions = suggestShorterSearchPhrases(trimmed);
    return {
      valid: false,
      error: `This search phrase is longer than recommended (${words} words). Natural queries up to ${MAX_SEARCH_PHRASE_WORDS} words are accepted.`,
      suggestions,
    };
  }

  if (isSentenceLike(trimmed)) {
    return {
      valid: false,
      error: `Search phrase should read like a search query, not a full sentence: "${phrase}"`,
      suggestions: suggestShorterSearchPhrases(trimmed),
    };
  }

  if (!isRealisticSearchPhrase(trimmed)) {
    return {
      valid: false,
      error: `Search phrase needs at least one meaningful word: "${phrase}"`,
      suggestions: suggestShorterSearchPhrases(trimmed),
    };
  }

  if (hasSpamPattern(trimmed)) {
    return {
      valid: false,
      error: `Search phrase repeats words unnaturally: "${phrase}"`,
      suggestions: suggestShorterSearchPhrases(trimmed),
    };
  }

  if (MARKETING_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `Search phrase should not use marketing language: "${phrase}"`,
      suggestions: suggestShorterSearchPhrases(trimmed),
    };
  }

  return { valid: true };
}

export function classifyAlternativeWordingRelation(
  originalQuestion: string,
  alternative: string
): AlternativeWordingRelation {
  const origNorm = normalizeText(originalQuestion);
  const altNorm = normalizeText(alternative.replace(/\?+$/, ""));

  if (!altNorm) return "different_intent";
  if (origNorm === altNorm) return "exact_intent";

  const origSig = inferIntentSignature(originalQuestion);
  const altSig = inferIntentSignature(alternative);
  const intentSimilarity = compareIntentSignatures(origSig, altSig);

  const origEntity = extractKnowledgeEntity(originalQuestion);
  const altEntity = extractKnowledgeEntity(alternative);
  if (origEntity && altEntity && compareKnowledgeEntities(origEntity, altEntity) < 0.25) {
    return "different_intent";
  }

  const sameCategory = origSig.category === altSig.category;
  if (sameCategory && intentSimilarity >= 0.85) {
    if (origSig.action && altSig.action && origSig.action !== altSig.action) {
      return "related_intent";
    }

    const origTokens = new Set(meaningfulTokens(originalQuestion));
    const altTokens = meaningfulTokens(alternative);
    const shared = altTokens.filter((token) => origTokens.has(token)).length;
    const union = new Set([...origTokens, ...altTokens]).size;

    if (union > 0 && shared / union >= 0.25) {
      return "equivalent_intent";
    }

    return "related_intent";
  }

  if (areDistinctButRelatedIntentFamilies(origSig, altSig) || intentSimilarity >= 0.35) {
    return "related_intent";
  }

  return "different_intent";
}

export function validateAlternativeWordingItem(
  originalQuestion: string,
  alternative: string
): MetadataFieldValidation {
  const trimmed = alternative.trim();
  if (!trimmed) {
    return { valid: false, error: "Alternative wording cannot be empty." };
  }

  if (!trimmed.includes("?")) {
    return {
      valid: false,
      error: `Alternative wording should be a question: "${alternative}"`,
      suggestions: [`${trimmed.replace(/[.!?]+$/g, "")}?`],
    };
  }

  if (isSentenceLike(trimmed) || wordCount(trimmed) > 16) {
    return {
      valid: false,
      error: `Alternative wording is too long or reads like an explanation: "${alternative}"`,
    };
  }

  const relation = classifyAlternativeWordingRelation(originalQuestion, trimmed);

  if (relation === "different_intent") {
    return {
      valid: false,
      error: `Alternative wording changes the lesson intent: "${alternative}"`,
      suggestions: [
        originalQuestion.trim().endsWith("?")
          ? originalQuestion.trim()
          : `${originalQuestion.trim()}?`,
      ],
    };
  }

  return { valid: true };
}

function formatValidationMessage(result: MetadataFieldValidation): string {
  if (!result.error) return "";
  if (!result.suggestions?.length) return result.error;

  return `${result.error}\nSuggested shorter versions:\n${result.suggestions
    .map((item) => `• ${item}`)
    .join("\n")}`;
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
    if (!result.valid) {
      fieldErrors.search_phrases = [
        ...(fieldErrors.search_phrases ?? []),
        formatValidationMessage(result),
      ];
    }
  }

  if (metadata.alternative_wording.length < 1) {
    errors.push("At least 1 alternative wording is required.");
  }
  for (const alt of metadata.alternative_wording) {
    const result = validateAlternativeWordingItem(question, alt);
    if (!result.valid) {
      fieldErrors.alternative_wording = [
        ...(fieldErrors.alternative_wording ?? []),
        formatValidationMessage(result),
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
