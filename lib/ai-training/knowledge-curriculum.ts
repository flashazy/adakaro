/**
 * Knowledge Curriculum — maps knowledge entries to curriculum modules and lessons.
 * Single data source: ai_knowledge_entries (each entry = one lesson).
 */

import { computeKnowledgeHealth } from "./knowledge-duplicates";
import { validateKnowledgeWritingStandard } from "./knowledge-writing-standard";
import type { AIKnowledgeEntry, KnowledgeHealthLevel, KnowledgePriority } from "./types";

export type CurriculumModuleId =
  | "about-adakaro"
  | "pricing"
  | "getting-started"
  | "student-management"
  | "admissions"
  | "classes-streams"
  | "teachers-staff"
  | "attendance"
  | "report-cards"
  | "finance"
  | "parent-portal"
  | "communication"
  | "curriculum-syllabus"
  | "promotions"
  | "student-streaming"
  | "security-roles"
  | "ai-copilot"
  | "troubleshooting";

export type LessonStatus =
  | "published"
  | "draft"
  | "needs_review"
  | "archived";

export type ModuleHealthLabel = "excellent" | "good" | "needs_improvement" | "incomplete";

export type ModuleProgressStatus = "complete" | "in_progress" | "not_started";

export interface CurriculumModuleDefinition {
  id: CurriculumModuleId;
  name: string;
  description: string;
  defaultCategory: string;
  defaultTarget: number;
  sortOrder: number;
}

export const CURRICULUM_MODULES: CurriculumModuleDefinition[] = [
  {
    id: "about-adakaro",
    name: "About Adakaro",
    description: "Platform overview, identity, and core value for schools.",
    defaultCategory: "General",
    defaultTarget: 80,
    sortOrder: 1,
  },
  {
    id: "pricing",
    name: "Pricing",
    description: "Plans, billing, free tier, and cost-related questions.",
    defaultCategory: "Pricing",
    defaultTarget: 60,
    sortOrder: 2,
  },
  {
    id: "getting-started",
    name: "Getting Started",
    description: "Onboarding, setup, demos, and first steps for new schools.",
    defaultCategory: "Onboarding",
    defaultTarget: 90,
    sortOrder: 3,
  },
  {
    id: "student-management",
    name: "Student Management",
    description: "Enrollment, profiles, records, and learner lifecycle.",
    defaultCategory: "Student Management",
    defaultTarget: 140,
    sortOrder: 4,
  },
  {
    id: "admissions",
    name: "Admissions",
    description: "Enrollment desk, intake, and admission workflows.",
    defaultCategory: "Student Management",
    defaultTarget: 100,
    sortOrder: 5,
  },
  {
    id: "classes-streams",
    name: "Classes & Streams",
    description: "Class structure, subjects, and stream placement.",
    defaultCategory: "General",
    defaultTarget: 120,
    sortOrder: 6,
  },
  {
    id: "teachers-staff",
    name: "Teachers & Staff",
    description: "Teacher roles, assignments, and staff management.",
    defaultCategory: "General",
    defaultTarget: 110,
    sortOrder: 7,
  },
  {
    id: "attendance",
    name: "Attendance",
    description: "Daily attendance, subject attendance, and visibility.",
    defaultCategory: "Attendance",
    defaultTarget: 100,
    sortOrder: 8,
  },
  {
    id: "report-cards",
    name: "Report Cards",
    description: "Grading, report cards, PDF export, and publishing.",
    defaultCategory: "Report Cards",
    defaultTarget: 130,
    sortOrder: 9,
  },
  {
    id: "finance",
    name: "Finance",
    description: "Fees, payments, receipts, balances, and billing.",
    defaultCategory: "Finance",
    defaultTarget: 120,
    sortOrder: 10,
  },
  {
    id: "parent-portal",
    name: "Parent Portal",
    description: "Parent access, visibility, and family communication.",
    defaultCategory: "Parent Portal",
    defaultTarget: 110,
    sortOrder: 11,
  },
  {
    id: "communication",
    name: "Communication",
    description: "Messaging, broadcasts, and school-wide announcements.",
    defaultCategory: "Support",
    defaultTarget: 80,
    sortOrder: 12,
  },
  {
    id: "curriculum-syllabus",
    name: "Curriculum & Syllabus",
    description: "Syllabus coverage, topics, and academic planning.",
    defaultCategory: "Syllabus",
    defaultTarget: 90,
    sortOrder: 13,
  },
  {
    id: "promotions",
    name: "Promotions",
    description: "Class promotions, academic progression, and transfers.",
    defaultCategory: "General",
    defaultTarget: 80,
    sortOrder: 14,
  },
  {
    id: "student-streaming",
    name: "Student Streaming",
    description: "Stream placement, class changes, and movement history.",
    defaultCategory: "Student Management",
    defaultTarget: 70,
    sortOrder: 15,
  },
  {
    id: "security-roles",
    name: "Security & Roles",
    description: "Permissions, roles, and access control.",
    defaultCategory: "Support",
    defaultTarget: 90,
    sortOrder: 16,
  },
  {
    id: "ai-copilot",
    name: "AI Copilot",
    description: "In-dashboard AI assistant capabilities and usage.",
    defaultCategory: "General",
    defaultTarget: 80,
    sortOrder: 17,
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    description: "Common issues, fixes, and support guidance.",
    defaultCategory: "Support",
    defaultTarget: 100,
    sortOrder: 18,
  },
];

