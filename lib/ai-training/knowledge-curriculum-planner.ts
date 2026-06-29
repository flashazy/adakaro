/**
 * Priority-Aware AI Curriculum Planner — ranks missing knowledge by business value,
 * coverage gaps, dependencies, search demand, and AI confidence signals.
 *
 * Composes existing engines (entity templates, graph, seeds, gaps) without replacing them.
 */

import { buildCurriculumDashboard, CURRICULUM_MODULES, type CurriculumModuleId } from "./knowledge-curriculum";
import { discoverKnowledgeGaps } from "./knowledge-gap-discovery";
import { buildKnowledgeGraph, summarizeGraph } from "./knowledge-graph-builder";
import { getGraphNeighborsForEntry } from "./knowledge-graph-builder";
import {
  computeKnowledgeHealth,
  type SuggestedRelatedLesson,
} from "./knowledge-duplicates";
import { extractKnowledgeEntity } from "./knowledge-entities";
import { inferIntentSignature } from "./intent-signature";
import { MODULE_QUESTION_BANK } from "./lesson-generation-prompt";
import { normalizeText } from "./knowledge-scoring";
import type { AIKnowledgeEntry, AIUnansweredQuestion } from "./types";
import type { LearningEventRow } from "./learning-types";

import type {
  CurriculumPlannerAnalytics,
  CurriculumPlannerSnapshot,
  CurriculumRoadmapLesson,
  CurriculumRoadmapTrack,
  KnowledgeGapIssue,
  LessonPlannerPriority,
  LessonPrerequisite,
  PlannerSuggestionSource,
  PriorityLessonSuggestion,
  PriorityScoreFactors,
} from "./knowledge-intelligence-types";

export type PlannerFilter =
  | "all"
  | "critical"
  | "high"
  | "category"
  | "intent"
  | "coverage_gap"
  | "recently_searched"
  | "most_requested"
  | "newest"
  | "low_confidence";

export type {
  CurriculumPlannerAnalytics,
  CurriculumPlannerSnapshot,
  CurriculumRoadmapLesson,
  CurriculumRoadmapTrack,
  KnowledgeGapIssue,
  LessonPlannerPriority,
  LessonPrerequisite,
  PlannerSuggestionSource,
  PriorityLessonSuggestion,
  PriorityScoreFactors,
};

export interface CurriculumPlannerContext {
  entries: AIKnowledgeEntry[];
  activeEntries: AIKnowledgeEntry[];
  unanswered: AIUnansweredQuestion[];
  learningEvents: LearningEventRow[];
  moduleTargets: Record<string, number>;
  searchTermFrequency: Map<string, number>;
  lowConfidenceByTopic: Map<string, number>;
  moduleLessonCounts: Map<CurriculumModuleId, number>;
  categoryLessonCounts: Map<string, number>;
  seedByQuestion: Map<string, (typeof MODULE_QUESTION_BANK)[CurriculumModuleId][number] & { moduleId: CurriculumModuleId }>;
}

/* ─── Roadmap tracks (curriculum narrative, not taxonomy) ─── */

