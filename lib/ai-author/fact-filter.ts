/**
 * Fact Filter — safe acceptance for facts from selected published lessons.
 */

import type { QuestionContext } from "./context-engine";
import { explainFactDecision } from "./fact-explainer";
import { isValidFactText } from "./fact-extractor";
import type { FactRejectionReason, ScoredFact } from "./types";
import { FACT_SCORE_THRESHOLD } from "./types";

export interface FilterFactsResult {
  kept: ScoredFact[];
  discarded: ScoredFact[];
}

export interface FilterFactsOptions {
  threshold?: number;
  selectedLessonIds?: Set<string>;
}

function isWrongIntentBlock(fact: ScoredFact): boolean {
  return (fact.scoreBreakdown?.penalties ?? 0) >= 50;
}

function passesSafeAcceptance(
  fact: ScoredFact,
  context: QuestionContext,
  selectedLessonIds: Set<string>
): boolean {
  if (!selectedLessonIds.has(fact.sourceEntryId)) return false;
  if (!isValidFactText(fact.text)) return false;

  const breakdown = fact.scoreBreakdown;
  if (!breakdown) return false;
  if (breakdown.penalties >= 50) return false;
  if (breakdown.evidence < 40) return false;

  const entityOk = breakdown.entity >= 35 || context.route.entity === "Topic";
  const intentOk = breakdown.intent >= 30;
  const provenanceOk = breakdown.lessonProvenance >= 25;

  return entityOk && intentOk && provenanceOk;
}

export function filterFacts(
  facts: ScoredFact[],
  context: QuestionContext,
  minScore: number = FACT_SCORE_THRESHOLD,
  options?: FilterFactsOptions
): FilterFactsResult {
  const kept: ScoredFact[] = [];
  const discarded: ScoredFact[] = [];
  const threshold = options?.threshold ?? minScore;
  const selectedLessonIds = options?.selectedLessonIds ?? new Set(facts.map((f) => f.sourceEntryId));

  for (const fact of facts) {
    if (!isValidFactText(fact.text)) {
      discarded.push({
        ...fact,
        discarded: true,
        rejectionCategory: "empty_text" as FactRejectionReason,
        discardReason: explainFactDecision({
          fact,
          context,
          used: false,
          rejectionCategory: "empty_text",
          threshold,
        }),
      });
      continue;
    }

    const wrongIntent = isWrongIntentBlock(fact);
    const belowThreshold = fact.relevanceScore < threshold;
    const safeAccept = passesSafeAcceptance(fact, context, selectedLessonIds);

    if (wrongIntent) {
      discarded.push({
        ...fact,
        discarded: true,
        rejectionCategory: "wrong_intent",
        discardReason: explainFactDecision({
          fact,
          context,
          used: false,
          blocked: true,
          threshold,
          rejectionCategory: "wrong_intent",
        }),
      });
      continue;
    }

    if (safeAccept || !belowThreshold) {
      kept.push(fact);
      continue;
    }

    const rejectionCategory: FactRejectionReason =
      (fact.scoreBreakdown?.evidence ?? 0) < 40 ? "missing_evidence" : "low_confidence";

    discarded.push({
      ...fact,
      discarded: true,
      rejectionCategory,
      discardReason: explainFactDecision({
        fact,
        context,
        used: false,
        belowThreshold: true,
        threshold,
        rejectionCategory,
      }),
    });
  }

  return { kept, discarded };
}

export function buildFallbackPool(
  discarded: ScoredFact[],
  minFallbackScore: number = 25
): ScoredFact[] {
  return discarded
    .filter(
      (f) =>
        f.relevanceScore >= minFallbackScore &&
        (f.rejectionCategory === "low_confidence" || f.rejectionCategory === "missing_evidence")
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
