import { getIntentDefinition } from "./intent-registry";
import { scoreCandidate, normalizeText } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";
import { resolveEntryIntent } from "./intent-registry";

const GRAPH_INTENT_WEIGHT = 0.35;

/** Score query against knowledge-graph related intents for an entry. */
export function scoreGraphRelatedIntents(
  query: string,
  entry: AIKnowledgeEntry,
  allEntries: AIKnowledgeEntry[]
): number {
  const intent = resolveEntryIntent(entry);
  const relatedKeys = new Set([
    ...(intent.related_intents ?? []),
    ...(intent.intent_key ? [intent.intent_key] : []),
  ]);

  if (relatedKeys.size === 0) return 0;

  let best = 0;

  for (const relatedKey of relatedKeys) {
    const def = getIntentDefinition(relatedKey);
    if (def) {
      for (const term of def.matchTerms) {
        best = Math.max(best, scoreCandidate(query, term) * GRAPH_INTENT_WEIGHT);
      }
      best = Math.max(
        best,
        scoreCandidate(query, def.name) * GRAPH_INTENT_WEIGHT
      );
      best = Math.max(
        best,
        scoreCandidate(query, def.key.replace(/\./g, " ")) * GRAPH_INTENT_WEIGHT
      );
    }

    const linkedEntry = allEntries.find((e) => {
      const ei = resolveEntryIntent(e);
      return ei.intent_key === relatedKey;
    });

    if (linkedEntry) {
      best = Math.max(
        best,
        scoreCandidate(query, linkedEntry.question) * GRAPH_INTENT_WEIGHT * 0.85
      );
      for (const phrase of linkedEntry.search_phrases.slice(0, 3)) {
        best = Math.max(
          best,
          scoreCandidate(query, phrase) * GRAPH_INTENT_WEIGHT * 0.75
        );
      }
    }
  }

  return Math.min(1, best);
}

/** Build a lookup of intent_key → entry ids for graph traversal. */
export function buildIntentGraphIndex(
  entries: AIKnowledgeEntry[]
): Map<string, AIKnowledgeEntry[]> {
  const index = new Map<string, AIKnowledgeEntry[]>();

  for (const entry of entries) {
    const intent = resolveEntryIntent(entry);
    if (!intent.intent_key) continue;

    const list = index.get(intent.intent_key) ?? [];
    list.push(entry);
    index.set(intent.intent_key, list);
  }

  return index;
}

/** Find entries connected via related_intents to a given intent key. */
export function getGraphNeighbors(
  intentKey: string,
  entries: AIKnowledgeEntry[]
): AIKnowledgeEntry[] {
  const def = getIntentDefinition(intentKey);
  const neighborKeys = new Set([
    intentKey,
    ...(def?.relatedIntents ?? []),
  ]);

  return entries.filter((entry) => {
    const intent = resolveEntryIntent(entry);
    if (intent.intent_key && neighborKeys.has(intent.intent_key)) return true;
    return (intent.related_intents ?? []).some((k) => neighborKeys.has(k));
  });
}

/** Check if two entries are graph-connected (same intent group or related intents). */
export function entriesAreGraphRelated(
  a: AIKnowledgeEntry,
  b: AIKnowledgeEntry
): boolean {
  const ia = resolveEntryIntent(a);
  const ib = resolveEntryIntent(b);

  if (ia.intent_key && ib.intent_key && ia.intent_key === ib.intent_key) {
    return true;
  }

  if (
    ia.intent_group &&
    ib.intent_group &&
    normalizeText(ia.intent_group) === normalizeText(ib.intent_group)
  ) {
    return true;
  }

  const aRelated = new Set(ia.related_intents ?? []);
  if (ib.intent_key && aRelated.has(ib.intent_key)) return true;

  const bRelated = new Set(ib.related_intents ?? []);
  if (ia.intent_key && bRelated.has(ia.intent_key)) return true;

  return false;
}
