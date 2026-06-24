/**
 * Copilot intent classification — determines WHAT the user wants before routing.
 */

import type { CopilotIntentType } from "@/lib/ai/adakaro-registry";
import { findRegistryCard, findRegistryModule } from "@/lib/ai/adakaro-registry";

export interface ClassifiedIntent {
  type: CopilotIntentType;
  confidence: "high" | "medium" | "low";
  /** Human-readable reason for debug logging. */
  reason: string;
}

const EXPLANATION_RE =
  /^(what is|what are|what's|explain|tell me about|how does|how do|describe|define)\b/i;

const COMPARISON_RE =
  /\b(compare|compared to|versus|vs\.?|difference between|against last)\b/i;

const ANALYSIS_RE =
  /\b(which (class|classes|student|students)|struggling|underperform|at risk|worst|best performing|analyze|analysis|insight)\b/i;

const REPORT_RE =
  /\b(generate|export|download|print)\b.*\b(report|summary)\b|\b(report|summary)\b.*\b(generate|export|download)\b/i;

const ACTION_RE =
  /\b(open|go to|take me to|navigate to|show me the|launch)\b/i;

const DATA_LOOKUP_RE =
  /\b(how many|how much|show|list|total|count|what is the|what are the|give me|get me)\b/i;

const REFINEMENT_RE =
  /^(only|just|filter|sort|top \d+|export|compare)\b/i;

/**
 * Classify the user's intent from their message.
 * Registry matches inform the default when no explicit pattern matches.
 */
export function classifyCopilotIntent(message: string): ClassifiedIntent {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { type: "navigation", confidence: "low", reason: "empty message" };
  }

  if (REFINEMENT_RE.test(lower)) {
    return { type: "data_lookup", confidence: "medium", reason: "refinement follow-up" };
  }

  if (EXPLANATION_RE.test(lower)) {
    return { type: "explanation", confidence: "high", reason: "explanation phrase" };
  }

  if (COMPARISON_RE.test(lower)) {
    return { type: "comparison", confidence: "high", reason: "comparison phrase" };
  }

  if (ANALYSIS_RE.test(lower)) {
    return { type: "analysis", confidence: "high", reason: "analysis phrase" };
  }

  if (REPORT_RE.test(lower)) {
    return { type: "report_request", confidence: "high", reason: "report request phrase" };
  }

  if (ACTION_RE.test(lower)) {
    return { type: "navigation", confidence: "high", reason: "navigation action phrase" };
  }

  // Card with data tool + data-lookup phrasing → data
  const cardMatch = findRegistryCard(lower);
  if (cardMatch?.card.dataTool && DATA_LOOKUP_RE.test(lower)) {
    return {
      type: "data_lookup",
      confidence: "high",
      reason: `data lookup for card: ${cardMatch.card.label}`,
    };
  }

  // Bare card name (e.g. "Monthly income", "Outstanding") → data lookup
  if (cardMatch && cardMatch.score >= 4 && cardMatch.card.dataTool) {
    const isBareCard =
      lower.split(/\s+/).length <= 3 ||
      cardMatch.score >= lower.trim().length - 2;
    if (isBareCard) {
      return {
        type: "data_lookup",
        confidence: "high",
        reason: `bare card match: ${cardMatch.card.label}`,
      };
    }
  }

  if (DATA_LOOKUP_RE.test(lower)) {
    return { type: "data_lookup", confidence: "medium", reason: "data lookup phrase" };
  }

  // Module name without data phrasing → navigation
  const moduleMatch = findRegistryModule(lower);
  if (moduleMatch) {
    const isBareModule =
      lower.split(/\s+/).length <= 4 ||
      moduleMatch.keywords.some((k) => lower.trim() === k.toLowerCase());
    if (isBareModule) {
      return {
        type: "navigation",
        confidence: "high",
        reason: `module name: ${moduleMatch.name}`,
      };
    }
  }

  // Card without data tool → explanation
  if (cardMatch?.card.explanationOnly) {
    return {
      type: "explanation",
      confidence: "high",
      reason: `metric explanation: ${cardMatch.card.label}`,
    };
  }

  return { type: "navigation", confidence: "low", reason: "default" };
}
