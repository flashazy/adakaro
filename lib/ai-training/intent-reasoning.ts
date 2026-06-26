import { normalizeText } from "./knowledge-scoring";
import {
  getIntentDefinition,
  INTENT_REGISTRY,
  type IntentDefinition,
} from "./intent-registry";
import type { PublicSessionContext } from "./public-session-memory";
import type { IntentLearningOverrides } from "./learning-types";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import { resolveEntryIntent } from "./intent-registry";

export interface IntentReasonSignal {
  type:
    | "trigger_match"
    | "negative_penalty"
    | "related_intent"
    | "session_boost"
    | "selection_reason";
  intentKey: string;
  phrase?: string;
  detail: string;
}

export interface IntentSignalAnalysis {
  intentKey: string;
  triggerMatches: string[];
  negativeMatches: string[];
  keywordMatches: string[];
  triggerBoost: number;
  negativePenalty: number;
  keywordBoost: number;
  netSignalScore: number;
}

const TRIGGER_BOOST = 0.14;
const KEYWORD_BOOST = 0.08;
const NEGATIVE_PENALTY = 0.18;
const RELATED_INTENT_BOOST = 0.06;
const SESSION_INTENT_BOOST = 0.05;
const MAX_TRIGGER_STACK = 4;

function findMatchingPhrases(normalizedQuery: string, phrases: string[]): string[] {
  const matches: string[] = [];

  for (const phrase of phrases) {
    const normalized = normalizeText(phrase);
    if (normalized.length >= 3 && normalizedQuery.includes(normalized)) {
      matches.push(phrase);
    }
  }

  return [...new Set(matches)].sort((a, b) => b.length - a.length);
}

function allPhrasesForIntent(
  intent: IntentDefinition,
  overrides?: IntentLearningOverrides
): {
  triggers: string[];
  negatives: string[];
  keywords: string[];
} {
  const learnedTriggers = overrides?.triggerPhrases.get(intent.key) ?? [];
  const learnedNegatives = overrides?.negativePhrases.get(intent.key) ?? [];

  return {
    triggers: [
      ...(intent.triggerPhrases ?? []),
      ...intent.matchTerms,
      ...learnedTriggers,
    ],
    negatives: [...(intent.negativePhrases ?? []), ...learnedNegatives],
    keywords: intent.intentKeywords ?? [],
  };
}

export function analyzeIntentSignals(
  query: string,
  intentKey: string,
  overrides?: IntentLearningOverrides
): IntentSignalAnalysis {
  const intent = getIntentDefinition(intentKey);
  const empty: IntentSignalAnalysis = {
    intentKey,
    triggerMatches: [],
    negativeMatches: [],
    keywordMatches: [],
    triggerBoost: 0,
    negativePenalty: 0,
    keywordBoost: 0,
    netSignalScore: 0,
  };

  if (!intent) return empty;

  const normalizedQuery = normalizeText(query);
  const { triggers, negatives, keywords } = allPhrasesForIntent(intent, overrides);

  const triggerMatches = findMatchingPhrases(normalizedQuery, triggers);
  const negativeMatches = findMatchingPhrases(normalizedQuery, negatives);
  const keywordMatches = findMatchingPhrases(normalizedQuery, keywords);

  const stackedTriggers = Math.min(triggerMatches.length, MAX_TRIGGER_STACK);
  const triggerBoost = stackedTriggers * TRIGGER_BOOST;
  const keywordBoost = Math.min(keywordMatches.length, 3) * KEYWORD_BOOST;
  const negativePenalty = negativeMatches.length * NEGATIVE_PENALTY;

  const netSignalScore = Math.max(
    0,
    triggerBoost + keywordBoost - negativePenalty
  );

  return {
    intentKey,
    triggerMatches,
    negativeMatches,
    keywordMatches,
    triggerBoost,
    negativePenalty,
    keywordBoost,
    netSignalScore,
  };
}

export function collectCandidateIntentKeysFromQuery(
  query: string,
  ranked: RankedKnowledgeEntry[],
  session?: PublicSessionContext,
  overrides?: IntentLearningOverrides
): string[] {
  const keys = new Set<string>();

  for (const candidate of ranked.slice(0, 5)) {
    const intent = resolveEntryIntent(candidate.entry);
    if (intent.intent_key) keys.add(intent.intent_key);
    for (const related of intent.related_intents ?? []) {
      keys.add(related);
    }
  }

  for (const intent of INTENT_REGISTRY) {
    const analysis = analyzeIntentSignals(query, intent.key, overrides);
    if (
      analysis.triggerMatches.length > 0 ||
      analysis.keywordMatches.length > 0
    ) {
      keys.add(intent.key);
    }
    for (const related of intent.relatedIntents) {
      keys.add(related);
    }
  }

  if (session?.last_intent_key) keys.add(session.last_intent_key);
  for (const related of session?.last_related_intents ?? []) {
    keys.add(related);
  }

  return [...keys];
}

export interface IntentReasoningResult {
  ranked: RankedKnowledgeEntry[];
  signals: IntentReasonSignal[];
  intentAnalyses: Map<string, IntentSignalAnalysis>;
  selectionSummary: string | null;
}

