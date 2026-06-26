import {
  CLARIFICATION_AMBIGUITY_GAP,
  MAX_CLARIFICATION_OPTIONS,
} from "./retrieval-config";
import { resolveEntryIntent } from "./intent-registry";
import type { RankedKnowledgeEntry } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export interface ClarificationOption {
  intentKey: string | null;
  intentName: string;
  question: string;
  entryId: string;
}

export interface ClarificationResult {
  message: string;
  options: ClarificationOption[];
  topScore: number;
}

function optionLabel(entry: AIKnowledgeEntry): string {
  const intent = resolveEntryIntent(entry);
  return intent.intent_name ?? entry.question.replace(/\?+$/, "");
}

export function buildClarificationMessage(
  options: ClarificationOption[]
): string {
  if (options.length === 0) {
    return "I'm not sure I understood your question. Could you rephrase it?";
  }

  if (options.length === 1) {
    return `Did you mean **${options[0]!.intentName}**?`;
  }

  const labels = options.map((o) => o.intentName);
  if (labels.length === 2) {
    return `Did you mean **${labels[0]}** or **${labels[1]}**?`;
  }

  const last = labels.pop();
  return `Did you mean ${labels.map((l) => `**${l}**`).join(", ")}, or **${last}**?`;
}

export function shouldClarify(
  ranked: RankedKnowledgeEntry[],
  topScore: number
): boolean {
  if (topScore >= MATCH_SCORE_THRESHOLD) return false;
  if (ranked.length < 2) return false;

  const second = ranked[1]?.score ?? 0;
  const gap = topScore - second;

  return (
    topScore > 0 &&
    gap < CLARIFICATION_AMBIGUITY_GAP &&
    ranked.filter(
      (r) => topScore - r.score <= CLARIFICATION_AMBIGUITY_GAP
    ).length >= 2
  );
}

export function buildClarificationFromCandidates(
  candidates: RankedKnowledgeEntry[]
): ClarificationResult | null {
  if (candidates.length < 2) return null;

  const topScore = candidates[0]!.score;
  if (!shouldClarify(candidates, topScore)) return null;

  const ambiguous = candidates.filter(
    (c) => topScore - c.score <= CLARIFICATION_AMBIGUITY_GAP
  );

  const seenIntents = new Set<string>();
  const options: ClarificationOption[] = [];

  for (const candidate of ambiguous) {
    const intent = resolveEntryIntent(candidate.entry);
    const dedupeKey = intent.intent_key ?? candidate.entry.id;
    if (seenIntents.has(dedupeKey)) continue;
    seenIntents.add(dedupeKey);

    options.push({
      intentKey: intent.intent_key,
      intentName: optionLabel(candidate.entry),
      question: candidate.entry.question,
      entryId: candidate.entry.id,
    });

    if (options.length >= MAX_CLARIFICATION_OPTIONS) break;
  }

  if (options.length < 2) return null;

  return {
    message: buildClarificationMessage(options),
    options,
    topScore,
  };
}

export function formatClarificationAnswer(result: ClarificationResult): string {
  return result.message;
}
