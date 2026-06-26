import type { AIKnowledgeEntry } from "./types";

const ANSWER_SUMMARY_MAX = 220;

function answerSummary(answer: string): string {
  return answer
    .replace(/\*\*/g, "")
    .replace(/[#*_`]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, ANSWER_SUMMARY_MAX);
}

/** Text used for embedding generation and semantic comparison. */
export function buildKnowledgeEmbeddingText(entry: AIKnowledgeEntry): string {
  const sections: string[] = [
    `Question: ${entry.question}`,
  ];

  if (entry.search_phrases.length > 0) {
    sections.push(`Search phrases: ${entry.search_phrases.join("; ")}`);
  }
  if (entry.alternative_wording.length > 0) {
    sections.push(`Alternative wording: ${entry.alternative_wording.join("; ")}`);
  }
  if ((entry.synonyms ?? []).length > 0) {
    sections.push(`Synonyms: ${entry.synonyms.join("; ")}`);
  }
  if (entry.keywords.length > 0) {
    sections.push(`Keywords: ${entry.keywords.join("; ")}`);
  }
  if (entry.related_terms.length > 0) {
    sections.push(`Related terms: ${entry.related_terms.join("; ")}`);
  }

  const summary = answerSummary(entry.answer);
  if (summary) {
    sections.push(`Answer summary: ${summary}`);
  }

  return sections.join("\n");
}