export const DEFAULT_KNOWLEDGE_TARGET = 2500;

const CATEGORY_TO_MODULE: Record<string, CurriculumModuleId> = {
  General: "about-adakaro",
  Pricing: "pricing",
  Onboarding: "getting-started",
  "Student Management": "student-management",
  Attendance: "attendance",
  "Report Cards": "report-cards",
  Finance: "finance",
  "Parent Portal": "parent-portal",
  Syllabus: "curriculum-syllabus",
  Support: "troubleshooting",
};

export interface LessonChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface CurriculumLesson {
  lessonNumber: number;
  entryId: string;
  question: string;
  intentKey: string | null;
  intentName: string | null;
  priority: KnowledgePriority;
  status: LessonStatus;
  health: KnowledgeHealthLevel | "unknown";
  createdAt: string;
  updatedAt: string;
  checklist: LessonChecklistItem[];
  checklistScore: number;
  moduleId: CurriculumModuleId;
  category: string;
}

export interface CurriculumModuleRow {
  id: CurriculumModuleId;
  name: string;
  description: string;
  defaultCategory: string;
  targetLessons: number;
  completedLessons: number;
  remainingLessons: number;
  completionPercent: number;
  health: ModuleHealthLabel;
  status: ModuleProgressStatus;
  pendingApprovalCount: number;
  lessons: CurriculumLesson[];
  duplicateRate: number;
  missingMetadataCount: number;
  untestedCount: number;
  needsReviewCount: number;
}

export interface CurriculumCoverageInsight {
  strongAreas: string[];
  weakAreas: string[];
  emptyModules: string[];
  largestModule: { name: string; count: number } | null;
  smallestModule: { name: string; count: number } | null;
  mostImprovedModule: { name: string; recentCount: number } | null;
}

export interface CurriculumDashboardData {
  summary: {
    totalEntries: number;
    totalModules: number;
    completedModules: number;
    lessonsCompleted: number;
    lessonsRemaining: number;
    overallCompletionPercent: number;
    knowledgeTarget: number;
    lastUpdated: string | null;
  };
  modules: CurriculumModuleRow[];
  coverage: CurriculumCoverageInsight;
}

export function resolveEntryModuleId(
  entry: Pick<AIKnowledgeEntry, "category" | "curriculum_module">
): CurriculumModuleId {
  const explicit = entry.curriculum_module as CurriculumModuleId | null | undefined;
  if (explicit && CURRICULUM_MODULES.some((m) => m.id === explicit)) {
    return explicit;
  }
  return CATEGORY_TO_MODULE[entry.category] ?? "about-adakaro";
}

