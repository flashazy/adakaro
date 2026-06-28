import { NextRequest, NextResponse } from "next/server";
import {
  generateModuleLessons,
} from "@/lib/ai-training/lesson-generator";
import type { GenerationMode } from "@/lib/ai-training/lesson-generation-prompt";
import {
  CURRICULUM_MODULES,
  getModuleDefinition,
  type CurriculumModuleId,
} from "@/lib/ai-training/knowledge-curriculum";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

const VALID_MODES: GenerationMode[] = ["10", "20", "50", "fill_remaining"];

function isCurriculumModuleId(value: string): value is CurriculumModuleId {
  return CURRICULUM_MODULES.some((m) => m.id === value);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    moduleId?: string;
    mode?: GenerationMode;
    regenerateQuestions?: string[];
  };

  const moduleId = body.moduleId?.trim() ?? "";
  const mode = body.mode ?? "10";

  if (!isCurriculumModuleId(moduleId)) {
    return NextResponse.json({ error: "Invalid curriculum module." }, { status: 400 });
  }

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "Invalid generation mode." }, { status: 400 });
  }

  const { dataClient } = auth;

  const { data: rows, error } = await dataClient
    .from("ai_knowledge_entries")
    .select("*")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = (rows ?? []).map((row) => {
    const entry = row as AIKnowledgeEntry & { curriculum_module?: string | null };
    return {
      ...entry,
      synonyms: entry.synonyms ?? [],
      curriculum_module: entry.curriculum_module ?? null,
    };
  });

  const { data: targetRow } = await dataClient
    .from("ai_curriculum_module_targets")
    .select("target_lessons")
    .eq("module_id", moduleId)
    .maybeSingle();

  const def = getModuleDefinition(moduleId);
  const targetLessons =
    (targetRow as { target_lessons?: number } | null)?.target_lessons ??
    def.defaultTarget;

  const result = await generateModuleLessons({
    moduleId,
    mode,
    targetLessons,
    existingEntries: entries,
    regenerateQuestions: body.regenerateQuestions,
  });

  return NextResponse.json({
    ...result,
    queueHint:
      "Save generated lessons to the Approval Queue — they will not become active knowledge until published.",
  });
}
