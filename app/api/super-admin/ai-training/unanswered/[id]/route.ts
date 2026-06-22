import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { UnansweredStatus } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient } = auth;
  const { id } = await context.params;

  const body = (await request.json().catch(() => ({}))) as {
    status?: UnansweredStatus;
    linked_knowledge_entry_id?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.linked_knowledge_entry_id !== undefined) {
    patch.linked_knowledge_entry_id = body.linked_knowledge_entry_id;
  }

  const { data, error } = await dataClient
    .from("ai_unanswered_questions")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}