export function getModuleDefinition(id: CurriculumModuleId): CurriculumModuleDefinition {
  return CURRICULUM_MODULES.find((m) => m.id === id)!;
}

function buildLessonChecklist(entry: AIKnowledgeEntry): {
  items: LessonChecklistItem[];
  score: number;
} {
  const validation = validateKnowledgeWritingStandard({
    category: entry.category,
    question: entry.question,
    answer: entry.answer,
    keywords: entry.keywords,
    search_phrases: entry.search_phrases,
    alternative_wording: entry.alternative_wording,
    synonyms: entry.synonyms ?? [],
    related_terms: entry.related_terms,
    priority: entry.priority,
    intent_key: entry.intent_key,
  });

  const items: LessonChecklistItem[] = [
    { id: "entry", label: "Knowledge entry exists", done: true },
    {
      id: "metadata",
      label: "Metadata complete",
      done: validation.requiredPassed,
    },
    {
      id: "intent",
      label: "Intent assigned",
      done: Boolean(entry.intent_key),
    },
    {
      id: "keywords",
      label: "Keywords complete",
      done: entry.keywords.length >= 3,
    },
    {
      id: "synonyms",
      label: "Synonyms complete",
      done: (entry.synonyms ?? []).length >= 1,
    },
    {
      id: "phrases",
      label: "Search phrases complete",
      done: entry.search_phrases.length >= 1,
    },
    {
      id: "wording",
      label: "Alternative wording complete",
      done: entry.alternative_wording.length >= 1,
    },
    {
      id: "related",
      label: "Related terms complete",
      done: entry.related_terms.length >= 1,
    },
    {
      id: "health",
      label: "Health good",
      done: (entry.health_status ?? "needs_review") === "healthy",
    },
    {
      id: "tested",
      label: "Tested successfully",
      done: entry.usage_count >= 1,
    },
  ];

  const score = Math.round(
    (items.filter((i) => i.done).length / items.length) * 100
  );
  return { items, score };
}

export function resolveLessonStatus(entry: AIKnowledgeEntry): LessonStatus {
  if (entry.status === "archived") return "archived";
  if ((entry.health_status ?? "needs_review") === "needs_review") {
    return "needs_review";
  }
  const { score } = buildLessonChecklist(entry);
  if (score >= 80 && entry.answer.trim().length >= 80) return "published";
  return "draft";
}

function computeModuleHealth(input: {
  completionPercent: number;
  duplicateRate: number;
  needsReviewCount: number;
  completedLessons: number;
  missingMetadataCount: number;
  untestedCount: number;
}): ModuleHealthLabel {
  const {
    completionPercent,
    duplicateRate,
    needsReviewCount,
    completedLessons,
    missingMetadataCount,
    untestedCount,
  } = input;

  if (completedLessons === 0) return "incomplete";

  const penalty =
    duplicateRate * 0.2 +
    (needsReviewCount / Math.max(1, completedLessons)) * 0.25 +
    (missingMetadataCount / Math.max(1, completedLessons)) * 0.2 +
    (untestedCount / Math.max(1, completedLessons)) * 0.1;

  const score = completionPercent / 100 - penalty;

  if (score >= 0.75 && completionPercent >= 70) return "excellent";
  if (score >= 0.5 && completionPercent >= 40) return "good";
  if (completionPercent >= 15) return "needs_improvement";
  return "incomplete";
}

function computeModuleStatus(
  completionPercent: number,
  completedLessons: number
): ModuleProgressStatus {
  if (completionPercent >= 100) return "complete";
  if (completedLessons > 0) return "in_progress";
  return "not_started";
}