const ROADMAP_TRACKS: Array<{
  id: string;
  label: string;
  moduleId: CurriculumModuleId;
  questions: string[];
}> = [
  {
    id: "identity",
    label: "Identity",
    moduleId: "about-adakaro",
    questions: [
      "What is Adakaro?",
      "Why was Adakaro created?",
      "Who is Adakaro built for?",
      "Who uses Adakaro?",
    ],
  },
  {
    id: "capabilities",
    label: "Capabilities",
    moduleId: "about-adakaro",
    questions: [
      "What can Adakaro do?",
      "What modules are included in Adakaro?",
      "How does Adakaro simplify school management?",
      "What problems does Adakaro solve?",
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    moduleId: "pricing",
    questions: [
      "How much does Adakaro cost?",
      "Is there a free plan?",
      "When does billing start?",
    ],
  },
  {
    id: "getting-started",
    label: "Getting Started",
    moduleId: "getting-started",
    questions: [
      "How do I get started with Adakaro?",
      "How do I request a demo?",
      "What are the first steps after signing up?",
    ],
  },
  {
    id: "security",
    label: "Security",
    moduleId: "about-adakaro",
    questions: [
      "How secure is Adakaro?",
      "How do user permissions work in Adakaro?",
      "Can I control who sees student data?",
    ],
  },
];

const HIGH_IMPACT_MODULES = new Set<CurriculumModuleId>([
  "about-adakaro",
  "pricing",
  "getting-started",
  "admissions",
  "attendance",
  "finance",
  "report-cards",
  "student-management",
]);

const DEPENDENCY_CHAINS: Record<string, string[]> = {
  "What can Adakaro do?": ["What is Adakaro?"],
  "Why choose Adakaro?": ["What is Adakaro?", "What can Adakaro do?"],
  "Who is Adakaro built for?": ["What is Adakaro?"],
  "Who uses Adakaro?": ["What is Adakaro?"],
  "How do I get started with Adakaro?": ["What is Adakaro?"],
  "How do I request a demo?": ["What is Adakaro?", "How do I get started with Adakaro?"],
  "What happens after requesting a demo?": ["How do I request a demo?"],
  "What is Adakaro pricing?": ["What is Adakaro?", "How much does Adakaro cost?"],
  "How much does Adakaro cost?": ["What is Adakaro?"],
  "How do I generate report cards?": ["What are report cards?", "How do report cards work?"],
  "Can parents view report cards?": ["How do I generate report cards?"],
  "How do I mark attendance?": ["How does attendance work in Adakaro?"],
};

/** Recommended follow-up lessons after saving identity/platform entries. */
export const IDENTITY_FOLLOW_UP_QUESTIONS = [
  "What can Adakaro do?",
  "Who is Adakaro built for?",
  "Why choose Adakaro?",
  "How much does Adakaro cost?",
  "How do I get started with Adakaro?",
  "How do I request a demo?",
  "Which schools use Adakaro?",
];

const BUSINESS_CRITICAL_QUESTIONS = new Set(
  [
    "What is Adakaro?",
    "What can Adakaro do?",
    "How much does Adakaro cost?",
    "How do I get started with Adakaro?",
    "How do I request a demo?",
    "How secure is Adakaro?",
    "How secure is my data?",
    "Why choose Adakaro?",
    "Who is Adakaro built for?",
  ].map((q) => normalizeText(q))
);

/* ─── Context builder ─── */

export function buildCurriculumPlannerContext(input: {
  entries: AIKnowledgeEntry[];
  unanswered?: AIUnansweredQuestion[];
  learningEvents?: LearningEventRow[];
  moduleTargets?: Record<string, number>;
}): CurriculumPlannerContext {
  const activeEntries = input.entries.filter((e) => e.status === "active" && !e.merged_into_id);
  const unanswered = input.unanswered ?? [];
  const learningEvents = input.learningEvents ?? [];
  const moduleTargets = input.moduleTargets ?? {};

  const searchTermFrequency = new Map<string, number>();
  for (const row of unanswered) {
    const tokens = meaningfulSearchTokens(row.question);
    for (const token of tokens) {
      searchTermFrequency.set(token, (searchTermFrequency.get(token) ?? 0) + (row.occurrences ?? 1));
    }
  }

  const lowConfidenceByTopic = new Map<string, number>();
  for (const event of learningEvents) {
    if (event.confidence_level !== "low" && (event.final_score ?? 1) >= 0.42) continue;
    const key = event.matched_intent_key ?? normalizeText(event.original_question ?? "").slice(0, 40);
    if (!key) continue;
    lowConfidenceByTopic.set(key, (lowConfidenceByTopic.get(key) ?? 0) + 1);
  }

  const moduleLessonCounts = new Map<CurriculumModuleId, number>();
  const categoryLessonCounts = new Map<string, number>();
  for (const entry of activeEntries) {
    if (entry.curriculum_module) {
      const mod = entry.curriculum_module as CurriculumModuleId;
      moduleLessonCounts.set(mod, (moduleLessonCounts.get(mod) ?? 0) + 1);
    }
    categoryLessonCounts.set(entry.category, (categoryLessonCounts.get(entry.category) ?? 0) + 1);
  }

  const seedByQuestion = new Map<
    string,
    (typeof MODULE_QUESTION_BANK)[CurriculumModuleId][number] & { moduleId: CurriculumModuleId }
  >();
  for (const [moduleId, seeds] of Object.entries(MODULE_QUESTION_BANK)) {
    for (const seed of seeds) {
      seedByQuestion.set(normalizeText(seed.question), {
        ...seed,
        moduleId: moduleId as CurriculumModuleId,
      });
    }
  }

  return {
    entries: input.entries,
    activeEntries,
    unanswered,
    learningEvents,
    moduleTargets,
    searchTermFrequency,
    lowConfidenceByTopic,
    moduleLessonCounts,
    categoryLessonCounts,
    seedByQuestion,
  };
}

function meaningfulSearchTokens(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "how",
  "what",
  "does",
  "can",
  "are",
  "with",
  "from",
  "this",
  "that",
  "have",
  "about",
]);

