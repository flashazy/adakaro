import { NextResponse } from "next/server";
import { loadAITrainingAnalytics } from "@/lib/ai-training/load-analytics";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const analytics = await loadAITrainingAnalytics(auth.dataClient);
  return NextResponse.json(analytics);
}
