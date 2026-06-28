/**
 * Knowledge Missions — project milestones instead of generation batches (Phase 3).
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import { CURRICULUM_MODULES } from "./knowledge-curriculum";
import type {
  KnowledgeMission,
  KnowledgeOpportunity,
  ModuleHealthRow,
} from "./knowledge-intelligence-types";
import type { AIKnowledgeEntry } from "./types";

const MINUTES_PER_LESSON = 0.8;

export function buildKnowledgeMissions(input: {
  opportunities: KnowledgeOpportunity[];
  moduleHealth: ModuleHealthRow[];
  entries: AIKnowledgeEntry[];
  lowConfidenceCount?: number;
  duplicateRiskCount?: number;
}): KnowledgeMission[] {
  const missions: KnowledgeMission[] = [];

  for (const mod of input.moduleHealth) {
    const remaining = mod.remainingLessons ?? Math.max(0, mod.targetCount - mod.lessonCount);
    if (remaining <= 0) continue;
    missions.push({
      id: `mission-complete-${mod.moduleId}`,
      type: "complete_module",
      title: `Complete ${mod.moduleName}`,
      description: `${remaining} lessons remaining to reach curriculum target`,
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      lessonsRemaining: remaining,
      estimatedMinutes: Math.round(remaining * MINUTES_PER_LESSON),
      expectedQuality: 95,
      coverageAfter: mod.targetCount > 0 ? Math.round((mod.targetCount / mod.targetCount) * 100) : 100,
      priority: remaining > 20 ? "critical" : remaining > 8 ? "high" : "normal",
      progress: mod.targetCount > 0 ? Math.round((mod.lessonCount / mod.targetCount) * 100) : 0,
    });
  }

  const topGaps = input.opportunities
    .filter((o) => o.impact === "high")
    .slice(0, 3);
  for (const gap of topGaps) {
    if (missions.some((m) => m.moduleId === gap.moduleId && m.type === "complete_module")) continue;
    missions.push({
      id: `mission-gap-${gap.id}`,
      type: "fill_gaps",
      title: `Fill ${gap.topic}`,
      description: gap.reason,
      moduleId: gap.moduleId,
      moduleName: gap.moduleName,
      lessonsRemaining: gap.estimatedLessons,
      estimatedMinutes: Math.round(gap.estimatedLessons * MINUTES_PER_LESSON),
      expectedQuality: 92,
      coverageGain: Math.min(25, gap.estimatedLessons * 2),
      priority: gap.priority,
      progress: 0,
    });
  }

  const weakModules = input.moduleHealth.filter((m) => m.health < 65);
  for (const mod of weakModules.slice(0, 2)) {
    missions.push({
      id: `mission-recover-${mod.moduleId}`,
      type: "recover_module",
      title: `Recover ${mod.moduleName}`,
      description: `Module health at ${mod.health}% — needs attention`,
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      lessonsRemaining: Math.max(5, mod.weakCount),
      estimatedMinutes: Math.round(Math.max(5, mod.weakCount) * MINUTES_PER_LESSON * 1.2),
      priority: "high",
      progress: mod.health,
    });
  }

  if ((input.lowConfidenceCount ?? 0) >= 5) {
    missions.push({
      id: "mission-improve-confidence",
      type: "improve_confidence",
      title: "Improve Low Confidence Lessons",
      description: `${input.lowConfidenceCount} lessons producing low-confidence retrievals`,
      lessonsRemaining: input.lowConfidenceCount ?? 0,
      estimatedMinutes: Math.round((input.lowConfidenceCount ?? 0) * MINUTES_PER_LESSON * 1.5),
      currentConfidence: 71,
      targetConfidence: 92,
      priority: "high",
      progress: 35,
    });
  }

  if ((input.duplicateRiskCount ?? 0) >= 3) {
    missions.push({
      id: "mission-reduce-duplicates",
      type: "reduce_duplicates",
      title: "Reduce Duplicate Risk",
      description: `${input.duplicateRiskCount} lessons with overlapping content`,
      lessonsRemaining: input.duplicateRiskCount ?? 0,
      estimatedMinutes: Math.round((input.duplicateRiskCount ?? 0) * MINUTES_PER_LESSON * 0.6),
      duplicateSavings: 18,
      priority: "normal",
      progress: 0,
    });
  }

  return missions
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
    .slice(0, 12);
}

function priorityWeight(p: KnowledgeMission["priority"]): number {
  switch (p) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "normal":
      return 2;
    case "low":
      return 1;
  }
}

export function missionToGenerationMode(mission: KnowledgeMission): "10" | "20" | "50" | "fill_remaining" {
  if (mission.lessonsRemaining >= 40) return "50";
  if (mission.lessonsRemaining >= 15) return "20";
  if (mission.type === "complete_module" && mission.lessonsRemaining > 0) {
    return mission.lessonsRemaining > 10 ? "20" : "10";
  }
  return "10";
}

export function resolveMissionModuleId(mission: KnowledgeMission): CurriculumModuleId | null {
  return mission.moduleId ?? null;
}

export function formatMissionEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${Math.round(minutes / 60)}h ${minutes % 60}m`;
}

export { CURRICULUM_MODULES };
