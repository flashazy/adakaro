import { NextRequest, NextResponse } from "next/server";
import { checkQuestionDuplicates, serializeDuplicateCheckForApi } from "@/lib/ai-training/knowledge-duplicates";
import { loadEntriesForDuplicateCheck } from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

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
    });
  }

  const entries = await loadEntriesForDuplicateCheck(auth.dataClient);
  const result = checkQuestionDuplicates(question, entries, { excludeId, category });

  return NextResponse.json(serializeDuplicateCheckForApi(result));
}
