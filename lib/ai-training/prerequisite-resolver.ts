/**
 * Unified prerequisite & knowledge-coverage resolution.
 *
 * Aligns dependency analysis, curriculum planning, and quality validation with
 * the duplicate engine's semantic equivalence model so systems never disagree.
 */

import { computeQuestionSimilarity, NEAR_DUPLICATE_MIN } from "./knowledge-duplicates";
import type { LessonPrerequisite } from "./knowledge-intelligence-types";
import { normalizeText } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";

/** Minimum combined similarity to treat an existing lesson as covering a topic. */
export const KNOWLEDGE_COVERED_THRESHOLD = NEAR_DUPLICATE_MIN;

export type KnowledgeMatchType = "exact" | "fuzzy" | "semantic";

export interface KnowledgeCoverageMatch {
  entry: AIKnowledgeEntry;
  similarity: number;
  matchType: KnowledgeMatchType;
  /** Canonical prerequisite question from the chain (if resolving a dep). */
  matchedQuestion: string;
}

/** @deprecated Use LessonPrerequisite — kept as alias for resolver return values. */
export type PrerequisiteResolution = LessonPrerequisite;

function isActiveEntry(entry: AIKnowledgeEntry, excludeId?: string): boolean {
  return entry.status === "active" && !entry.merged_into_id && entry.id !== excludeId;
}

function entryMatchesQuestionText(entry: AIKnowledgeEntry, norm: string): boolean {
  if (normalizeText(entry.question) === norm) return true;
  if (entry.normalized_question && normalizeText(entry.normalized_question) === norm) return true;

  const entryNorm = normalizeText(entry.question);
  if (entryNorm.includes(norm.slice(0, 24)) || norm.includes(entryNorm.slice(0, 24))) {
    return true;
  }

  for (const phrase of [
    ...entry.search_phrases,
    ...entry.alternative_wording,
    ...entry.synonyms,
  ]) {
    if (normalizeText(phrase) === norm) return true;
  }

  return false;
}

/** Fast exact / metadata / substring lookup (first pass). */
export function findEntryByExactQuestion(
  question: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string
): AIKnowledgeEntry | null {
  const norm = normalizeText(question);
  return (
    entries.find(
      (e) => isActiveEntry(e, excludeId) && entryMatchesQuestionText(e, norm)
    ) ?? null
  );
}

/**
 * Whether an existing lesson semantically covers the requested question/topic.
 * Used by dependencies, curriculum planner, gap detection, and publishing gates.
 */
export function findKnowledgeCoverage(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: { excludeId?: string; category?: string }
): KnowledgeCoverageMatch | null {
  const trimmed = question.trim();
  if (!trimmed) return null;

  const active = entries.filter((e) => isActiveEntry(e, options?.excludeId));

  const exact = findEntryByExactQuestion(trimmed, active, options?.excludeId);
  if (exact) {
    return {
      entry: exact,
      similarity: 1,
      matchType: "exact",
      matchedQuestion: exact.question,
    };
  }

  let best: KnowledgeCoverageMatch | null = null;

  for (const entry of active) {
    const result = computeQuestionSimilarity(trimmed, entry, {
      category: options?.category,
    });

    const sameIntentCategory =
      result.scores.intentSimilarity >= 0.85 &&
      result.classification !== "different_intent";

    const satisfies =
      result.isExact ||
      result.classification === "near_duplicate" ||
      (sameIntentCategory && result.similarity >= KNOWLEDGE_COVERED_THRESHOLD) ||
      (sameIntentCategory &&
        result.similarity >= 0.65 &&
        result.scores.entitySimilarity >= 0.85);

    if (!satisfies) continue;

    if (!best || result.similarity > best.similarity) {
      best = {
        entry,
        similarity: result.similarity,
        matchType: result.isExact ? "exact" : "semantic",
        matchedQuestion: entry.question,
      };
    }
  }

  return best;
}

/** True when any active entry already covers this lesson topic. */
export function isKnowledgeCovered(
  question: string,
  entries: AIKnowledgeEntry[],
  options?: { excludeId?: string; category?: string }
): boolean {
  return findKnowledgeCoverage(question, entries, options) !== null;
}

/**
 * Resolve a single prerequisite against the knowledge base.
 * Reuses semantic matches so deps never ask for lessons that already exist.
 */
export function resolvePrerequisite(
  prerequisiteQuestion: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string
): LessonPrerequisite {
  const coverage = findKnowledgeCoverage(prerequisiteQuestion, entries, { excludeId });

  if (!coverage) {
    return {
      question: prerequisiteQuestion,
      entryId: null,
      completed: false,
      satisfiedBy: null,
    };
  }

  const matchType: KnowledgeMatchType =
    coverage.matchType === "exact" && coverage.similarity >= 0.99
      ? "exact"
      : coverage.similarity >= KNOWLEDGE_COVERED_THRESHOLD
        ? "semantic"
        : "fuzzy";

  const isExactQuestion =
    normalizeText(coverage.entry.question) === normalizeText(prerequisiteQuestion);

  return {
    question: prerequisiteQuestion,
    entryId: coverage.entry.id,
    completed: true,
    satisfiedBy: isExactQuestion
      ? null
      : {
          entryId: coverage.entry.id,
          question: coverage.entry.question,
          similarity: coverage.similarity,
          matchType,
        },
  };
}

export function formatPrerequisiteStatus(prerequisite: LessonPrerequisite): string {
  if (!prerequisite.completed) {
    return "Missing — increases lesson priority";
  }
  if (prerequisite.satisfiedBy) {
    const pct = Math.round(prerequisite.satisfiedBy.similarity * 100);
    return `Prerequisite satisfied by: "${prerequisite.satisfiedBy.question}" (${pct}% topic match)`;
  }
  return "Published in knowledge base";
}

export function formatPrerequisiteHint(prerequisite: LessonPrerequisite): string | undefined {
  if (prerequisite.completed) return undefined;
  return `Missing prerequisite: ${prerequisite.question}`;
}

export function formatEnterpriseDependencyHint(
  missing: LessonPrerequisite[]
): string | undefined {
  if (missing.length === 0) return undefined;
  return `Missing prerequisites: ${missing.map((p) => p.question).join("; ")}`;
}
