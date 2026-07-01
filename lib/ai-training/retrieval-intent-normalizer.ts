/**
 * Maps common visitor phrasing to canonical knowledge questions before retrieval.
 */

import { normalizeText } from "./knowledge-scoring";

export interface RetrievalIntentNormalization {
  originalQuery: string;
  /** Query passed to ranking (unchanged unless we add hints later). */
  scoringQuery: string;
  /** Canonical lesson question when a broad identity phrase maps to a known entry. */
  canonicalQuestion: string | null;
  /** User explicitly asked about the Adakaro AI child entity. */
  mentionsAdakaroAi: boolean;
  /** User mentioned Adakaro without the AI child entity. */
  mentionsAdakaroOnly: boolean;
}

const CANONICAL_WHAT_IS_ADAKARO = "What is Adakaro?";
const CANONICAL_WHO_IS_ADAKARO_AI = "Who is Adakaro AI?";

const IDENTITY_OPENERS =
  /^(?:(?:what(?:'s|\s+is)|who(?:'s|\s+is)|tell\s+me\s+about|explain|describe|give\s+me\s+an\s+overview\s+of|overview\s+of|what\s+exactly\s+is|can\s+you\s+(?:explain|describe|tell\s+me\s+about)))\s+/i;

export function mentionsAdakaroAi(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  if (/\badakaro ai\b/.test(normalized) || /\badakaros ai\b/.test(normalized)) {
    return true;
  }

  if (/\bai assistant\b/.test(normalized)) return true;
  if (/\badakaro copilot\b/.test(normalized)) return true;

  return /\badakaro\b/.test(normalized) && /\b(ai|copilot|assistant)\b/.test(normalized);
}

export function mentionsAdakaroPlatform(text: string): boolean {
  return /\badakaro\b/i.test(text);
}

function isBroadIdentityQuery(normalized: string): boolean {
  return (
    IDENTITY_OPENERS.test(normalized) ||
    /^(tell me about|explain|describe)\s+/.test(normalized) ||
    /^give me an overview of\s+/.test(normalized) ||
    /^what exactly is\s+/.test(normalized)
  );
}

/** Capability, process, and eligibility questions keep their own target entries. */
function isSpecificIntentQuery(normalized: string): boolean {
  return (
    /^what can\b/.test(normalized) ||
    /^how (?:do i|can i|to)\b/.test(normalized) ||
    /^can i\b/.test(normalized) ||
    /^does\b/.test(normalized) ||
    /^is there\b/.test(normalized) ||
    /\bmigrate\b/.test(normalized) ||
    /\bpricing\b/.test(normalized) ||
    /\bcost\b/.test(normalized) ||
    /\bget started\b/.test(normalized) ||
    /\bupload\b/.test(normalized) ||
    /\bimport\b/.test(normalized)
  );
}

function resolveCanonicalQuestion(
  trimmed: string,
  normalized: string,
  ai: boolean,
  platform: boolean
): string | null {
  if (!platform && !ai) return null;
  if (isSpecificIntentQuery(normalized)) return null;

  if (ai) {
    if (
      isBroadIdentityQuery(normalized) ||
      /^what is adakaro ai\??$/.test(normalized) ||
      /^who is adakaro ai\??$/.test(normalized) ||
      /\bai assistant\b/.test(normalized)
    ) {
      return CANONICAL_WHO_IS_ADAKARO_AI;
    }
    return null;
  }

  if (platform && isBroadIdentityQuery(normalized)) {
    return CANONICAL_WHAT_IS_ADAKARO;
  }

  if (/^(tell me about|explain|describe)\s+adakaro\??$/i.test(trimmed)) {
    return CANONICAL_WHAT_IS_ADAKARO;
  }

  return null;
}

export function normalizeRetrievalIntent(query: string): RetrievalIntentNormalization {
  const trimmed = query.trim();
  const normalized = normalizeText(trimmed);
  const ai = mentionsAdakaroAi(trimmed);
  const platform = mentionsAdakaroPlatform(trimmed);
  const mentionsAdakaroOnly = platform && !ai;

  return {
    originalQuery: trimmed,
    scoringQuery: trimmed,
    canonicalQuestion: resolveCanonicalQuestion(trimmed, normalized, ai, platform),
    mentionsAdakaroAi: ai,
    mentionsAdakaroOnly,
  };
}
