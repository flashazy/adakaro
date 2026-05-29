import type { PromotionDecision } from "@/lib/promotions/types";
import type { ResolvedPromotionRule } from "@/lib/promotions/resolve-promotion-rule";

/**
 * Suggest promote vs repeat from average exam grade. Graduate is never auto-suggested.
 * When there is no minimum threshold (no rule or rule.minAverageGrade is null),
 * students with a Term 2 average default to promote; missing averages default to repeat.
 */
export function suggestPromotionDecision(
  averagePercent: number | null,
  rule: ResolvedPromotionRule | null
): PromotionDecision {
  if (averagePercent == null) {
    return "repeat";
  }
  if (rule == null || rule.minAverageGrade == null) {
    return "promote";
  }
  return averagePercent >= rule.minAverageGrade ? "promote" : "repeat";
}

export function formatGradeHint(
  averagePercent: number | null,
  rule: ResolvedPromotionRule | null,
  decision: PromotionDecision
): string {
  if (averagePercent == null) {
    return "No scores recorded";
  }
  const action =
    decision === "promote"
      ? "Promote"
      : decision === "repeat"
        ? "Repeat"
        : "Graduate";
  if (rule == null || rule.minAverageGrade == null) {
    return `${averagePercent}% overall (no minimum set) → ${action}`;
  }
  const cmp =
    averagePercent >= rule.minAverageGrade
      ? `≥${rule.minAverageGrade}%`
      : `<${rule.minAverageGrade}%`;
  return `${averagePercent}% overall (${cmp}) → ${action}`;
}