/* ─── Priority scoring ─── */

function scoreToLevel(score: number): LessonPlannerPriority {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function scoreToStars(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 95) return 5;
  if (score >= 85) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  return 1;
}

function seedPriorityWeight(priority?: string): number {
  if (priority === "critical") return 100;
  if (priority === "high") return 82;
  if (priority === "normal") return 58;
  return 35;
}

function findEntryByQuestion(
  question: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string
): AIKnowledgeEntry | null {
  const norm = normalizeText(question);
  return (
    entries.find(
      (e) =>
        e.id !== excludeId &&
        e.status === "active" &&
        (normalizeText(e.question) === norm || normalizeText(e.question).includes(norm.slice(0, 24)))
    ) ?? null
  );
}

function computeSearchDemand(
  question: string,
  context: CurriculumPlannerContext
): { score: number; label: PriorityLessonSuggestion["searchDemand"] } {
  const tokens = meaningfulSearchTokens(question);
  let total = 0;
  for (const token of tokens) {
    total += context.searchTermFrequency.get(token) ?? 0;
  }
  if (total >= 8) return { score: 100, label: "high" };
  if (total >= 3) return { score: 68, label: "medium" };
  if (total >= 1) return { score: 42, label: "low" };
  return { score: 8, label: "none" };
}

function computeCoverageGap(
  moduleId: CurriculumModuleId | undefined,
  category: string,
  context: CurriculumPlannerContext
): number {
  const mod = moduleId ? CURRICULUM_MODULES.find((m) => m.id === moduleId) : null;
  const target = mod
    ? context.moduleTargets[mod.id] ?? mod.defaultTarget
    : 0;
  const count = moduleId
    ? context.moduleLessonCounts.get(moduleId) ?? 0
    : context.categoryLessonCounts.get(category) ?? 0;

  if (target <= 0) {
    const avg =
      [...context.moduleLessonCounts.values()].reduce((s, n) => s + n, 0) /
      Math.max(1, context.moduleLessonCounts.size);
    if (count < avg * 0.35) return 92;
    if (count < avg * 0.6) return 72;
    return 40;
  }

  const ratio = count / target;
  if (ratio < 0.15) return 100;
  if (ratio < 0.35) return 85;
  if (ratio < 0.55) return 65;
  if (ratio < 0.75) return 45;
  return 25;
}

function computeDependencyWeight(
  question: string,
  context: CurriculumPlannerContext,
  excludeId?: string
): number {
  const deps = DEPENDENCY_CHAINS[question] ?? [];
  if (deps.length === 0) return 35;

  let missing = 0;
  for (const dep of deps) {
    if (!findEntryByQuestion(dep, context.activeEntries, excludeId)) missing++;
  }

  if (missing === 0) return 55;
  const ratio = missing / deps.length;
  return Math.round(40 + ratio * 55);
}

function computeCustomerImpact(
  moduleId?: CurriculumModuleId
): { score: number; label: PriorityLessonSuggestion["customerImpact"] } {
  if (!moduleId) return { score: 45, label: "medium" };
  if (HIGH_IMPACT_MODULES.has(moduleId)) {
    return moduleId === "about-adakaro" || moduleId === "pricing"
      ? { score: 98, label: "very_high" }
      : { score: 82, label: "high" };
  }
  return { score: 48, label: "medium" };
}

