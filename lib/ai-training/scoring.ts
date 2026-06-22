import type { AIKnowledgeEntry } from "./types";
import { MATCH_SCORE_THRESHOLD } from "./types";

export type QualityLevel = "excellent" | "good" | "needs_improvement";
export type HealthStatus = "excellent" | "good" | "needs_training";

export function computeEntryQuality(entry: AIKnowledgeEntry): {
  score: number;
  level: QualityLevel;
} {
  let score = 0;

  if (entry.keywords.length >= 6) score += 25;
  else if (entry.keywords.length >= 3) score += 15;
  else if (entry.keywords.length >= 1) score += 8;

  if (entry.search_phrases.length >= 3) score += 20;
  else if (entry.search_phrases.length >= 1) score += 10;

  if (entry.alternative_wording.length >= 2) score += 15;
  else if (entry.alternative_wording.length >= 1) score += 8;

  if (entry.related_terms.length >= 3) score += 10;
  if (entry.answer.trim().length >= 120) score += 15;
  if (entry.usage_count >= 5) score += 15;
  else if (entry.usage_count >= 1) score += 8;

  if (entry.priority === "high" || entry.priority === "critical") score += 5;

  const level: QualityLevel =
    score >= 75 ? "excellent" : score >= 45 ? "good" : "needs_improvement";

  return { score: Math.min(100, score), level };
}

export function computeEntrySuccessRate(
  entry: AIKnowledgeEntry,
  avgMatchScore: number | null
): number {
  if (entry.usage_count === 0) return 0;
  if (avgMatchScore != null) {
    return Math.round(Math.min(100, avgMatchScore * 100));
  }
  return entry.usage_count > 0 ? 72 : 0;
}

export function computeAIHealthScore(input: {
  knowledgeCoveragePercent: number;
  pendingUnansweredCount: number;
  totalUnansweredCount: number;
  activeKnowledgeEntries: number;
  recentTrainingActions: number;
}): { score: number; status: HealthStatus } {
  const coverageScore = input.knowledgeCoveragePercent;

  const unansweredRate =
    input.totalUnansweredCount + input.activeKnowledgeEntries === 0
      ? 0
      : Math.round(
          (input.pendingUnansweredCount /
            Math.max(1, input.totalUnansweredCount + input.activeKnowledgeEntries)) *
            100
        );
  const unansweredScore = Math.max(0, 100 - unansweredRate * 2);

  const activityScore = Math.min(
    100,
    input.recentTrainingActions * 15 + (input.activeKnowledgeEntries > 0 ? 25 : 0)
  );

  const score = Math.round(
    coverageScore * 0.4 + unansweredScore * 0.35 + activityScore * 0.25
  );

  const status: HealthStatus =
    score >= 80 ? "excellent" : score >= 55 ? "good" : "needs_training";

  return { score, status };
}

export function qualityLabel(level: QualityLevel): string {
  switch (level) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    default:
      return "Needs Improvement";
  }
}

export function healthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    default:
      return "Needs Training";
  }
}

export { MATCH_SCORE_THRESHOLD };
