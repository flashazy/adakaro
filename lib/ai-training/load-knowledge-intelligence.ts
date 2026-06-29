/**
 * Load full Knowledge Intelligence snapshot for dashboard & API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAutonomousSuggestions } from "./knowledge-autonomous-suggestions";
import { discoverKnowledgeGaps } from "./knowledge-gap-discovery";
import { summarizeGraph, buildKnowledgeGraph } from "./knowledge-graph-builder";
import {
  computeKnowledgeHealthSnapshot,
  computeModuleHealthRows,
} from "./knowledge-health-engine";
import { analyzeKnowledgeBase } from "./knowledge-intelligence-engine";
import { aggregateScorecard } from "./knowledge-intelligence-score";
import type { KnowledgeIntelligenceSnapshot, IntelligenceTrendPoint } from "./knowledge-intelligence-types";
import { buildCurriculumPlannerSnapshot } from "./knowledge-curriculum-planner";
import { buildKnowledgeMissions } from "./knowledge-missions";
import { aggregateLearningSignals } from "./knowledge-self-learning";
import type { AIKnowledgeEntry, AIUnansweredQuestion } from "./types";
import type { LearningEventRow } from "./learning-types";

async function getClient(supabase: SupabaseClient<Database>) {
  try {
    return createAdminClient();
  } catch {
    return supabase;
  }
}

export async function loadKnowledgeIntelligenceSnapshot(
  supabase: SupabaseClient<Database>
): Promise<KnowledgeIntelligenceSnapshot> {
  const client = await getClient(supabase);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [entriesRes, unansweredRes, eventsRes, targetsRes, approvalRes] = await Promise.all([
    client.from("ai_knowledge_entries").select("*"),
    client.from("ai_unanswered_questions").select("*"),
    client
      .from("ai_learning_events")
      .select("*")
      .eq("source", "public_ai")
      .order("created_at", { ascending: false })
      .limit(3000),
    client.from("ai_curriculum_module_targets").select("*"),
    client
      .from("ai_knowledge_approval_queue")
      .select("status, source_metadata")
      .gte("created_at", thirtyDaysAgo),
  ]);

  const entries = (entriesRes.data ?? []) as AIKnowledgeEntry[];
  const unanswered = (unansweredRes.data ?? []) as AIUnansweredQuestion[];
  const learningEvents = (eventsRes.data ?? []) as LearningEventRow[];

  const moduleTargets: Record<string, number> = {};
  for (const row of targetsRes.data ?? []) {
    const r = row as { module_id: string; target_lessons: number };
    moduleTargets[r.module_id] = r.target_lessons;
  }

  const approvalRows = approvalRes.data ?? [];
  const approvalCount = approvalRows.filter((r) => (r as { status: string }).status === "approved").length;
  const rejectionCount = approvalRows.filter((r) => (r as { status: string }).status === "rejected").length;

  const lowConfEvents = learningEvents.filter(
    (e) => e.confidence_level === "low" || (e.final_score ?? 0) < 0.42
  ).length;

  const learningSignals = aggregateLearningSignals({
    learningEvents,
    entries,
    approvalCount,
    rejectionCount,
  });

  const moduleHealth = computeModuleHealthRows(entries, moduleTargets);
  const avgConfidence =
    learningEvents.length > 0
      ? Math.round(
          (learningEvents.filter((e) => e.answer_status === "answered").length /
            Math.max(1, learningEvents.length)) *
            100
        )
      : 85;

  const health = computeKnowledgeHealthSnapshot(entries, moduleTargets, avgConfidence);
  const opportunities = discoverKnowledgeGaps({
    entries,
    unanswered,
    learningEvents,
    moduleTargets,
  });

  const missions = buildKnowledgeMissions({
    opportunities,
    moduleHealth,
    entries,
    lowConfidenceCount: lowConfEvents,
    duplicateRiskCount: moduleHealth.filter((m) => m.duplicateRisk > 40).length,
  });

  const recommendations = analyzeKnowledgeBase({
    entries,
    unansweredQuestions: unanswered
      .filter((u) => u.status === "pending")
      .map((u) => ({ question: u.question, occurrences: u.occurrences ?? 1 })),
  });

  const autonomousSuggestions = generateAutonomousSuggestions({
    health,
    opportunities,
    learningSignals,
  });

  const active = entries.filter((e) => e.status === "active");
  const scorecard = aggregateScorecard(active);
  const graph = buildKnowledgeGraph(active);
  const graphSummary = summarizeGraph(graph);

  const topMissingTopics = opportunities.slice(0, 8).map((o) => ({
    topic: o.topic,
    count: o.estimatedLessons,
    moduleId: o.moduleId,
  }));

  const topUnansweredQuestions = unanswered
    .filter((u) => u.status === "pending")
    .sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))
    .slice(0, 8)
    .map((u) => ({
      question: u.question,
      occurrences: u.occurrences ?? 1,
      source: u.source,
    }));

  const sortedModules = [...moduleHealth].sort((a, b) => a.health - b.health);
  const weakestModules = sortedModules.slice(0, 5);
  const strongestModules = [...moduleHealth].sort((a, b) => b.health - a.health).slice(0, 5);

  const trends = buildTrendPoints(entries, learningEvents);
  const planner = buildCurriculumPlannerSnapshot({
    entries,
    unanswered,
    learningEvents,
    moduleTargets,
  });

  return {
    generatedAt: new Date().toISOString(),
    health,
    moduleHealth,
    opportunities,
    missions,
    recommendations,
    autonomousSuggestions,
    learningSignals,
    scorecard,
    trends,
    topMissingTopics,
    topUnansweredQuestions,
    weakestModules,
    strongestModules,
    graphSummary,
    planner,
  };
}

function buildTrendPoints(
  entries: AIKnowledgeEntry[],
  events: LearningEventRow[]
): IntelligenceTrendPoint[] {
  const days = 7;
  const points: IntelligenceTrendPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = `${dateStr}T00:00:00.000Z`;
    const dayEnd = `${dateStr}T23:59:59.999Z`;

    const lessonsCreated = entries.filter(
      (e) => e.created_at >= dayStart && e.created_at <= dayEnd
    ).length;

    const dayEvents = events.filter((e) => e.created_at >= dayStart && e.created_at <= dayEnd);
    const answered = dayEvents.filter((e) => e.answer_status === "answered").length;
    const confidence =
      dayEvents.length > 0 ? Math.round((answered / dayEvents.length) * 100) : 85;

    points.push({
      date: dateStr,
      health: Math.min(100, 60 + lessonsCreated * 2 + confidence * 0.3),
      coverage: Math.min(100, 40 + entries.length * 0.1),
      confidence,
      lessonsCreated,
    });
  }

  return points;
}

export async function loadKnowledgeGraphData(supabase: SupabaseClient<Database>) {
  const client = await getClient(supabase);
  const { data } = await client.from("ai_knowledge_entries").select("*").eq("status", "active");
  return buildKnowledgeGraph((data ?? []) as AIKnowledgeEntry[]);
}
