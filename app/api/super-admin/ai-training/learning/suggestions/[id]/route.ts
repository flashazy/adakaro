import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { applyApprovedSuggestion } from "@/lib/ai-training/learning-apply";
import type { LearningSuggestionRow } from "@/lib/ai-training/learning-types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "approve" | "reject";
    suggested_text?: string;
  };

  const { data: row, error: fetchError } = await auth.dataClient
    .from("ai_learning_suggestions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  const suggestion = row as LearningSuggestionRow;

  if (body.action === "reject") {
    const { error } = await auth.dataClient
      .from("ai_learning_suggestions")
      .update({
        status: "rejected",
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (body.action === "approve") {
    if (body.suggested_text?.trim()) {
      suggestion.suggested_text = body.suggested_text.trim();
    }

    const result = await applyApprovedSuggestion(
      auth.dataClient,
      suggestion,
      auth.userId
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
