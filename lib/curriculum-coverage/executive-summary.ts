import type {
  CurriculumCoverageKpis,
  CurriculumCoverageRow,
  CurriculumHealth,
} from "@/lib/curriculum-coverage/types";
import { curriculumHealthLabel } from "@/lib/curriculum-coverage/health-score";

export function buildExecutiveSummary(
  rows: CurriculumCoverageRow[],
  kpis: CurriculumCoverageKpis,
  health: CurriculumHealth
): string[] {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  if (active.length === 0) {
    return [
      "No curriculum coverage records are available yet. Teachers can begin updating progress from their dashboard.",
    ];
  }

  const summaries: string[] = [];
  const atRisk = active.filter((r) => r.status === "at_risk").length;
  const needsAttention = active.filter((r) => r.status === "needs_attention");
  const onTrackOrDone = active.filter(
    (r) => r.status === "on_track" || r.status === "completed"
  ).length;
  const onTrackRatio = onTrackOrDone / active.length;

  if (onTrackRatio >= 0.7) {
    summaries.push(
      "Most subjects are progressing normally across the school."
    );
  } else {
    summaries.push(
      "Several subjects require closer monitoring this term."
    );
  }

  if (needsAttention.length > 0) {
    const worst = [...needsAttention].sort(
      (a, b) => a.coveragePercent - b.coveragePercent
    )[0];
    summaries.push(
      `${worst.subjectName} ${worst.className} requires attention with ${worst.coveragePercent}% completion (${worst.progressVariance >= 0 ? "+" : ""}${worst.progressVariance}% vs expected).`
    );
  } else if (atRisk > 0) {
    summaries.push(
      `${atRisk} subject${atRisk === 1 ? "" : "s"} ${atRisk === 1 ? "is" : "are"} currently at risk.`
    );
  } else {
    summaries.push(
      `${atRisk} subject${atRisk === 1 ? "" : "s"} at risk and ${kpis.teachersBehindSchedule} teacher${kpis.teachersBehindSchedule === 1 ? "" : "s"} behind schedule. Curriculum health is ${curriculumHealthLabel(health.label).toLowerCase()} (${health.score}/100).`
    );
  }

  return summaries.slice(0, 2);
}