export function buildCurriculumDashboard(
  entries: AIKnowledgeEntry[],
  options?: {
    knowledgeTarget?: number;
    moduleTargets?: Record<string, number>;
    pendingApprovalByModule?: Record<string, number>;
  }
): CurriculumDashboardData {
  const knowledgeTarget = options?.knowledgeTarget ?? DEFAULT_KNOWLEDGE_TARGET;
  const moduleTargets = options?.moduleTargets ?? {};
  const pendingApprovalByModule = options?.pendingApprovalByModule ?? {};

  const activePrimary = entries.filter(
    (e) => e.status === "active" && e.is_primary !== false && !e.merged_into_id
  );

  const byModule = new Map<CurriculumModuleId, AIKnowledgeEntry[]>();
  for (const mod of CURRICULUM_MODULES) {
    byModule.set(mod.id, []);
  }

  for (const entry of activePrimary) {
    const moduleId = resolveEntryModuleId(entry);
    byModule.get(moduleId)?.push(entry);
  }

  let lastUpdated: string | null = null;
  for (const entry of activePrimary) {
    if (!lastUpdated || entry.updated_at > lastUpdated) {
      lastUpdated = entry.updated_at;
    }
  }

  const modules: CurriculumModuleRow[] = CURRICULUM_MODULES.map((def) => {
    const moduleEntries = (byModule.get(def.id) ?? []).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const targetLessons =
      moduleTargets[def.id] ?? def.defaultTarget;

    const lessons: CurriculumLesson[] = moduleEntries.map((entry, index) => {
      const checklist = buildLessonChecklist(entry);
      return {
        lessonNumber: index + 1,
        entryId: entry.id,
        question: entry.question,
        intentKey: entry.intent_key ?? null,
        intentName: entry.intent_name ?? null,
        priority: entry.priority,
        status: resolveLessonStatus(entry),
        health: entry.health_status ?? "unknown",
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
        checklist: checklist.items,
        checklistScore: checklist.score,
        moduleId: def.id,
        category: entry.category,
      };
    });

    const completedLessons = lessons.filter((l) => l.status === "published").length;
    const remainingLessons = Math.max(0, targetLessons - completedLessons);
    const completionPercent = Math.min(
      100,
      Math.round((completedLessons / Math.max(1, targetLessons)) * 100)
    );

    let duplicateCount = 0;
    let missingMetadataCount = 0;
    let untestedCount = 0;
    let needsReviewCount = 0;

    for (const entry of moduleEntries) {
      const health = computeKnowledgeHealth(entry, activePrimary);
      if (health.issues.includes("Duplicate exists")) duplicateCount++;
      const validation = validateKnowledgeWritingStandard({
        category: entry.category,
        question: entry.question,
        answer: entry.answer,
        keywords: entry.keywords,
        search_phrases: entry.search_phrases,
        alternative_wording: entry.alternative_wording,
        synonyms: entry.synonyms ?? [],
        related_terms: entry.related_terms,
        priority: entry.priority,
        intent_key: entry.intent_key,
      });
      if (!validation.requiredPassed) missingMetadataCount++;
      if (entry.usage_count < 1) untestedCount++;
      if ((entry.health_status ?? "needs_review") === "needs_review") {
        needsReviewCount++;
      }
    }

    const duplicateRate =
      moduleEntries.length === 0
        ? 0
        : Math.round((duplicateCount / moduleEntries.length) * 100) / 100;

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      defaultCategory: def.defaultCategory,
      targetLessons,
      completedLessons,
      remainingLessons,
      completionPercent,
      health: computeModuleHealth({
        completionPercent,
        duplicateRate,
        needsReviewCount,
        completedLessons: moduleEntries.length,
        missingMetadataCount,
        untestedCount,
      }),
      status: computeModuleStatus(completionPercent, moduleEntries.length),
      lessons,
      duplicateRate,
      missingMetadataCount,
      untestedCount,
      needsReviewCount,
      pendingApprovalCount: pendingApprovalByModule[def.id] ?? 0,
    };
  });

  const lessonsCompleted = modules.reduce((sum, m) => sum + m.completedLessons, 0);
  const lessonsRemaining = Math.max(0, knowledgeTarget - lessonsCompleted);
  const overallCompletionPercent = Math.min(
    100,
    Math.round((lessonsCompleted / Math.max(1, knowledgeTarget)) * 100)
  );

  const completedModules = modules.filter((m) => m.status === "complete").length;

  const coverage = buildCoverageInsight(modules, activePrimary);

  return {
    summary: {
      totalEntries: activePrimary.length,
      totalModules: CURRICULUM_MODULES.length,
      completedModules,
      lessonsCompleted,
      lessonsRemaining,
      overallCompletionPercent,
      knowledgeTarget,
      lastUpdated,
    },
    modules,
    coverage,
  };
}

