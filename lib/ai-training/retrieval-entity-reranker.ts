/**
 * Post-retrieval reranker — parent/child entity hierarchy for Adakaro vs Adakaro AI.
 */

import { extractKnowledgeEntity } from "./knowledge-entities";
import { normalizeText } from "./knowledge-scoring";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import type { RetrievalIntentNormalization } from "./retrieval-intent-normalizer";
import type { AIKnowledgeEntry } from "./types";

const CHILD_ENTITY_ID = "adakaro-ai";
const PARENT_ENTITY_ID = "adakaro";

const CANONICAL_EXACT_BOOST = 0.28;
const METADATA_EXACT_BOOST = 0.14;
const CHILD_WHEN_PLATFORM_ONLY_PENALTY = -0.22;
const CHILD_WHEN_AI_MENTIONED_BOOST = 0.1;
const PARENT_WHEN_PLATFORM_ONLY_BOOST = 0.06;

function entryEntityId(entry: AIKnowledgeEntry): string | null {
  return extractKnowledgeEntity(entry.question)?.id ?? null;
}

function metadataExactMatch(query: string, entry: AIKnowledgeEntry): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;

  const fields = [
    ...entry.search_phrases,
    ...entry.alternative_wording,
    ...(entry.synonyms ?? []),
  ];

  return fields.some((field) => normalizeText(field) === normalizedQuery);
}

function applyEntityAdjustment(
  item: RankedKnowledgeEntry,
  query: string,
  intent: RetrievalIntentNormalization
): RankedKnowledgeEntry {
  let adjustment = 0;
  const entityId = entryEntityId(item.entry);

  if (intent.canonicalQuestion) {
    if (
      normalizeText(item.entry.question) === normalizeText(intent.canonicalQuestion)
    ) {
      adjustment += CANONICAL_EXACT_BOOST;
    }
  }

  if (metadataExactMatch(query, item.entry)) {
    adjustment += METADATA_EXACT_BOOST;
  }

  if (intent.mentionsAdakaroOnly) {
    if (entityId === CHILD_ENTITY_ID) {
      adjustment += CHILD_WHEN_PLATFORM_ONLY_PENALTY;
    }
    if (entityId === PARENT_ENTITY_ID && intent.canonicalQuestion) {
      adjustment += PARENT_WHEN_PLATFORM_ONLY_BOOST;
    }
  }

  if (intent.mentionsAdakaroAi) {
    if (entityId === CHILD_ENTITY_ID) {
      adjustment += CHILD_WHEN_AI_MENTIONED_BOOST;
    }
    if (entityId === PARENT_ENTITY_ID && intent.canonicalQuestion) {
      adjustment += CHILD_WHEN_PLATFORM_ONLY_PENALTY * 0.5;
    }
  }

  if (adjustment === 0) return item;

  const score = Math.max(0, Math.min(1, item.score + adjustment));
  return {
    ...item,
    score,
    breakdown: {
      ...item.breakdown,
      score,
    },
  };
}

/** Rerank semantic/keyword candidates using entity hierarchy and canonical intent. */
export function rerankByEntityHierarchy(
  query: string,
  ranked: RankedKnowledgeEntry[],
  intent: RetrievalIntentNormalization
): RankedKnowledgeEntry[] {
  return [...ranked]
    .map((item) => applyEntityAdjustment(item, query, intent))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.0005) return scoreDiff;
      return b.breakdown.questionScore - a.breakdown.questionScore;
    });
}
