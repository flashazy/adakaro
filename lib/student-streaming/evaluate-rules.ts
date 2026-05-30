import type {
  DivisionStreamingRule,
  NumericStreamingRule,
  StreamingPerformanceMeasure,
  StreamingRuleEntry,
  StudentStreamingPerformance,
} from "@/lib/student-streaming/types";

export function isDivisionRule(
  rule: StreamingRuleEntry
): rule is DivisionStreamingRule {
  return "divisions" in rule && Array.isArray(rule.divisions);
}

export function isNumericRule(
  rule: StreamingRuleEntry
): rule is NumericStreamingRule {
  return "min" in rule && "max" in rule;
}

export function formatPerformanceValue(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance
): string | null {
  if (performance.subjectsScored === 0) return null;
  switch (measure) {
    case "average_score":
      return performance.averageScorePercent != null
        ? `${performance.averageScorePercent}%`
        : null;
    case "total_marks":
      return performance.totalMarks != null
        ? String(Math.round(performance.totalMarks))
        : null;
    case "division":
      return performance.division != null
        ? performance.division === "INC" || performance.division === "ABS"
          ? performance.division
          : `Division ${performance.division}`
        : null;
    default:
      return null;
  }
}

export function recommendStreamClassId(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  rules: StreamingRuleEntry[]
): string | null {
  if (performance.subjectsScored === 0 || rules.length === 0) return null;

  if (measure === "division") {
    const division = (performance.division ?? "").trim();
    if (!division) return null;
    for (const rule of rules) {
      if (!isDivisionRule(rule)) continue;
      const normalized = rule.divisions.map((d) => d.trim().toUpperCase());
      if (normalized.includes(division.toUpperCase())) {
        return rule.targetClassId;
      }
    }
    return null;
  }

  const value =
    measure === "average_score"
      ? performance.averageScorePercent
      : performance.totalMarks;
  if (value == null || !Number.isFinite(value)) return null;

  for (const rule of rules) {
    if (!isNumericRule(rule)) continue;
    if (value >= rule.min && value <= rule.max) {
      return rule.targetClassId;
    }
  }
  return null;
}

export function buildPlacementPreview(
  students: { recommendedClassId: string | null; recommendedClassName: string | null }[],
  streamNameById: Map<string, string>
): { targetClassId: string; targetClassName: string; studentCount: number }[] {
  const counts = new Map<string, number>();
  for (const s of students) {
    if (!s.recommendedClassId) continue;
    counts.set(
      s.recommendedClassId,
      (counts.get(s.recommendedClassId) ?? 0) + 1
    );
  }
  return [...counts.entries()]
    .map(([targetClassId, studentCount]) => ({
      targetClassId,
      targetClassName: streamNameById.get(targetClassId) ?? "Unknown",
      studentCount,
    }))
    .sort((a, b) => a.targetClassName.localeCompare(b.targetClassName));
}
