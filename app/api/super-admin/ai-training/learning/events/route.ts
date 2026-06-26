import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { loadLearningEvents } from "@/lib/ai-training/learning-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const section = params.get("section") ?? "all";

  let answerStatus: string | undefined;
  let lowConfidenceOnly = false;

  switch (section) {
    case "unanswered":
      answerStatus = "unanswered";
      break;
    case "clarification":
      answerStatus = "clarified";
      break;
    case "low_confidence":
      lowConfidenceOnly = true;
      break;
    default:
      break;
  }

  const events = await loadLearningEvents(auth.dataClient, {
    answerStatus,
    lowConfidenceOnly,
    limit: 100,
  });

  return NextResponse.json({ events });
}
