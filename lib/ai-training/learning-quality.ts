import { GENERIC_SINGLE_TERMS } from "./knowledge-scoring";
import { normalizeText, meaningfulTokens } from "./knowledge-scoring";
import type { LearningSuggestionType } from "./learning-types";

const MIN_SUGGESTION_LENGTH = 3;
const MIN_KEYWORD_LENGTH = 4;
const MIN_OCCURRENCE_COUNT = 2;

const BLOCKED_PATTERNS = [
  /\bpassword\b/i,
  /\bssn\b/i,
  /\bcredit card\b/i,
  /\bphone number\b/i,
];

export function isGenericLearningTerm(text: string): boolean {
  const tokens = meaningfulTokens(text);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && GENERIC_SINGLE_TERMS.has(tokens[0]!)) return true;
  return false;
}

export function isBlockedLearningText(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < MIN_SUGGESTION_LENGTH) return true;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isValidSuggestionText(
  text: string,
  type: LearningSuggestionType
): boolean {
  const trimmed = text.trim();
  if (isBlockedLearningText(trimmed)) return false;

  if (type === "keyword") {
    if (trimmed.length < MIN_KEYWORD_LENGTH) return false;
    if (isGenericLearningTerm(trimmed)) return false;
  }

  if (type === "synonym" || type === "search_phrase" || type === "alternative_wording") {
    if (isGenericLearningTerm(trimmed)) return false;
    const tokens = meaningfulTokens(trimmed);
    if (tokens.length < 2 && type !== "synonym") return false;
  }

  return true;
}

export function meetsOccurrenceThreshold(count: number): boolean {
  return count >= MIN_OCCURRENCE_COUNT;
}

export function buildSuggestionClusterKey(
  type: LearningSuggestionType,
  text: string,
  intentKey: string | null,
  entryId: string | null
): string {
  return `${type}:${intentKey ?? entryId ?? "global"}:${normalizeText(text)}`;
}

export function phraseAlreadyExists(text: string, existing: string[]): boolean {
  const normalized = normalizeText(text);
  return existing.some((item) => normalizeText(item) === normalized);
}
