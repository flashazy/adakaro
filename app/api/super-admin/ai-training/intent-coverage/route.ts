import { NextResponse } from "next/server";
import { computeIntentCoverage } from "@/lib/ai-training/intent-coverage";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const entries = await loadActiveKnowledgeEntries(auth.dataClient);
  const coverage = computeIntentCoverage(entries);

  return NextResponse.json(coverage);
}
