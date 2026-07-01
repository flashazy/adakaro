import { computeEntryQuality } from "./scoring";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";

/** Prefer primary, newest, highest-quality entries; drop archived/merged duplicates. */
export function filterRetrievalCandidates(
  entries: AIKnowledgeEntry[]
): AIKnowledgeEntry[] {
  return entries.filter(
    (entry) =>
      entry.status === "active" &&
      entry.is_primary !== false &&
      !entry.merged_into_id
  );
}

function entryRecencyScore(entry: AIKnowledgeEntry): number {
  const updated = new Date(entry.updated_at).getTime();
  return updated / 1_000_000_000_000;
}

function entryQualityScore(entry: AIKnowledgeEntry): number {
  return computeEntryQuality(entry).score / 100;
}

export function compareRetrievalPriority(
  a: RankedKnowledgeEntry,
  b: RankedKnowledgeEntry
): number {
  const scoreDiff = b.score - a.score;
  if (Math.abs(scoreDiff) > 0.008) return scoreDiff;

  const searchDiff =
    b.breakdown.searchPhraseScore - a.breakdown.searchPhraseScore;
  if (Math.abs(searchDiff) > 0.001) return searchDiff;

  const phraseDiff = b.breakdown.phraseOverlap - a.breakdown.phraseOverlap;
  if (Math.abs(phraseDiff) > 0.001) return phraseDiff;

  const questionDiff = b.breakdown.questionScore - a.breakdown.questionScore;
  if (Math.abs(questionDiff) > 0.001) return questionDiff;

  const primaryDiff =
    Number(b.entry.is_primary !== false) - Number(a.entry.is_primary !== false);
  if (primaryDiff !== 0) return primaryDiff;

  const versionDiff =
    (b.entry.version_number ?? 1) - (a.entry.version_number ?? 1);
  if (versionDiff !== 0) return versionDiff;

  const qualityDiff = entryQualityScore(b.entry) - entryQualityScore(a.entry);
  if (Math.abs(qualityDiff) > 0.01) return qualityDiff;

  const confidenceDiff =
    (b.entry.intent_confidence ?? 0) - (a.entry.intent_confidence ?? 0);
  if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;

  const recencyDiff = entryRecencyScore(b.entry) - entryRecencyScore(a.entry);
  if (Math.abs(recencyDiff) > 0.000001) return recencyDiff;

  return b.entry.usage_count - a.entry.usage_count;
}

export function dedupeRankedByIntent(
  ranked: RankedKnowledgeEntry[]
): RankedKnowledgeEntry[] {
  const seenIntents = new Set<string>();
  const result: RankedKnowledgeEntry[] = [];

  for (const item of ranked) {
    const intentKey = item.entry.intent_key;
    if (intentKey) {
      if (seenIntents.has(intentKey)) continue;
      seenIntents.add(intentKey);
    }
    result.push(item);
  }

  return result;
}

export function applyRetrievalPriority(
  ranked: RankedKnowledgeEntry[]
): RankedKnowledgeEntry[] {
  return dedupeRankedByIntent(
    [...ranked].sort(compareRetrievalPriority)
  );
}
