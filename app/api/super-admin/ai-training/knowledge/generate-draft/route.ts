import { NextRequest, NextResponse } from "next/server";
import { generateDraft } from "@/lib/ai-author/draft-generator";
import type { DraftGenerationRequest } from "@/lib/ai-author/types";
import { loadEntriesForDuplicateCheck } from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { KnowledgePriority } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Partial<DraftGenerationRequest>;

  const question = body.question?.trim();
  if (!question || question.length < 3) {
    return NextResponse.json({ error: "A valid question is required." }, { status: 400 });
  }

  const entries = await loadEntriesForDuplicateCheck(auth.dataClient);

  const result = generateDraft(
    {
      question,
      category: body.category?.trim() || "General",
      priority: (body.priority as KnowledgePriority) || "normal",
      structure: body.structure?.trim() || "",
      curriculumModule: body.curriculumModule ?? null,
      metadata: body.metadata,
      prerequisiteQuestions: body.prerequisiteQuestions ?? [],
      dependencyQuestions: body.dependencyQuestions ?? [],
      relatedQuestions: body.relatedQuestions ?? [],
      excludeEntryId: body.excludeEntryId,
    },
    entries
  );

  return NextResponse.json(result);
}
