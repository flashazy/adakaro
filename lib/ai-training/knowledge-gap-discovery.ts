/**
 * Knowledge Gap Discovery — find missing knowledge from multiple sources (Phase 2).
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import { CURRICULUM_MODULES, buildCurriculumDashboard } from "./knowledge-curriculum";
import { MODULE_QUESTION_BANK } from "./lesson-generation-prompt";
import type {
  GapSource,
  KnowledgeOpportunity,
  OpportunityPriority,
} from "./knowledge-intelligence-types";
import type { AIKnowledgeEntry, AIUnansweredQuestion } from "./types";
import type { LearningEventRow } from "./learning-types";

function priorityFromImpact(impact: "high" | "medium" | "low", occurrences = 0): OpportunityPriority {
  if (impact === "high" || occurrences >= 10) return "critical";
  if (impact === "medium" || occurrences >= 5) return "high";
  if (occurrences >= 2) return "normal";
  return "low";
}

export function discoverKnowledgeGaps(input: {
  entries: AIKnowledgeEntry[];
  unanswered: AIUnansweredQuestion[];
  learningEvents?: LearningEventRow[];
  moduleTargets?: Record<string, number>;
}): KnowledgeOpportunity[] {
  const opportunities: KnowledgeOpportunity[] = [];
  const dashboard = buildCurriculumDashboard(input.entries, {
    moduleTargets: input.moduleTargets ?? {},
  });

  for (const mod of dashboard.modules) {
    if (mod.remainingLessons <= 0) continue;
    opportunities.push({
      id: `gap-curriculum-${mod.id}`,
      moduleId: mod.id,
      moduleName: mod.name,
      topic: mod.name,
      reason: `${mod.remainingLessons} curriculum lessons still missing`,
      sources: ["curriculum_coverage"],
      priority: mod.remainingLessons > 20 ? "critical" : mod.remainingLessons > 8 ? "high" : "normal",
      estimatedLessons: mod.remainingLessons,
      impact: mod.remainingLessons > 15 ? "high" : "medium",
    });
  }

  const unansweredByModule = clusterUnanswered(input.unanswered);
  for (const cluster of unansweredByModule) {
    opportunities.push({
      id: `gap-unanswered-${cluster.moduleId}-${cluster.topic.slice(0, 20)}`,
      moduleId: cluster.moduleId,
      moduleName: cluster.moduleName,
      topic: cluster.topic,
      reason: "Frequently requested by users — no matching lesson",
      sources: cluster.sources,
      priority: priorityFromImpact("high", cluster.occurrences),
      estimatedLessons: Math.min(12, Math.max(1, Math.ceil(cluster.occurrences / 3))),
      impact: "high",
      occurrences: cluster.occurrences,
      sampleQuestions: cluster.questions.slice(0, 3),
    });
  }

  if (input.learningEvents?.length) {
    const lowConf = input.learningEvents.filter(
      (e) => e.confidence_level === "low" || (e.final_score ?? 0) < 0.42
    );
    const intentCounts = new Map<string, number>();
    for (const e of lowConf) {
      const key = e.matched_intent_key ?? "general";
      intentCounts.set(key, (intentCounts.get(key) ?? 0) + 1);
    }
    for (const [intentKey, count] of [...intentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      const mod = inferModuleFromIntent(intentKey);
      opportunities.push({
        id: `gap-lowconf-${intentKey}`,
        moduleId: mod.id,
        moduleName: mod.name,
        topic: intentKey.replace(/[._]/g, " "),
        reason: "Low confidence answers — knowledge may be weak or missing",
        sources: ["low_confidence", "retrieval_failure"],
        priority: priorityFromImpact("medium", count),
        estimatedLessons: Math.min(8, Math.max(2, Math.ceil(count / 4))),
        impact: "medium",
        occurrences: count,
      });
    }
  }

  for (const [moduleId, seeds] of Object.entries(MODULE_QUESTION_BANK)) {
    const existingQuestions = new Set(
      input.entries
        .filter((e) => e.curriculum_module === moduleId && e.status === "active")
        .map((e) => e.question.toLowerCase())
    );
    const missing = seeds.filter((s) => !existingQuestions.has(s.question.toLowerCase()));
    if (missing.length >= 3) {
      const mod = CURRICULUM_MODULES.find((m) => m.id === moduleId);
      opportunities.push({
        id: `gap-seeds-${moduleId}`,
        moduleId: moduleId as CurriculumModuleId,
        moduleName: mod?.name ?? moduleId,
        topic: missing.slice(0, 3).map((s) => s.topicTag).join(", "),
        reason: "Standard curriculum topics not yet covered",
        sources: ["curriculum_coverage", "documentation"],
        priority: missing.length > 10 ? "high" : "normal",
        estimatedLessons: missing.length,
        impact: "medium",
        sampleQuestions: missing.slice(0, 3).map((s) => s.question),
      });
    }
  }

  return dedupeOpportunities(opportunities).slice(0, 40);
}

function clusterUnanswered(unanswered: AIUnansweredQuestion[]): Array<{
  moduleId: CurriculumModuleId;
  moduleName: string;
  topic: string;
  sources: GapSource[];
  occurrences: number;
  questions: string[];
}> {
  const pending = unanswered.filter((u) => u.status === "pending");
  const clusters = new Map<string, { occurrences: number; questions: string[]; sources: Set<GapSource> }>();

  for (const u of pending) {
    const topic = inferTopicFromQuestion(u.question);
    const mod = inferModuleFromQuestion(u.question);
    const key = `${mod.id}:${topic}`;
    const existing = clusters.get(key) ?? { occurrences: 0, questions: [], sources: new Set<GapSource>() };
    existing.occurrences += u.occurrences ?? 1;
    existing.questions.push(u.question);
    if (u.source === "copilot") existing.sources.add("copilot");
    else if (u.source === "public_ai") existing.sources.add("public_chatbot");
    else existing.sources.add("retrieval_failure");
    clusters.set(key, existing);
  }

  return [...clusters.entries()]
    .map(([key, data]) => {
      const [moduleId] = key.split(":");
      const mod = CURRICULUM_MODULES.find((m) => m.id === moduleId);
      return {
        moduleId: moduleId as CurriculumModuleId,
        moduleName: mod?.name ?? moduleId,
        topic: key.split(":").slice(1).join(":"),
        sources: [...data.sources],
        occurrences: data.occurrences,
        questions: data.questions,
      };
    })
    .filter((c) => c.occurrences >= 1)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 15);
}

function inferTopicFromQuestion(question: string): string {
  const q = question.toLowerCase();
  if (/parent|portal/.test(q)) return "Parent Portal";
  if (/fee|finance|billing|receipt/.test(q)) return "Finance";
  if (/admission|enroll/.test(q)) return "Admissions";
  if (/attendance/.test(q)) return "Attendance";
  if (/report|grade/.test(q)) return "Report Cards";
  if (/price|cost|plan/.test(q)) return "Pricing";
  return "General";
}

function inferModuleFromQuestion(question: string): { id: CurriculumModuleId; name: string } {
  const q = question.toLowerCase();
  if (/parent/.test(q)) return { id: "parent-portal", name: "Parent Portal" };
  if (/fee|finance|receipt|billing/.test(q)) return { id: "finance", name: "Finance" };
  if (/admission|enroll/.test(q)) return { id: "admissions", name: "Admissions" };
  if (/attendance/.test(q)) return { id: "attendance", name: "Attendance" };
  if (/report|grade/.test(q)) return { id: "report-cards", name: "Report Cards" };
  if (/price|cost|plan|free/.test(q)) return { id: "pricing", name: "Pricing" };
  if (/copilot|ai assist/.test(q)) return { id: "ai-copilot", name: "AI Copilot" };
  return { id: "about-adakaro", name: "About Adakaro" };
}

function inferModuleFromIntent(intentKey: string): { id: CurriculumModuleId; name: string } {
  const k = intentKey.toLowerCase();
  if (/fee|finance|billing|price/.test(k)) return { id: "finance", name: "Finance" };
  if (/attend/.test(k)) return { id: "attendance", name: "Attendance" };
  if (/parent/.test(k)) return { id: "parent-portal", name: "Parent Portal" };
  if (/report|grade/.test(k)) return { id: "report-cards", name: "Report Cards" };
  return { id: "about-adakaro", name: "About Adakaro" };
}

function dedupeOpportunities(opps: KnowledgeOpportunity[]): KnowledgeOpportunity[] {
  const seen = new Set<string>();
  return opps.filter((o) => {
    const key = `${o.moduleId}:${o.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
