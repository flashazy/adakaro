import { NextResponse } from "next/server";
import { loadEntryVersions } from "@/lib/ai-training/knowledge-versioning";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const versions = await loadEntryVersions(auth.dataClient, id);
  return NextResponse.json({ versions });
}
