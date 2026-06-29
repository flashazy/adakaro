import { NextResponse } from "next/server";
import { buildCurriculumPlannerSnapshot } from "@/lib/ai-training/knowledge-curriculum-planner";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry, AIUnansweredQuestion } from "@/lib/ai-training/types";
import type { LearningEventRow } from "@/lib/ai-training/learning-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const [entriesRes, unansweredRes, eventsRes, targetsRes] = await Promise.all([
    auth.dataClient.from("ai_knowledge_entries").select("*"),
    auth.dataClient.from("ai_unanswered_questions").select("*").limit(500),
    auth.dataClient
      .from("ai_learning_events")
      .select("*")
      .eq("source", "public_ai")
      .order("created_at", { ascending: false })
      .limit(3000),
    auth.dataClient.from("ai_curriculum_module_targets").select("*"),
  ]);

  const moduleTargets: Record<string, number> = {};
  for (const row of targetsRes.data ?? []) {
    const r = row as { module_id: string; target_lessons: number };
    moduleTargets[r.module_id] = r.target_lessons;
  }

  const snapshot = buildCurriculumPlannerSnapshot({
    entries: (entriesRes.data ?? []) as AIKnowledgeEntry[],
    unanswered: (unansweredRes.data ?? []) as AIUnansweredQuestion[],
    learningEvents: (eventsRes.data ?? []) as LearningEventRow[],
    moduleTargets,
  });

  return NextResponse.json(snapshot);
}
