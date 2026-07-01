import type { AIKnowledgeEntry } from "./types";

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

  return {
    ...(row as unknown as AIKnowledgeEntry),
    answer,
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
  };
}
