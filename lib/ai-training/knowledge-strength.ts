/**
 * Knowledge Strength — importance independent of writing quality (Phase 5).
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import { CURRICULUM_MODULES } from "./knowledge-curriculum";
import type { KnowledgeStrengthLevel } from "./knowledge-intelligence-types";
import { KNOWLEDGE_STRENGTH_LABELS } from "./knowledge-intelligence-types";
import type { GeneratedLessonDraft } from "./lesson-generator-types";
import type { AIKnowledgeEntry } from "./types";

const CORE_MODULES: Set<CurriculumModuleId> = new Set([
  "about-adakaro",
  "getting-started",
  "pricing",
  "attendance",
  "report-cards",
]);

export function computeKnowledgeStrength(
  entry: AIKnowledgeEntry,
  options?: { usagePercentile?: number; isOrphan?: boolean }
): KnowledgeStrengthLevel {
  if (entry.status === "archived" || entry.merged_into_id) return "legacy";

  const moduleId = entry.curriculum_module as CurriculumModuleId | null;
  const isCoreModule = moduleId ? CORE_MODULES.has(moduleId) : false;
  const usage = entry.usage_count ?? 0;
  const priority = entry.priority;

  if (entry.is_primary && (priority === "critical" || priority === "high")) {
    return "core";
  }

  if (priority === "critical" || (isCoreModule && priority === "high")) {
    return "core";
  }

  if (priority === "high" || usage >= 50 || (options?.usagePercentile ?? 0) >= 80) {
    return "essential";
  }

  if (priority === "normal" && usage >= 10) {
    return "advanced";
  }

  if (usage >= 3 || entry.search_phrases.length >= 3) {
    return "reference";
  }

  if (options?.isOrphan || usage === 0) {
    return "optional";
  }

  const daysSinceUpdate =
    (Date.now() - new Date(entry.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 180 && usage < 2) {
    return "legacy";
  }

  return "optional";
}

export function strengthToScore(level: KnowledgeStrengthLevel): number {
  switch (level) {
    case "core":
      return 100;
    case "essential":
      return 88;
    case "advanced":
      return 72;
    case "reference":
      return 58;
    case "optional":
      return 40;
    case "legacy":
      return 20;
  }
}

export function strengthLabel(level: KnowledgeStrengthLevel): string {
  return KNOWLEDGE_STRENGTH_LABELS[level];
}

export function rankEntriesByStrength(
  entries: AIKnowledgeEntry[]
): Array<{ entry: AIKnowledgeEntry; strength: KnowledgeStrengthLevel; score: number }> {
  const usages = entries.map((e) => e.usage_count).sort((a, b) => a - b);
  return entries.map((entry) => {
    const idx = usages.indexOf(entry.usage_count);
    const percentile = usages.length > 1 ? (idx / usages.length) * 100 : 0;
    const strength = computeKnowledgeStrength(entry, { usagePercentile: percentile });
    return { entry, strength, score: strengthToScore(strength) };
  });
}

export function coreModuleIds(): CurriculumModuleId[] {
  return CURRICULUM_MODULES.filter((m) => CORE_MODULES.has(m.id)).map((m) => m.id);
}

/** Estimate knowledge strength for a generated draft before publish. */
export function computeDraftKnowledgeStrength(
  draft: Pick<GeneratedLessonDraft, "priority" | "curriculumModule" | "topicTag">
): KnowledgeStrengthLevel {
  return computeKnowledgeStrength({
    id: "draft",
    question: draft.topicTag || "draft",
    answer: "",
    category: "General",
    keywords: [],
    search_phrases: [],
    alternative_wording: [],
    synonyms: [],
    related_terms: [],
    priority: draft.priority,
    usage_count: 0,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    intent_key: null,
    curriculum_module: draft.curriculumModule,
  });
}