function pushSignal(
  signals: IntentReasonSignal[],
  signal: IntentReasonSignal
): void {
  signals.push(signal);
}

export function applyIntentReasoning(
  query: string,
  ranked: RankedKnowledgeEntry[],
  session?: PublicSessionContext,
  overrides?: IntentLearningOverrides
): IntentReasoningResult {
  const signals: IntentReasonSignal[] = [];
  const intentKeys = collectCandidateIntentKeysFromQuery(
    query,
    ranked,
    session,
    overrides
  );
  const intentAnalyses = new Map<string, IntentSignalAnalysis>();

  for (const intentKey of intentKeys) {
    const analysis = analyzeIntentSignals(query, intentKey, overrides);
    intentAnalyses.set(intentKey, analysis);

    for (const phrase of analysis.triggerMatches) {
      pushSignal(signals, {
        type: "trigger_match",
        intentKey,
        phrase,
        detail: `Matched trigger phrase: "${phrase}"`,
      });
    }

    for (const phrase of analysis.negativeMatches) {
      pushSignal(signals, {
        type: "negative_penalty",
        intentKey,
        phrase,
        detail: `Negative phrase for ${intentKey}: "${phrase}"`,
      });
    }
  }

  const rescored = ranked.map((candidate) => {
    const intent = resolveEntryIntent(candidate.entry);
    const intentKey = intent.intent_key;
    if (!intentKey) return candidate;

    const analysis = intentAnalyses.get(intentKey);
    let adjustedScore = candidate.score;
    let reasoningBoost = 0;

    if (analysis) {
      reasoningBoost += analysis.netSignalScore;
    }

    for (const relatedKey of intent.related_intents ?? []) {
      const relatedAnalysis = intentAnalyses.get(relatedKey);
      if (!relatedAnalysis) continue;

      if (
        relatedAnalysis.triggerMatches.length > 0 &&
        relatedKey !== intentKey
      ) {
        reasoningBoost -= RELATED_INTENT_BOOST * 0.5;
        pushSignal(signals, {
          type: "related_intent",
          intentKey,
          detail: `Related intent considered: ${relatedKey}`,
        });
      }
    }

    if (
      session?.last_intent_key &&
      (session.last_intent_key === intentKey ||
        session.last_related_intents.includes(intentKey))
    ) {
      reasoningBoost += SESSION_INTENT_BOOST;
      pushSignal(signals, {
        type: "session_boost",
        intentKey,
        detail: `Session context favors ${intentKey}`,
      });
    }

    adjustedScore = Math.min(1, adjustedScore + reasoningBoost);

    return {
      ...candidate,
      score: adjustedScore,
      breakdown: {
        ...candidate.breakdown,
        score: adjustedScore,
      },
    };
  });

  rescored.sort((a, b) => b.score - a.score);

  const winner = rescored[0];
  let selectionSummary: string | null = null;

  if (winner) {
    const winnerIntent = resolveEntryIntent(winner.entry);
    const winnerKey = winnerIntent.intent_key;
    const winnerAnalysis = winnerKey
      ? intentAnalyses.get(winnerKey)
      : undefined;

    if (winnerKey && winnerAnalysis) {
      const triggerSummary =
        winnerAnalysis.triggerMatches.length > 0
          ? winnerAnalysis.triggerMatches.slice(0, 3).join(", ")
          : null;

      const relatedConsidered = [...intentKeys]
        .filter((k) => k !== winnerKey)
        .slice(0, 3);

      const def = getIntentDefinition(winnerKey);
      selectionSummary = [
        triggerSummary
          ? `Matched phrases: ${triggerSummary}`
          : null,
        relatedConsidered.length > 0
          ? `Related intents considered: ${relatedConsidered.join(", ")}`
          : null,
        def?.disambiguationHint
          ? `Selected ${winnerKey} — ${def.disambiguationHint}`
          : `Selected ${winnerKey}`,
      ]
        .filter(Boolean)
        .join(". ");

      pushSignal(signals, {
        type: "selection_reason",
        intentKey: winnerKey,
        detail: selectionSummary,
      });
    }
  }

  return {
    ranked: rescored,
    signals,
    intentAnalyses,
    selectionSummary,
  };
}

export function buildRelatedIntentClarification(
  intentKeys: string[]
): string | null {
  const unique = [...new Set(intentKeys)].slice(0, 2);
  if (unique.length !== 2) return null;

  const hints = unique
    .map((key) => getIntentDefinition(key))
    .filter(Boolean) as IntentDefinition[];

  if (hints.length !== 2) return null;

  const archiveHistoryPair =
    unique.includes("student.archive_inactive") &&
    unique.includes("student.class_history");

  if (archiveHistoryPair) {
    return "Did you mean **hiding/deactivating a student while keeping records**, or **viewing a student's class movement history**?";
  }

  return `Did you mean **${hints[0]!.disambiguationHint ?? hints[0]!.name}**, or **${hints[1]!.disambiguationHint ?? hints[1]!.name}**?`;
}
