import { NextResponse } from "next/server";
import { EMBEDDING_MODEL } from "@/lib/ai-training/embedding-config";
import {
  getEmbeddingStatus,
  isEmbeddingConfigured,
  listEntriesMissingEmbeddings,
} from "@/lib/ai-training/embeddings";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const entries = await loadActiveKnowledgeEntries(auth.dataClient);
  const status = await getEmbeddingStatus(auth.dataClient, entries.length);
  const missing = await listEntriesMissingEmbeddings(auth.dataClient, entries);

  return NextResponse.json({
    activeEntries: entries.length,
    embeddedEntries: status.embeddedEntries,
    missingEntries: status.missingEntries,
    lastEmbeddingUpdate: status.lastEmbeddingUpdate,
    embeddingModel: EMBEDDING_MODEL,
    embeddingsAvailable: isEmbeddingConfigured(),
    missingEntryQuestions: missing.slice(0, 20).map((e) => ({
      id: e.id,
      question: e.question,
    })),
  });
}
