import { NextResponse } from "next/server";
import { inferMemoryFromEntries, loadKnowledgeMemory } from "@/lib/ai-training/knowledge-memory";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  try {
    const [memory, entriesRes] = await Promise.all([
      loadKnowledgeMemory(auth.dataClient),
      auth.dataClient.from("ai_knowledge_entries").select("*").eq("status", "active").limit(500),
    ]);
    const inferred = inferMemoryFromEntries((entriesRes.data ?? []) as AIKnowledgeEntry[]);
    return NextResponse.json({ memory, inferred });
  } catch (err) {
    console.error("[intelligence/memory] load:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load memory" },
      { status: 500 }
    );
  }
}