function computeAiConfidenceBoost(
  question: string,
  intent: string,
  context: CurriculumPlannerContext
): number {
  let boost = 20;
  const tokens = meaningfulSearchTokens(question);
  for (const token of tokens) {
    for (const [topic, count] of context.lowConfidenceByTopic.entries()) {
      if (topic.includes(token) || normalizeText(intent).includes(token)) {
        boost += Math.min(25, count * 6);
      }
    }
  }
  return Math.min(100, boost);
}

function buildPrerequisites(
  question: string,
  context: CurriculumPlannerContext,
  excludeId?: string
): LessonPrerequisite[] {
  const deps = DEPENDENCY_CHAINS[question] ?? [];
  return deps.map((dep) => {
    const entry = findEntryByQuestion(dep, context.activeEntries, excludeId);
    return {
      question: dep,
      entryId: entry?.id ?? null,
      completed: Boolean(entry),
    };
  });
}

/** Prerequisites for a lesson question (dependency graph). */
export function getLessonPrerequisites(
  question: string,
  context: CurriculumPlannerContext,
  excludeId?: string
): LessonPrerequisite[] {
  return buildPrerequisites(question, context, excludeId);
}

function resolveLessonMeta(
  question: string,
  context: CurriculumPlannerContext,
  categoryHint?: string
): {
  category: string;
  intent: string;
  moduleId?: CurriculumModuleId;
  moduleName?: string;
  seedPriority?: string;
} {
  const seed = context.seedByQuestion.get(normalizeText(question));
  if (seed) {
    const mod = CURRICULUM_MODULES.find((m) => m.id === seed.moduleId);
    return {
      category: mod?.defaultCategory ?? categoryHint ?? "General",
      intent: seed.intentLabel,
      moduleId: seed.moduleId,
      moduleName: mod?.name,
      seedPriority: seed.priority,
    };
  }

  const intent = inferIntentSignature(question);
  const entity = extractKnowledgeEntity(question);
  const moduleId = inferModuleFromQuestion(question, entity?.id);
  const mod = moduleId ? CURRICULUM_MODULES.find((m) => m.id === moduleId) : null;

  return {
    category: categoryHint ?? mod?.defaultCategory ?? "General",
    intent: intent.label,
    moduleId,
    moduleName: mod?.name,
    seedPriority: undefined,
  };
}

function inferModuleFromQuestion(
  question: string,
  entityId?: string
): CurriculumModuleId | undefined {
  const q = normalizeText(question);
  if (entityId === "adakaro" || entityId === "adakaro-ai") return "about-adakaro";
  if (entityId === "report-cards") return "report-cards";
  if (entityId === "attendance") return "attendance";
  if (entityId === "finance") return "finance";
  if (entityId === "student-streaming") return "student-streaming";
  if (q.includes("pricing") || q.includes("cost") || q.includes("billing")) return "pricing";
  if (q.includes("admission") || q.includes("enroll")) return "admissions";
  if (q.includes("attendance")) return "attendance";
  if (q.includes("report card")) return "report-cards";
  if (q.includes("parent")) return "parent-portal";
  if (q.includes("teacher") || q.includes("staff")) return "teachers-staff";
  if (q.includes("student")) return "student-management";
  return undefined;
}

