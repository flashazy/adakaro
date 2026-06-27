import { NextRequest, NextResponse } from "next/server";
import {
  applyBulkIntentRecalculation,
  loadActiveEntriesForIntentScan,
  previewBulkIntentRecalculation,
} from "@/lib/ai-training/intent-recalculate";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "preview" | "apply";
    changeIds?: string[];
  };

  const entries = await loadActiveEntriesForIntentScan(auth.dataClient);

  if (body.mode === "apply") {
    const changeIds = body.changeIds?.length
      ? new Set(body.changeIds)
      : undefined;

    const result = await applyBulkIntentRecalculation(
      auth.dataClient,
      entries,
      auth.userId,
      changeIds
    );

    return NextResponse.json(result);
  }

  const preview = previewBulkIntentRecalculation(entries);
  return NextResponse.json(preview);
}
