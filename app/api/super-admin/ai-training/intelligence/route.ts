import { NextResponse } from "next/server";
import { loadKnowledgeIntelligenceSnapshot } from "@/lib/ai-training/load-knowledge-intelligence";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  try {
    const snapshot = await loadKnowledgeIntelligenceSnapshot(auth.dataClient);
    return NextResponse.json({ snapshot });
  } catch (err) {
    console.error("[intelligence] load:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load intelligence" },
      { status: 500 }
    );
  }
}
