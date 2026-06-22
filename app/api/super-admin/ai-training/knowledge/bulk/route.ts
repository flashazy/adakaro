import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    action?: "archive" | "delete" | "activate";
  };

  const ids = body.ids ?? [];
  const action = body.action ?? "archive";
  if (ids.length === 0) {
    return NextResponse.json({ error: "No entries selected." }, { status: 400 });
  }

  if (action === "delete") {
    const { error } = await dataClient
      .from("ai_knowledge_entries")
      .delete()
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  const status = action === "activate" ? "active" : "archived";
  const { error } = await dataClient
    .from("ai_knowledge_entries")
    .update({ status } as never)
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: ids.length, status });
}
