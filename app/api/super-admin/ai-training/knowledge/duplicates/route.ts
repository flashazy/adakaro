import { NextRequest, NextResponse } from "next/server";
import { checkQuestionDuplicates, serializeDuplicateCheckForApi } from "@/lib/ai-training/knowledge-duplicates";
import {
  buildCurriculumPlannerContext,
  prioritizeRelatedLessons,
  serializePrioritySuggestion,
} from "@/lib/ai-training/knowledge-curriculum-planner";
import { loadEntriesForDuplicateCheck } from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIUnansweredQuestion } from "@/lib/ai-training/types";
import type { LearningEventRow } from "@/lib/ai-training/learning-types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const question = params.get("q")?.trim() ?? "";
  const excludeId = params.get("excludeId")?.trim() ?? undefined;
  const category = params.get("category")?.trim() ?? undefined;

  if (question.length < 3) {
    return NextResponse.json({
      normalizedQuestion: "",
      exactMatch: null,
      similar: [],
      suggestedIntentKey: null,
      suggestedIntentName: null,
      suggestedCategory: null,
      relatedEntries: [],
      prioritizedRelatedLessons: [],
    });
  }

  const [entries, unansweredRes, eventsRes] = await Promise.all([
    loadEntriesForDuplicateCheck(auth.dataClient),
    auth.dataClient.from("ai_unanswered_questions").select("*").limit(500),
    auth.dataClient
      .from("ai_learning_events")
      .select("*")
      .eq("source", "public_ai")
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);

  const unanswered = (unansweredRes.data ?? []) as AIUnansweredQuestion[];
  const learningEvents = (eventsRes.data ?? []) as LearningEventRow[];

  const result = checkQuestionDuplicates(question, entries, { excludeId, category });
  const context = buildCurriculumPlannerContext({ entries, unanswered, learningEvents });
  const prioritizedRelatedLessons = prioritizeRelatedLessons(
    question,
    result.suggestedRelatedLessons,
    context,
    { excludeId, category }
  ).map(serializePrioritySuggestion);

  return NextResponse.json({
    ...serializeDuplicateCheckForApi(result),
    prioritizedRelatedLessons,
  });
}