function scoreLessonSuggestion(input: {
  question: string;
  inDatabase: boolean;
  context: CurriculumPlannerContext;
  categoryHint?: string;
  sources: PlannerSuggestionSource[];
  excludeId?: string;
  becauseYouCreated?: string;
}): PriorityLessonSuggestion {
  const { question, context, categoryHint, sources, excludeId, becauseYouCreated } = input;
  const meta = resolveLessonMeta(question, context, categoryHint);
  const entry = findEntryByQuestion(question, context.activeEntries, excludeId);

  const importance = BUSINESS_CRITICAL_QUESTIONS.has(normalizeText(question))
    ? 98
    : seedPriorityWeight(meta.seedPriority);

  const search = computeSearchDemand(question, context);
  const coverageGap = computeCoverageGap(meta.moduleId, meta.category, context);
  const dependencyWeight = computeDependencyWeight(question, context, excludeId);
  const businessValue = seedPriorityWeight(meta.seedPriority);
  const customer = computeCustomerImpact(meta.moduleId);
  const aiConfidence = computeAiConfidenceBoost(question, meta.intent, context);

  const factors: PriorityScoreFactors = {
    importance,
    searchFrequency: search.score,
    dependencyWeight,
    coverageGap,
    businessValue,
    customerImpact: customer.score,
    aiConfidence,
  };

  const priorityScore = Math.round(
    importance * 0.22 +
      search.score * 0.14 +
      dependencyWeight * 0.14 +
      coverageGap * 0.16 +
      businessValue * 0.14 +
      customer.score * 0.12 +
      aiConfidence * 0.08
  );

  const adjustedScore = input.inDatabase ? Math.max(20, priorityScore - 45) : priorityScore;
  const prerequisites = buildPrerequisites(question, context, excludeId);
  const unmetPrereqs = prerequisites.filter((p) => !p.completed).length;
  const finalScore = Math.min(100, adjustedScore + unmetPrereqs * 4);

  const coverageContribution =
    meta.moduleId && context.moduleTargets[meta.moduleId]
      ? Math.round((1 / Math.max(1, context.moduleTargets[meta.moduleId])) * 100)
      : Math.round(100 / Math.max(1, CURRICULUM_MODULES.length));

  return {
    question,
    entryId: entry?.id ?? null,
    inDatabase: Boolean(entry),
    reason: buildReason(sources, meta.moduleName),
    priorityScore: finalScore,
    priorityLevel: scoreToLevel(finalScore),
    starRating: scoreToStars(finalScore),
    category: meta.category,
    intent: meta.intent,
    moduleId: meta.moduleId,
    moduleName: meta.moduleName,
    factors,
    searchDemand: search.label,
    customerImpact: customer.label,
    coverageContribution,
    prerequisites,
    sources,
    becauseYouCreated,
  };
}

function buildReason(sources: PlannerSuggestionSource[], moduleName?: string): string {
  if (sources.includes("entity_template")) return "Recommended companion lesson for this entity";
  if (sources.includes("dependency")) return "Foundational lesson in the learning path";
  if (sources.includes("unanswered")) return "Frequently requested — weak or missing knowledge";
  if (sources.includes("gap")) return moduleName ? `Coverage gap in ${moduleName}` : "Coverage gap detected";
  if (sources.includes("graph")) return "Connected in the knowledge graph";
  if (sources.includes("seed")) return "Core curriculum topic";
  return "High-value knowledge opportunity";
}

/* ─── Public planners ─── */

