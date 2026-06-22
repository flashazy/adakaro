import { NextResponse } from "next/server";
import { loadRecentAIActivity } from "@/lib/ai-training/activity";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const activity = await loadRecentAIActivity(auth.dataClient);
  return NextResponse.json({ activity });
}
