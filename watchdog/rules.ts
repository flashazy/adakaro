import type { FeatureRule } from "./types";

/**
 * Central, extend-only configuration: add features here without touching detector logic.
 * Detector reads these keys dynamically.
 */
export const WATCHDOG_RULES: Record<string, FeatureRule> = {
  receipt_generation: {
    admin: { must_have_logo: true },
    parent: { must_have_logo: true },
  },
  parent_request_submission: {
    parent: { must_succeed: true },
  },
  payment_flow: {
    parent: { must_complete: true },
  },
};

export function getRuleForFeature(feature: string): FeatureRule | undefined {
  return WATCHDOG_RULES[feature];
}
