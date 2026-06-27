import { NextRequest, NextResponse } from "next/server";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import { loadEntryVersions } from "@/lib/ai-training/knowledge-versioning";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { buildVersionTimeline } from "@/lib/ai-training/test-observability-console";
import { testKnowledgeQueryAsync } from "@/lib/ai-training/test-match";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const loadStart = performance.now();
  const entries = await loadActiveKnowledgeEntries(auth.dataClient);
  const loadEntriesMs = performance.now() - loadStart;

  const result = await testKnowledgeQueryAsync(question, entries, auth.dataClient, {
    loadEntriesMs,
  });

  if (result.matchedEntryId && result.entry) {
    const versions = await loadEntryVersions(
      auth.dataClient,
      result.matchedEntryId
    );
    result.console.versionTimeline = buildVersionTimeline(result.entry, versions);
  }

  return NextResponse.json(result);
}
