import { NextRequest, NextResponse } from "next/server";
import {
  buildCurriculumDashboard,
  DEFAULT_KNOWLEDGE_TARGET,
  moduleTargetsFromRows,
} from "@/lib/ai-training/knowledge-curriculum";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { dataClient } = auth;

  const [entriesRes, settingsRes, targetsRes] = await Promise.all([
    dataClient
      .from("ai_knowledge_entries")
      .select("*")
      .order("updated_at", { ascending: false }),
    dataClient
      .from("ai_curriculum_settings")
      .select("knowledge_target")
      .eq("id", "default")
      .maybeSingle(),
    dataClient.from("ai_curriculum_module_targets").select("module_id, target_lessons"),
  ]);

  if (entriesRes.error) {
    return NextResponse.json({ error: entriesRes.error.message }, { status: 500 });
  }

  const entries = (entriesRes.data ?? []).map((row) => {
    const entry = row as AIKnowledgeEntry & { curriculum_module?: string | null };
    return {
      ...entry,
      synonyms: entry.synonyms ?? [],
      curriculum_module: entry.curriculum_module ?? null,
    };
  });

  const knowledgeTarget =
    (settingsRes.data as { knowledge_target?: number } | null)?.knowledge_target ??
    DEFAULT_KNOWLEDGE_TARGET;

  const moduleTargets = moduleTargetsFromRows(
    (targetsRes.data ?? []) as Array<{
      module_id: string;
      target_lessons: number;
    }>
  );

  const dashboard = buildCurriculumDashboard(entries, {
    knowledgeTarget,
    moduleTargets,
  });

  return NextResponse.json({
    ...dashboard,
    knowledgeTarget,
    moduleTargets,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    knowledgeTarget?: number;
  };

  if (
    body.knowledgeTarget == null ||
    !Number.isFinite(body.knowledgeTarget) ||
    body.knowledgeTarget < 1
  ) {
    return NextResponse.json(
      { error: "knowledgeTarget must be a positive number." },
      { status: 400 }
    );
  }

  const { dataClient, userId } = auth;

  const { error } = await dataClient.from("ai_curriculum_settings").upsert(
    {
      id: "default",
      knowledge_target: Math.round(body.knowledgeTarget),
      updated_by: userId,
    } as never,
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, knowledgeTarget: Math.round(body.knowledgeTarget) });
}
