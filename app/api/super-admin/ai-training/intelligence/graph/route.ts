import { NextResponse } from "next/server";
import { loadKnowledgeGraphData } from "@/lib/ai-training/load-knowledge-intelligence";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  try {
    const graph = await loadKnowledgeGraphData(auth.dataClient);
    return NextResponse.json({ graph });
  } catch (err) {
    console.error("[intelligence/graph] load:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load graph" },
      { status: 500 }
    );
  }
}
