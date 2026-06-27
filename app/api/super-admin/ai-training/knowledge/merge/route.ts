import { NextRequest, NextResponse } from "next/server";
import { mergeKnowledgeEntries } from "@/lib/ai-training/knowledge-merge";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    primaryId?: string;
    duplicateId?: string;
  };

  if (!body.primaryId || !body.duplicateId) {
    return NextResponse.json({ error: "primaryId and duplicateId are required." }, { status: 400 });
  }

  const { data: rows, error } = await auth.dataClient
    .from("ai_knowledge_entries")
    .select("*")
    .in("id", [body.primaryId, body.duplicateId]);

  if (error || !rows || rows.length !== 2) {
    return NextResponse.json({ error: "Could not load entries to merge." }, { status: 404 });
  }

  const primary = rows.find((r) => (r as { id: string }).id === body.primaryId) as
    | AIKnowledgeEntry
    | undefined;
  const duplicate = rows.find((r) => (r as { id: string }).id === body.duplicateId) as
    | AIKnowledgeEntry
    | undefined;

  if (!primary || !duplicate) {
    return NextResponse.json({ error: "Could not load entries to merge." }, { status: 404 });
  }

  const result = await mergeKnowledgeEntries(
    auth.dataClient,
    primary,
    duplicate,
    auth.userId
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ row: result.row });
}
