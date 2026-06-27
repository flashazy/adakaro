import { NextResponse } from "next/server";
import { restoreEntryVersion } from "@/lib/ai-training/knowledge-versioning";
import { refreshEntryHealth } from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { id, versionId } = await context.params;

  const { data: entryRow, error: entryError } = await auth.dataClient
    .from("ai_knowledge_entries")
    .select("*")
    .eq("id", id)
    .single();

  if (entryError || !entryRow) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const { data: versionRow, error: versionError } = await auth.dataClient
    .from("ai_knowledge_entry_versions")
    .select("*")
    .eq("id", versionId)
    .eq("knowledge_entry_id", id)
    .single();

  if (versionError || !versionRow) {
    return NextResponse.json({ error: "Version not found." }, { status: 404 });
  }

  const restored = await restoreEntryVersion(
    auth.dataClient,
    entryRow as AIKnowledgeEntry,
    versionRow as never,
    auth.userId
  );

  if (!restored) {
    return NextResponse.json({ error: "Restore failed." }, { status: 500 });
  }

  await refreshEntryHealth(auth.dataClient, restored.id);
  return NextResponse.json({ row: restored });
}
