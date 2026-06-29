import type { KeywordGenerationResult } from "./types";
import {
  generateKnowledgeMetadataSync,
  type KnowledgeMetadataInput,
} from "./knowledge-metadata-generator";

export type { MetadataField, KnowledgeMetadataGenerationResult } from "./knowledge-metadata-generator";
export {
  generateKnowledgeMetadata,
  generateKnowledgeMetadataSync,
  metadataFieldsMatchSource,
} from "./knowledge-metadata-generator";

/** @deprecated Use generateKnowledgeMetadata — kept for import paths that only pass question. */
export function generateKeywordsFromQuestion(
  question: string,
  category?: string,
  answer?: string
): KeywordGenerationResult {
  const input: KnowledgeMetadataInput = {
    category: category ?? "General",
    question,
    answer: answer ?? "",
  };
  const result = generateKnowledgeMetadataSync(input);
  return {
    keywords: result.keywords,
    synonyms: result.synonyms,
    search_phrases: result.search_phrases,
    alternative_wording: result.alternative_wording,
    related_terms: result.related_terms,
  };
}

export function normalizeQuestionForDedup(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