function buildCoverageInsight(
  modules: CurriculumModuleRow[],
  entries: AIKnowledgeEntry[]
): CurriculumCoverageInsight {
  const withLessons = modules.filter((m) => m.lessons.length > 0);
  const emptyModules = modules
    .filter((m) => m.lessons.length === 0)
    .map((m) => m.name);

  const sortedByCompletion = [...modules].sort(
    (a, b) => b.completionPercent - a.completionPercent
  );
  const sortedByCount = [...modules].sort(
    (a, b) => b.lessons.length - a.lessons.length
  );

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentByModule = modules.map((m) => ({
    name: m.name,
    recentCount: m.lessons.filter(
      (l) => new Date(l.updatedAt).getTime() >= thirtyDaysAgo
    ).length,
  }));
  const mostImproved = [...recentByModule].sort(
    (a, b) => b.recentCount - a.recentCount
  )[0];

  return {
    strongAreas: sortedByCompletion
      .filter((m) => m.completionPercent >= 60 && m.lessons.length > 0)
      .slice(0, 4)
      .map((m) => m.name),
    weakAreas: sortedByCompletion
      .filter((m) => m.completionPercent < 30 && m.targetLessons >= 50)
      .slice(-4)
      .reverse()
      .map((m) => m.name),
    emptyModules,
    largestModule: sortedByCount[0]
      ? { name: sortedByCount[0].name, count: sortedByCount[0].lessons.length }
      : null,
    smallestModule: withLessons.length
      ? {
          name: withLessons[withLessons.length - 1]!.name,
          count: withLessons[withLessons.length - 1]!.lessons.length,
        }
      : null,
    mostImprovedModule:
      mostImproved && mostImproved.recentCount > 0
        ? { name: mostImproved.name, recentCount: mostImproved.recentCount }
        : null,
  };
}

export function filterCurriculumLessons(
  modules: CurriculumModuleRow[],
  filters: {
    moduleId?: string;
    priority?: string;
    status?: string;
    health?: string;
    intent?: string;
    needsReview?: boolean;
    missingLessons?: boolean;
    search?: string;
  }
): CurriculumLesson[] {
  let lessons = modules.flatMap((m) => m.lessons);

  if (filters.moduleId) {
    lessons = lessons.filter((l) => l.moduleId === filters.moduleId);
  }
  if (filters.priority) {
    lessons = lessons.filter((l) => l.priority === filters.priority);
  }
  if (filters.status) {
    lessons = lessons.filter((l) => l.status === filters.status);
  }
  if (filters.health) {
    lessons = lessons.filter((l) => l.health === filters.health);
  }
  if (filters.intent) {
    const q = filters.intent.toLowerCase();
    lessons = lessons.filter(
      (l) =>
        l.intentKey?.toLowerCase().includes(q) ||
        l.intentName?.toLowerCase().includes(q)
    );
  }
  if (filters.needsReview) {
    lessons = lessons.filter((l) => l.status === "needs_review");
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    lessons = lessons.filter((l) => l.question.toLowerCase().includes(q));
  }

  return lessons;
}

export function moduleTargetsFromRows(
  rows: Array<{ module_id: string; target_lessons: number }> | null
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows ?? []) {
    map[row.module_id] = row.target_lessons;
  }
  return map;
}
