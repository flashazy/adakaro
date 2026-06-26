import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import { generateLearningSuggestions } from "@/lib/ai-training/learning-analyzer";
import {
  loadLearningEvents,
  loadLearningSuggestions,
  upsertDraftSuggestions,
} from "@/lib/ai-training/learning-metrics";
import { loadActiveKnowledgeEntries } from "@/lib/ai-training/knowledge-search";
import type { LearningEventRow } from "@/lib/ai-training/learning-types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const status =
    (request.nextUrl.searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | "all") ?? "pending";

  const suggestions = await loadLearningSuggestions(auth.dataClient, status);
  return NextResponse.json({ suggestions });
}

export async function POST() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const events = await loadLearningEvents(auth.dataClient, { limit: 2000 });
  const entries = await loadActiveKnowledgeEntries(auth.dataClient);

  const existingPending = await loadLearningSuggestions(
    auth.dataClient,
    "pending"
  );
  const existingKeys = new Set(existingPending.map((s) => s.cluster_key));

  const drafts = generateLearningSuggestions(
    events as LearningEventRow[],
    entries,
    existingKeys
  );

  const inserted = await upsertDraftSuggestions(auth.dataClient, drafts);

  return NextResponse.json({
    analyzed: events.length,
    generated: drafts.length,
    inserted,
  });
}
