import { NextRequest, NextResponse } from "next/server";
import { generateKeywordsFromQuestion } from "@/lib/ai-training/keyword-generator";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    category?: string;
  };

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const result = generateKeywordsFromQuestion(question, body.category);
  return NextResponse.json(result);
}
