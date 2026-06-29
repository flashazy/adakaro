import { NextRequest, NextResponse } from "next/server";
import { improveAnswer, type AnswerImproveAction } from "@/lib/ai-training/knowledge-language-improver";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

const ACTIONS: AnswerImproveAction[] = [
  "improve_professional_tone",
  "improve_structure",
  "make_more_concise",
  "expand_explanation",
  "remove_marketing_language",
  "make_timeless",
  "fix_grammar",
  "improve_readability",
];

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    answer?: string;
    action?: AnswerImproveAction;
  };

  const question = body.question?.trim();
  const answer = body.answer?.trim();
  const action = body.action;

  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
  }
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Valid action is required." }, { status: 400 });
  }

  const result = improveAnswer(answer, question, action);
  return NextResponse.json(result);
}
