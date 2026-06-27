import { NextResponse } from "next/server";
import {
  computeIntentHealth,
  loadActiveEntriesForIntentScan,
} from "@/lib/ai-training/intent-recalculate";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const entries = await loadActiveEntriesForIntentScan(auth.dataClient);
  const health = computeIntentHealth(entries);

  return NextResponse.json(health);
}
