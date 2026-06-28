/**
 * Knowledge Health Engine — continuous health monitoring (Phase 7).
 */

import { computeKnowledgeHealth, findSimilarEntries } from "./knowledge-duplicates";
import { buildCurriculumDashboard } from "./knowledge-curriculum";
import { summarizeGraph, buildKnowledgeGraph } from "./knowledge-graph-builder";
import { computeKnowledgeStrength } from "./knowledge-strength";
import type {
  KnowledgeHealthSnapshot,
  ModuleHealthRow,
} from "./knowledge-intelligence-types";
import type { AIKnowledgeEntry } from "./types";

export function computeKnowledgeHealthSnapshot(
  entries: AIKnowledgeEntry[],
  moduleTargets: Record<string, number> = {},
  avgConfidence = 85
): KnowledgeHealthSnapshot {
  const active = entries.filter((e) => e.status === "active" && !e.merged_into_id);
  const dashboard = buildCurriculumDashboard(active, { moduleTargets });
  const graph = buildKnowledgeGraph(active);
  const graphSummary = summarizeGraph(graph);

  const totalTarget = dashboard.modules.reduce((s, m) => s + m.targetLessons, 0);
  const totalCompleted = dashboard.modules.reduce((s, m) => s + m.completedLessons, 0);
  const coverage = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  const now = Date.now();
  let freshnessSum = 0;
  let retrievabilitySum = 0;
  let duplicateRiskSum = 0;
  let outdatedCount = 0;

  for (const entry of active) {
    const daysSinceUpdate = (now - new Date(entry.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    freshnessSum += daysSinceUpdate < 30 ? 100 : daysSinceUpdate < 90 ? 80 : daysSinceUpdate < 180 ? 60 : 35;
    if (daysSinceUpdate > 180) outdatedCount++;

    const kwScore = Math.min(100, entry.keywords.length * 12 + entry.search_phrases.length * 8);
    retrievabilitySum += kwScore;

    const health = computeKnowledgeHealth(entry, active);
    if (health.issues.includes("Duplicate exists")) {
      duplicateRiskSum += 70;
    }
  }

  const n = Math.max(1, active.length);
  const freshness = Math.round(freshnessSum / n);
  const retrievability = Math.round(retrievabilitySum / n);
  const duplicateRisk = Math.round(duplicateRiskSum / n);
  const knowledgeDensity = totalTarget > 0 ? Math.round((active.length / totalTarget) * 100) : 0;

  const overallHealth = Math.round(
    coverage * 0.25 +
      freshness * 0.15 +
      avgConfidence * 0.2 +
      retrievability * 0.15 +
      knowledgeDensity * 0.1 +
      (100 - duplicateRisk) * 0.15
  );

  return {
    overallHealth,
    coverage,
    freshness,
    confidence: avgConfidence,
    retrievability,
    knowledgeDensity,
    duplicateRisk,
    orphanCount: graphSummary.orphanCount,
    outdatedCount,
    brokenReferenceCount: 0,
    missingPrerequisiteCount: Math.max(0, graphSummary.orphanCount - 2),
    grade: healthGrade(overallHealth),
  };
}

export function computeModuleHealthRows(
  entries: AIKnowledgeEntry[],
  moduleTargets: Record<string, number> = {}
): ModuleHealthRow[] {
  const dashboard = buildCurriculumDashboard(entries, { moduleTargets });
  const active = entries.filter((e) => e.status === "active");

  return dashboard.modules.map((mod) => {
    const moduleEntries = active.filter((e) => e.curriculum_module === mod.id);
    let weakCount = 0;
    let dupSum = 0;
    for (const entry of moduleEntries) {
      const strength = computeKnowledgeStrength(entry);
      if (strength === "optional" || strength === "legacy") weakCount++;
      const health = computeKnowledgeHealth(entry, active);
      if (health.issues.includes("Duplicate exists")) dupSum += 70;
      const similar = findSimilarEntries(entry.question, active, {
        excludeId: entry.id,
        minSimilarity: 0.72,
        limit: 1,
      });
      if (similar.length > 0) dupSum += Math.round(similar[0].similarity * 100);
    }
    const coverage = mod.targetLessons > 0 ? Math.round((mod.completedLessons / mod.targetLessons) * 100) : 0;
    const health = Math.round(
      coverage * 0.5 +
        (moduleEntries.length > 0 ? 30 : 0) +
        (100 - (moduleEntries.length > 0 ? dupSum / moduleEntries.length : 0)) * 0.2
    );
    return {
      moduleId: mod.id,
      moduleName: mod.name,
      health: Math.min(100, health),
      coverage,
      lessonCount: mod.completedLessons,
      targetCount: mod.targetLessons,
      weakCount,
      duplicateRisk: moduleEntries.length > 0 ? Math.round(dupSum / moduleEntries.length) : 0,
      remainingLessons: mod.remainingLessons,
    };
  });
}

function healthGrade(score: number): KnowledgeHealthSnapshot["grade"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export { healthGrade };
