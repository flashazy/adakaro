import type { AIKnowledgeEntry } from "./types";
import { computeEntryQuality } from "./scoring";
import { normalizeText } from "./knowledge-scoring";

/** Ensure API/database rows always expose a string `answer` for the editor. */
export function normalizeKnowledgeEntry(
  row: Record<string, unknown>
): AIKnowledgeEntry {
  const answer =
    typeof row.answer === "string"
      ? row.answer
      : typeof row.proposed_answer === "string"
        ? row.proposed_answer
        : typeof row.content === "string"
          ? row.content
          : typeof row.body === "string"
            ? row.body
            : "";

  const normalizedQuestion =
    typeof row.normalized_question === "string"
      ? row.normalized_question
      : typeof row.question === "string"
        ? normalizeText(row.question)
        : "";

  const entry = {
    ...(row as unknown as AIKnowledgeEntry),
    answer,
    normalized_question: normalizedQuestion,
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
    search_phrases: Array.isArray(row.search_phrases)
      ? (row.search_phrases as string[])
      : [],
    alternative_wording: Array.isArray(row.alternative_wording)
      ? (row.alternative_wording as string[])
      : [],
    synonyms: Array.isArray(row.synonyms) ? (row.synonyms as string[]) : [],
    related_terms: Array.isArray(row.related_terms)
      ? (row.related_terms as string[])
      : [],
    status: (row.status as AIKnowledgeEntry["status"]) ?? "active",
    health_status: (row.health_status as AIKnowledgeEntry["health_status"]) ?? "needs_review",
  } satisfies AIKnowledgeEntry;

  const quality = computeEntryQuality(entry);

  return {
    ...entry,
    quality_score: quality.score,
  } as AIKnowledgeEntry & { quality_score: number };
}

function entryQualityScore(entry: AIKnowledgeEntry): number {
  const stored = (entry as AIKnowledgeEntry & { quality_score?: number }).quality_score;
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return stored;
  }
  return computeEntryQuality(entry).score;
}

/** Align Published Knowledge badge with live quality when DB health is stale. */
export function resolveDisplayHealth(entry: AIKnowledgeEntry): AIKnowledgeEntry["health_status"] {
  if (!entry.answer?.trim()) return "needs_review";

  const score = entryQualityScore(entry);
  const metadataComplete =
    entry.keywords.length >= 3 &&
    entry.search_phrases.length >= 1 &&
    (entry.synonyms ?? []).length >= 1 &&
    entry.related_terms.length >= 1;

  if (score >= 75 && metadataComplete) {
    return "healthy";
  }

  return entry.health_status ?? "needs_review";
}
