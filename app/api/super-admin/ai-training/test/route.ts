import { NextRequest, NextResponse } from "next/server";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { testKnowledgeQuery } from "@/lib/ai-training/test-match";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const entries = await loadActiveKnowledgeEntries(auth.dataClient);
  const result = testKnowledgeQuery(question, entries);

  return NextResponse.json(result);
}
