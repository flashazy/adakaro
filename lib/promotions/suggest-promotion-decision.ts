import type { PromotionDecision } from "@/lib/promotions/types";
import type { ResolvedPromotionRule } from "@/lib/promotions/resolve-promotion-rule";

/**
 * Suggest promote vs repeat from average exam grade. Graduate is never auto-suggested.
 */
export function suggestPromotionDecision(
  averagePercent: number | null,
  rule: ResolvedPromotionRule
): PromotionDecision {
  if (averagePercent == null) {
    return "repeat";
  }
  return averagePercent >= rule.minAverageGrade ? "promote" : "repeat";
}

export function formatGradeHint(
  averagePercent: number | null,
  rule: ResolvedPromotionRule,
  decision: PromotionDecision
): string {
  if (averagePercent == null) {
    return "No scores recorded";
  }
  const cmp =
    averagePercent >= rule.minAverageGrade
      ? `≥${rule.minAverageGrade}%`
      : `<${rule.minAverageGrade}%`;
  const action =
    decision === "promote"
      ? "Promote"
      : decision === "repeat"
        ? "Repeat"
        : "Graduate";
  return `${averagePercent}% overall (${cmp}) → ${action}`;
}
