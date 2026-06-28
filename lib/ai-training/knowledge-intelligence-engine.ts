/**
 * Knowledge Intelligence Engine — continuous analysis & recommendations (Phase 1).
 */

import { computeQuestionSimilarity } from "./knowledge-duplicates";
import { analyzeModuleCurriculum } from "./lesson-generator";
import type {
  IntelligenceRecommendation,
  RecommendationKind,
  OpportunityPriority,
} from "./knowledge-intelligence-types";
import type { CurriculumModuleId } from "./knowledge-curriculum";
import type { AIKnowledgeEntry } from "./types";

export function analyzeKnowledgeBase(input: {
  entries: AIKnowledgeEntry[];
  unansweredQuestions?: Array<{ question: string; occurrences: number }>;
}): IntelligenceRecommendation[] {
  const recommendations: IntelligenceRecommendation[] = [];
  const active = input.entries.filter((e) => e.status === "active" && !e.merged_into_id);

  for (const entry of active) {
    const weak = isWeakLesson(entry);
    if (weak) {
      recommendations.push({
        id: `rec-weak-${entry.id}`,
        kind: "weak_lesson",
        title: `Improve: ${truncate(entry.question, 50)}`,
        description: weak,
        moduleId: entry.curriculum_module as CurriculumModuleId | undefined,
        entryId: entry.id,
        priority: entry.priority === "critical" ? "critical" : "high",
        actionLabel: "Review lesson",
      });
    }

    const dup = findDuplicateOverlap(entry, active);
    if (dup) {
      recommendations.push({
        id: `rec-dup-${entry.id}`,
        kind: "duplicate_overlap",
        title: `Duplicate risk: ${truncate(entry.question, 40)}`,
        description: dup,
        entryId: entry.id,
        moduleId: entry.curriculum_module as CurriculumModuleId | undefined,
        priority: "normal",
        actionLabel: "Compare lessons",
      });
    }

    if (isOutdated(entry)) {
      recommendations.push({
        id: `rec-outdated-${entry.id}`,
        kind: "outdated",
        title: `May be outdated: ${truncate(entry.question, 40)}`,
        description: "Not updated in 6+ months with low usage",
        entryId: entry.id,
        priority: "low",
        actionLabel: "Refresh content",
      });
    }

    if (entry.usage_count < 2 && entry.priority !== "critical") {
      recommendations.push({
        id: `rec-rare-${entry.id}`,
        kind: "rarely_used",
        title: `Rarely retrieved: ${truncate(entry.question, 40)}`,
        description: `Only ${entry.usage_count} uses — consider improving keywords or merging`,
        entryId: entry.id,
        priority: "low",
        actionLabel: "Boost retrieval",
      });
    }
  }

  for (const u of input.unansweredQuestions ?? []) {
    recommendations.push({
      id: `rec-unanswered-${hash(u.question)}`,
      kind: "unanswered_demand",
      title: `Unanswered demand: ${truncate(u.question, 45)}`,
      description: `Asked ${u.occurrences} time(s) with no good match`,
      priority: u.occurrences >= 5 ? "critical" : u.occurrences >= 2 ? "high" : "normal",
      actionLabel: "Create lesson",
    });
  }

  const modules = new Set(active.map((e) => e.curriculum_module).filter(Boolean));
  for (const moduleId of modules) {
    const analysis = analyzeModuleCurriculum(moduleId as CurriculumModuleId, active, 80);
    for (const concept of analysis.missingConcepts.slice(0, 3)) {
      recommendations.push({
        id: `rec-missing-${moduleId}-${concept}`,
        kind: "missing_concept",
        title: `Missing: ${concept}`,
        description: `Module ${analysis.moduleName} lacks coverage for "${concept}"`,
        moduleId: moduleId as CurriculumModuleId,
        priority: "high",
        actionLabel: "Generate lessons",
      });
    }
  }

  return dedupeRecommendations(recommendations).slice(0, 50);
}

function isWeakLesson(entry: AIKnowledgeEntry): string | null {
  if (entry.answer.length < 80) return "Answer is too brief";
  if (entry.keywords.length < 3) return "Insufficient keywords for retrieval";
  if (entry.health_status === "needs_review") return "Flagged as needs review";
  if ((entry.intent_confidence ?? 100) < 60) return "Low intent confidence";
  return null;
}

function findDuplicateOverlap(entry: AIKnowledgeEntry, all: AIKnowledgeEntry[]): string | null {
  for (const other of all) {
    if (other.id === entry.id) continue;
    const { similarity, classification } = computeQuestionSimilarity(entry.question, other);
    if (similarity >= 0.82 && classification !== "different_intent") {
      return `Similar to "${truncate(other.question, 40)}" (${Math.round(similarity * 100)}%)`;
    }
  }
  return null;
}

function isOutdated(entry: AIKnowledgeEntry): boolean {
  const days = (Date.now() - new Date(entry.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  return days > 180 && entry.usage_count < 3;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function dedupeRecommendations(recs: IntelligenceRecommendation[]): IntelligenceRecommendation[] {
  const seen = new Set<string>();
  return recs.filter((r) => {
    const key = `${r.kind}:${r.entryId ?? r.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupRecommendationsByKind(
  recs: IntelligenceRecommendation[]
): Record<RecommendationKind, IntelligenceRecommendation[]> {
  const groups = {} as Record<RecommendationKind, IntelligenceRecommendation[]>;
  for (const rec of recs) {
    groups[rec.kind] = groups[rec.kind] ?? [];
    groups[rec.kind].push(rec);
  }
  return groups;
}

export function priorityWeight(p: OpportunityPriority): number {
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