export function prioritizeRelatedLessons(
  question: string,
  baseSuggestions: SuggestedRelatedLesson[],
  context: CurriculumPlannerContext,
  options?: { excludeId?: string; category?: string }
): PriorityLessonSuggestion[] {
  const scored = new Map<string, PriorityLessonSuggestion>();
  const becauseYouCreated = question.trim();

  for (const lesson of baseSuggestions) {
    const key = normalizeText(lesson.question);
    scored.set(
      key,
      scoreLessonSuggestion({
        question: lesson.question,
        inDatabase: lesson.inDatabase,
        context,
        categoryHint: options?.category,
        sources: ["entity_template", "context"],
        excludeId: options?.excludeId,
        becauseYouCreated,
      })
    );
  }

  const currentEntry = findEntryByQuestion(question, context.activeEntries, options?.excludeId);
  if (currentEntry) {
    for (const neighbor of getGraphNeighborsForEntry(currentEntry, context.activeEntries)) {
      const key = normalizeText(neighbor.question);
      if (scored.has(key)) continue;
      scored.set(
        key,
        scoreLessonSuggestion({
          question: neighbor.question,
          inDatabase: true,
          context,
          categoryHint: neighbor.category,
          sources: ["graph"],
          excludeId: options?.excludeId,
          becauseYouCreated,
        })
      );
    }
  }

  for (const [moduleId, seeds] of Object.entries(MODULE_QUESTION_BANK)) {
    const entity = extractKnowledgeEntity(question);
    const relevantModule = inferModuleFromQuestion(question, entity?.id);
    if (relevantModule && relevantModule !== moduleId) continue;

    for (const seed of seeds) {
      const key = normalizeText(seed.question);
      if (scored.has(key) || normalizeText(seed.question) === normalizeText(question)) continue;
      if (findEntryByQuestion(seed.question, context.activeEntries, options?.excludeId)) continue;

      scored.set(
        key,
        scoreLessonSuggestion({
          question: seed.question,
          inDatabase: false,
          context,
          categoryHint: options?.category,
          sources: relevantModule ? ["seed", "gap"] : ["seed"],
          excludeId: options?.excludeId,
          becauseYouCreated,
        })
      );
    }
  }

  for (const depQuestion of Object.keys(DEPENDENCY_CHAINS)) {
    const chain = DEPENDENCY_CHAINS[depQuestion] ?? [];
    const relatesToCurrent =
      normalizeText(depQuestion).includes(normalizeText(question).slice(0, 12)) ||
      chain.some((d) => normalizeText(question).includes(normalizeText(d).slice(0, 12)));
    if (!relatesToCurrent) continue;

    const key = normalizeText(depQuestion);
    if (!scored.has(key) && !findEntryByQuestion(depQuestion, context.activeEntries, options?.excludeId)) {
      scored.set(
        key,
        scoreLessonSuggestion({
          question: depQuestion,
          inDatabase: false,
          context,
          categoryHint: options?.category,
          sources: ["dependency"],
          excludeId: options?.excludeId,
          becauseYouCreated,
        })
      );
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 12);
}

export function buildTopLessonRecommendations(
  context: CurriculumPlannerContext,
  limit = 15
): PriorityLessonSuggestion[] {
  const scored = new Map<string, PriorityLessonSuggestion>();

  for (const [moduleId, seeds] of Object.entries(MODULE_QUESTION_BANK)) {
    for (const seed of seeds) {
      if (findEntryByQuestion(seed.question, context.activeEntries)) continue;
      const key = normalizeText(seed.question);
      scored.set(
        key,
        scoreLessonSuggestion({
          question: seed.question,
          inDatabase: false,
          context,
          sources: ["seed"],
        })
      );
    }
    void moduleId;
  }

  const gaps = discoverKnowledgeGaps({
    entries: context.entries,
    unanswered: context.unanswered,
    learningEvents: context.learningEvents,
    moduleTargets: context.moduleTargets,
  });

  for (const gap of gaps) {
    for (const sample of gap.sampleQuestions ?? []) {
      if (findEntryByQuestion(sample, context.activeEntries)) continue;
      const key = normalizeText(sample);
      const existing = scored.get(key);
      const next = scoreLessonSuggestion({
        question: sample,
        inDatabase: false,
        context,
        sources: ["gap", "unanswered"],
      });
      if (!existing || next.priorityScore > existing.priorityScore) {
        scored.set(key, next);
      }
    }
  }

  return [...scored.values()]
    .filter((s) => !s.inDatabase)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

export function buildKnowledgeRoadmap(context: CurriculumPlannerContext): CurriculumRoadmapTrack[] {
  return ROADMAP_TRACKS.map((track) => {
    const lessons: CurriculumRoadmapLesson[] = track.questions.map((q) => {
      const entry = findEntryByQuestion(q, context.activeEntries);
      const scored = scoreLessonSuggestion({
        question: q,
        inDatabase: Boolean(entry),
        context,
        sources: ["seed"],
      });
      return {
        question: q,
        entryId: entry?.id ?? null,
        status: entry ? "completed" : "missing",
        priorityLevel: scored.priorityLevel,
        priorityScore: scored.priorityScore,
      };
    });

    const completedCount = lessons.filter((l) => l.status === "completed").length;
    const totalCount = lessons.length;

    return {
      id: track.id,
      label: track.label,
      moduleId: track.moduleId,
      lessons,
      completedCount,
      totalCount,
      coveragePercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  });
}

export function detectKnowledgeGapIssues(context: CurriculumPlannerContext): KnowledgeGapIssue[] {
  const issues: KnowledgeGapIssue[] = [];
  const graph = buildKnowledgeGraph(context.activeEntries);
  const graphSummary = summarizeGraph(graph);

  const dashboard = buildCurriculumDashboard(context.activeEntries, {
    moduleTargets: context.moduleTargets,
  });

  for (const mod of dashboard.modules) {
    if (mod.remainingLessons <= 5) continue;
    const ratio = mod.completedLessons / Math.max(1, mod.targetLessons);
    if (ratio >= 0.45) continue;
    issues.push({
      id: `weak-${mod.id}`,
      kind: "weak_coverage",
      title: `${mod.name} is under-documented`,
      description: `${mod.completedLessons} of ${mod.targetLessons} target lessons complete (${mod.remainingLessons} remaining).`,
      severity: ratio < 0.2 ? "critical" : ratio < 0.35 ? "high" : "medium",
      moduleId: mod.id,
      category: mod.defaultCategory,
    });
  }

  if (graphSummary.orphanCount > 0) {
    issues.push({
      id: "orphan-lessons",
      kind: "orphan",
      title: `${graphSummary.orphanCount} disconnected lesson(s)`,
      description: "Lessons with no graph relationships — harder for AI to connect topics.",
      severity: graphSummary.orphanCount > 8 ? "high" : "medium",
    });
  }

  for (const entry of context.activeEntries) {
    const health = computeKnowledgeHealth(entry, context.activeEntries);
    if (health.issues.includes("Duplicate exists")) {
      issues.push({
        id: `dup-${entry.id}`,
        kind: "duplicate",
        title: "Potential duplicate lesson",
        description: entry.question,
        severity: "medium",
        entryId: entry.id,
        category: entry.category,
      });
    }

    const deps = DEPENDENCY_CHAINS[entry.question] ?? [];
    const missingDeps = deps.filter((d) => !findEntryByQuestion(d, context.activeEntries));
    if (missingDeps.length > 0) {
      issues.push({
        id: `broken-dep-${entry.id}`,
        kind: "broken_dependency",
        title: "Missing prerequisite lesson",
        description: `"${entry.question}" depends on: ${missingDeps.join(", ")}`,
        severity: "high",
        entryId: entry.id,
        moduleId: entry.curriculum_module as CurriculumModuleId | undefined,
      });
    }
  }

  const usedCategories = new Set(context.activeEntries.map((e) => e.category));
  const unused = CURRICULUM_MODULES.filter((m) => !usedCategories.has(m.defaultCategory));
  for (const mod of unused.slice(0, 4)) {
    issues.push({
      id: `unused-cat-${mod.id}`,
      kind: "unused_category",
      title: `No lessons in ${mod.defaultCategory}`,
      description: `The ${mod.name} category has zero published lessons.`,
      severity: "high",
      moduleId: mod.id,
      category: mod.defaultCategory,
    });
  }

  for (const unanswered of context.unanswered.filter((u) => (u.occurrences ?? 0) >= 3).slice(0, 5)) {
    if (findEntryByQuestion(unanswered.question, context.activeEntries)) continue;
    issues.push({
      id: `missing-${unanswered.id}`,
      kind: "missing_concept",
      title: "Repeated unanswered question",
      description: `"${unanswered.question}" (${unanswered.occurrences ?? 1}×)`,
      severity: (unanswered.occurrences ?? 0) >= 8 ? "critical" : "high",
    });
  }

  return issues
    .sort((a, b) => priorityRank(b.severity) - priorityRank(a.severity))
    .slice(0, 24);
}

function priorityRank(level: LessonPlannerPriority): number {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

export function computeCurriculumPlannerAnalytics(
  context: CurriculumPlannerContext,
  recommendations: PriorityLessonSuggestion[]
): CurriculumPlannerAnalytics {
  const dashboard = buildCurriculumDashboard(context.activeEntries, {
    moduleTargets: context.moduleTargets,
  });

  const totalTarget = dashboard.modules.reduce((s, m) => s + m.targetLessons, 0);
  const totalCompleted = dashboard.modules.reduce((s, m) => s + m.completedLessons, 0);
  const knowledgeCoveragePercent =
    totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  let criticalTotal = 0;
  let criticalCompleted = 0;
  for (const seeds of Object.values(MODULE_QUESTION_BANK)) {
    for (const seed of seeds) {
      if (seed.priority !== "critical") continue;
      criticalTotal++;
      if (findEntryByQuestion(seed.question, context.activeEntries)) criticalCompleted++;
    }
  }

  const mediumPriorityCount = recommendations.filter((r) => r.priorityLevel === "medium").length;
  const lowPriorityCount = recommendations.filter((r) => r.priorityLevel === "low").length;

  const categoryCoverage = [...context.categoryLessonCounts.entries()]
    .map(([category, lessonCount]) => ({ category, lessonCount }))
    .sort((a, b) => b.lessonCount - a.lessonCount)
    .slice(0, 12);

  const estimatedTrainingCompletionPercent = Math.round(
    knowledgeCoveragePercent * 0.55 +
      (criticalTotal > 0 ? (criticalCompleted / criticalTotal) * 100 : 0) * 0.3 +
      Math.max(0, 100 - recommendations.length * 2) * 0.15
  );

  return {
    knowledgeCoveragePercent,
    criticalLessonsCompleted: criticalCompleted,
    criticalLessonsTotal: criticalTotal,
    mediumPriorityCount,
    lowPriorityCount,
    estimatedTrainingCompletionPercent: Math.min(100, estimatedTrainingCompletionPercent),
    categoryCoverage,
  };
}

export function buildCurriculumPlannerSnapshot(input: {
  entries: AIKnowledgeEntry[];
  unanswered?: AIUnansweredQuestion[];
  learningEvents?: LearningEventRow[];
  moduleTargets?: Record<string, number>;
}): CurriculumPlannerSnapshot {
  const context = buildCurriculumPlannerContext(input);
  const topRecommendations = buildTopLessonRecommendations(context);
  return {
    analytics: computeCurriculumPlannerAnalytics(context, topRecommendations),
    roadmap: buildKnowledgeRoadmap(context),
    gapIssues: detectKnowledgeGapIssues(context),
    topRecommendations,
  };
}

export function filterPrioritySuggestions(
  suggestions: PriorityLessonSuggestion[],
  filter: PlannerFilter,
  options?: { category?: string; intent?: string }
): PriorityLessonSuggestion[] {
  let result = [...suggestions];

  switch (filter) {
    case "critical":
      result = result.filter((s) => s.priorityLevel === "critical");
      break;
    case "high":
      result = result.filter((s) => s.priorityLevel === "high" || s.priorityLevel === "critical");
      break;
    case "category":
      if (options?.category) {
        result = result.filter((s) => s.category === options.category);
      }
      break;
    case "intent":
      if (options?.intent) {
        result = result.filter((s) => s.intent.toLowerCase().includes(options.intent!.toLowerCase()));
      }
      break;
    case "coverage_gap":
      result = result.sort((a, b) => b.factors.coverageGap - a.factors.coverageGap);
      break;
    case "recently_searched":
      result = result.filter((s) => s.searchDemand !== "none").sort(
        (a, b) => b.factors.searchFrequency - a.factors.searchFrequency
      );
      break;
    case "most_requested":
      result = result.sort((a, b) => b.factors.searchFrequency - a.factors.searchFrequency);
      break;
    case "low_confidence":
      result = result.sort((a, b) => b.factors.aiConfidence - a.factors.aiConfidence);
      break;
    case "newest":
      break;
    default:
      break;
  }

  return result.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function serializePrioritySuggestion(s: PriorityLessonSuggestion) {
  return {
    question: s.question,
    entryId: s.entryId,
    inDatabase: s.inDatabase,
    reason: s.reason,
    priorityScore: s.priorityScore,
    priorityLevel: s.priorityLevel,
    starRating: s.starRating,
    category: s.category,
    intent: s.intent,
    moduleId: s.moduleId ?? null,
    moduleName: s.moduleName ?? null,
    factors: s.factors,
    searchDemand: s.searchDemand,
    customerImpact: s.customerImpact,
    coverageContribution: s.coverageContribution,
    prerequisites: s.prerequisites,
    sources: s.sources,
    becauseYouCreated: s.becauseYouCreated ?? null,
  };
}

/** Score the lesson currently being authored for curriculum priority. */
export function scoreAuthoringQuestion(
  question: string,
  context: CurriculumPlannerContext,
  options?: { excludeId?: string; category?: string }
): PriorityLessonSuggestion {
  const trimmed = question.trim();
  const entry = findEntryByQuestion(trimmed, context.activeEntries, options?.excludeId);
  return scoreLessonSuggestion({
    question: trimmed,
    inDatabase: Boolean(entry),
    context,
    categoryHint: options?.category,
    sources: entry ? ["graph"] : ["seed", "gap"],
    excludeId: options?.excludeId,
    becauseYouCreated: trimmed,
  });
}
