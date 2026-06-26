import { NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { loadLearningMetrics } from "@/lib/ai-training/learning-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const metrics = await loadLearningMetrics(auth.dataClient);
  return NextResponse.json(metrics);
}
