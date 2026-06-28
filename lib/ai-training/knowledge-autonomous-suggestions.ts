/**
 * Autonomous Knowledge Suggestions — proactive recommendations (Phase 12).
 */

import type {
  AutonomousSuggestion,
  KnowledgeHealthSnapshot,
  KnowledgeOpportunity,
  LearningSignalSummary,
} from "./knowledge-intelligence-types";
import type { CurriculumModuleId } from "./knowledge-curriculum";

export function generateAutonomousSuggestions(input: {
  health: KnowledgeHealthSnapshot;
  opportunities: KnowledgeOpportunity[];
  learningSignals: LearningSignalSummary;
  recentConfidenceDrop?: number;
  duplicateIncrease?: number;
}): AutonomousSuggestion[] {
  const suggestions: AutonomousSuggestion[] = [];

  if (input.health.confidence < 75 || (input.recentConfidenceDrop ?? 0) > 5) {
    suggestions.push({
      id: "auto-confidence-drop",
      trigger: "confidence_drop",
      title: "Confidence declining across knowledge base",
      description: `Average confidence at ${input.health.confidence}%. Review weak lessons and expand retrieval metadata.`,
      priority: "critical",
      suggestedAction: "Launch Improve Low Confidence mission",
    });
  }

  for (const topic of input.learningSignals.risingTopics.slice(0, 3)) {
    suggestions.push({
      id: `auto-search-${topic.topic}`,
      trigger: "new_searches",
      title: `Rising interest: ${topic.topic}`,
      description: `${topic.count} recent queries related to this topic`,
      priority: topic.count >= 10 ? "high" : "normal",
      suggestedAction: "Suggest curriculum expansion",
    });
  }

  if (input.health.duplicateRisk > 35 || (input.duplicateIncrease ?? 0) > 3) {
    suggestions.push({
      id: "auto-duplicate-increase",
      trigger: "duplicate_increase",
      title: "Duplicate overlap increasing",
      description: "Multiple lessons share similar intents — consolidation recommended",
      priority: "normal",
      suggestedAction: "Launch Reduce Duplicate Risk mission",
    });
  }

  for (const mod of input.opportunities.filter((o) => o.impact === "high").slice(0, 2)) {
    suggestions.push({
      id: `auto-module-${mod.moduleId}`,
      trigger: "module_health_fall",
      title: `Expand ${mod.moduleName}`,
      description: mod.reason,
      priority: mod.priority,
      suggestedAction: `Generate ${mod.estimatedLessons} lessons`,
      moduleId: mod.moduleId,
    });
  }

  suggestions.push({
    id: "auto-feature-monitor",
    trigger: "new_feature",
    title: "Monitor product releases",
    description: "When new Adakaro features ship, automatically suggest lessons for documentation gaps",
    priority: "normal",
    suggestedAction: "Review feature changelog",
  });

  return suggestions.slice(0, 10);
}

export function triggerLabel(trigger: AutonomousSuggestion["trigger"]): string {
  switch (trigger) {
    case "new_feature":
      return "New feature";
    case "confidence_drop":
      return "Confidence drop";
    case "new_searches":
      return "New searches";
    case "duplicate_increase":
      return "Duplicate increase";
    case "module_health_fall":
      return "Module health";
  }
}

export function moduleRecoverySuggestion(
  moduleId: CurriculumModuleId,
  moduleName: string,
  health: number
): AutonomousSuggestion | null {
  if (health >= 65) return null;
  return {
    id: `recover-${moduleId}`,
    trigger: "module_health_fall",
    title: `Recover ${moduleName}`,
    description: `Module health at ${health}% — priority recovery recommended`,
    priority: "high",
    suggestedAction: "Start recovery mission",
    moduleId,
  };
}
