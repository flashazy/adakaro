import { isStaleSubject } from "@/lib/curriculum-coverage/stale";
import type {
  CurriculumCoverageKpis,
  CurriculumCoverageRow,
  CurriculumHealth,
} from "@/lib/curriculum-coverage/types";

function healthLabel(score: number): CurriculumHealth["label"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs_attention";
  return "critical";
}

export function computeCurriculumHealth(
  rows: CurriculumCoverageRow[],
  kpis: CurriculumCoverageKpis
): CurriculumHealth {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  if (active.length === 0) {
    return { score: 0, label: "needs_attention" };
  }

  const atRiskRatio =
    active.filter((r) => r.status === "at_risk").length / active.length;
  const staleRatio =
    active.filter((r) => isStaleSubject(r.lastUpdateAt)).length /
    active.length;
  const onTrackRatio =
    (kpis.subjectsOnTrack + kpis.completedSubjects) / active.length;

  const coverageScore = kpis.overallCoveragePercent;
  const atRiskScore = Math.max(0, 100 - atRiskRatio * 200);
  const freshnessScore = Math.max(0, 100 - staleRatio * 150);
  const momentumScore = onTrackRatio * 100;

  const score = Math.round(
    coverageScore * 0.35 +
      atRiskScore * 0.25 +
      freshnessScore * 0.25 +
      momentumScore * 0.15
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    label: healthLabel(score),
  };
}

export function curriculumHealthLabel(label: CurriculumHealth["label"]): string {
  switch (label) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs_attention":
      return "Needs Attention";
    default:
      return "Critical";
  }
}
