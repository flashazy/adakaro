import { NextResponse } from "next/server";
import {
  isEmbeddingConfigured,
  regenerateAllEmbeddings,
} from "@/lib/ai-training/embeddings";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  if (!isEmbeddingConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured for embeddings." },
      { status: 503 }
    );
  }

  const entries = await loadActiveKnowledgeEntries(auth.dataClient);
  const result = await regenerateAllEmbeddings(auth.dataClient, entries);

  return NextResponse.json({
    ok: result.failed === 0,
    total: entries.length,
    success: result.success,
    failed: result.failed,
    errors: result.errors.slice(0, 10),
  });
}
