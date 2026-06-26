import { getIntentDefinition } from "./intent-registry";
import type { AIKnowledgeEntry } from "./types";

export interface PublicSessionContext {
  last_intent_key: string | null;
  last_intent_group: string | null;
  last_module: string | null;
  last_answered_entry_id: string | null;
  last_related_intents: string[];
}

export const EMPTY_SESSION_CONTEXT: PublicSessionContext = {
  last_intent_key: null,
  last_intent_group: null,
  last_module: null,
  last_answered_entry_id: null,
  last_related_intents: [],
};

interface HistoryMessage {
  role: string;
  content: string;
  metadata?: {
    knowledgeEntryId?: string | null;
    sessionContext?: PublicSessionContext | null;
  } | null;
}

const FOLLOW_UP_PRONOUN =
  /\b(that|it|this|those|they|them|same|also|too)\b/i;

const PRICING_FOLLOW_UP =
  /\b(yearly|monthly|pay|billing|cost|price|plan|package|starter|free)\b/i;

export function extractPublicSessionContext(
  history: HistoryMessage[],
  entriesById?: Map<string, AIKnowledgeEntry>
): PublicSessionContext {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg?.role !== "assistant") continue;

    const stored = msg.metadata?.sessionContext;
    if (stored?.last_intent_key) return stored;

    const entryId = msg.metadata?.knowledgeEntryId;
    if (entryId && entriesById?.has(entryId)) {
      return sessionContextFromEntry(entriesById.get(entryId)!, entryId);
    }
  }

  return { ...EMPTY_SESSION_CONTEXT };
}

export function sessionContextFromEntry(
  entry: AIKnowledgeEntry,
  entryId?: string
): PublicSessionContext {
  return {
    last_intent_key: entry.intent_key ?? null,
    last_intent_group: entry.intent_group ?? entry.category ?? null,
    last_module: entry.intent_group ?? entry.category ?? null,
    last_answered_entry_id: entryId ?? entry.id,
    last_related_intents: entry.related_intents ?? [],
  };
}

export function isFollowUpQuery(query: string): boolean {
  return FOLLOW_UP_PRONOUN.test(query);
}

export function expandQueryWithSession(
  query: string,
  session: PublicSessionContext
): string {
  const trimmed = query.trim();
  if (!session.last_intent_key && !session.last_intent_group) return trimmed;

  const parts = [trimmed];

  if (isFollowUpQuery(trimmed) || PRICING_FOLLOW_UP.test(trimmed)) {
    const def = session.last_intent_key
      ? getIntentDefinition(session.last_intent_key)
      : undefined;

    if (def) {
      parts.push(def.name, ...def.matchTerms.slice(0, 3));
    } else if (session.last_intent_group) {
      parts.push(session.last_intent_group);
    }

    if (session.last_related_intents.length > 0) {
      for (const key of session.last_related_intents.slice(0, 3)) {
        const related = getIntentDefinition(key);
        if (related) parts.push(related.name);
      }
    }
  } else if (
    session.last_intent_group &&
    PRICING_FOLLOW_UP.test(trimmed) &&
    session.last_intent_group.toLowerCase() === "pricing"
  ) {
    parts.push("pricing", session.last_intent_group);
  }

  return parts.join(" ");
}

export function conversationContextBoost(
  entry: AIKnowledgeEntry,
  session: PublicSessionContext
): number {
  if (!session.last_intent_key && !session.last_intent_group) return 0;

  let boost = 0;

  if (
    session.last_intent_key &&
    entry.intent_key === session.last_intent_key
  ) {
    boost += 0.08;
  }

  if (
    session.last_intent_group &&
    entry.intent_group === session.last_intent_group
  ) {
    boost += 0.05;
  }

  if (
    session.last_related_intents.length > 0 &&
    entry.intent_key &&
    session.last_related_intents.includes(entry.intent_key)
  ) {
    boost += 0.04;
  }

  if (
    session.last_answered_entry_id &&
    entry.id === session.last_answered_entry_id
  ) {
    boost += 0.03;
  }

  return boost;
}
