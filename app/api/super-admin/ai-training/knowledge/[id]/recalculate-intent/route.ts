import { NextResponse } from "next/server";
import { applyIntentRecalculation } from "@/lib/ai-training/intent-recalculate";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const { data: existing, error: fetchError } = await auth.dataClient
    .from("ai_knowledge_entries")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const result = await applyIntentRecalculation(
    auth.dataClient,
    existing as AIKnowledgeEntry,
    auth.userId,
    "Manual recalculate from AI Classification panel.",
    true
  );

  if (!result.row) {
    return NextResponse.json({ error: "Recalculation failed." }, { status: 500 });
  }

  return NextResponse.json({
    row: result.row,
    changed: result.changed,
  });
}
