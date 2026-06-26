import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getAdminLearningClient } from "./learning-apply";
import type {
  LearningEventRow,
  LearningMetricsSummary,
  LearningSuggestionRow,
} from "./learning-types";

function rate(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export async function loadLearningMetrics(
  supabase: SupabaseClient<Database>
): Promise<LearningMetricsSummary> {
  const client = await getAdminLearningClient(supabase);

  const { data: events, error: eventsError } = await client
    .from("ai_learning_events")
    .select("*")
    .eq("source", "public_ai")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (eventsError) {
    console.error("[learning] metrics events:", eventsError);
  }

  const rows = (events ?? []) as LearningEventRow[];
  const total = rows.length;

  const answered = rows.filter((r) => r.answer_status === "answered").length;
  const clarified = rows.filter((r) => r.answer_status === "clarified").length;
  const unanswered = rows.filter(
    (r) => r.answer_status === "unanswered" || r.answer_status === "fallback"
  ).length;
  const lowConfidence = rows.filter(
    (r) => r.confidence_level === "low" || (r.final_score ?? 0) < 0.42
  ).length;

  const questionCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.normalized_question;
    questionCounts.set(key, (questionCounts.get(key) ?? 0) + 1);
  }

  const topRepeatedQuestions = [...questionCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  const weakIntentCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.confidence_level === "low" && row.matched_intent_key) {
      weakIntentCounts.set(
        row.matched_intent_key,
        (weakIntentCounts.get(row.matched_intent_key) ?? 0) + 1
      );
    }
  }

  const topWeakIntents = [...weakIntentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([intentKey, count]) => ({ intentKey, count }));

  const { count: pendingCount } = await client
    .from("ai_learning_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: approvedCount } = await client
    .from("ai_learning_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: recentApprovedCount } = await client
    .from("ai_learning_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("applied_at", thirtyDaysAgo.toISOString());

  return {
    totalQuestionsCaptured: total,
    answeredRate: rate(answered, total),
    clarificationRate: rate(clarified, total),
    unansweredRate: rate(unanswered, total),
    lowConfidenceRate: rate(lowConfidence, total),
    topRepeatedQuestions,
    topWeakIntents,
    suggestionsPending: pendingCount ?? 0,
    suggestionsApproved: approvedCount ?? 0,
    recentApprovedCount: recentApprovedCount ?? 0,
  };
}

export async function loadLearningEvents(
  supabase: SupabaseClient<Database>,
  filter?: {
    answerStatus?: string;
    lowConfidenceOnly?: boolean;
    limit?: number;
  }
): Promise<LearningEventRow[]> {
  const client = await getAdminLearningClient(supabase);
  let query = client
    .from("ai_learning_events")
    .select("*")
    .eq("source", "public_ai")
    .order("created_at", { ascending: false });

  if (filter?.answerStatus) {
    query = query.eq("answer_status", filter.answerStatus);
  }

  const limit = filter?.limit ?? 500;
  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[learning] load events:", error);
    return [];
  }

  let rows = (data ?? []) as LearningEventRow[];

  if (filter?.lowConfidenceOnly) {
    rows = rows.filter(
      (r) =>
        r.confidence_level === "low" ||
        (r.final_score ?? 0) < 0.42 ||
        r.answer_status === "unanswered" ||
        r.answer_status === "fallback"
    );
  }

  return rows;
}

export async function loadLearningSuggestions(
  supabase: SupabaseClient<Database>,
  status: "pending" | "approved" | "rejected" | "all" = "pending"
): Promise<LearningSuggestionRow[]> {
  const client = await getAdminLearningClient(supabase);
  let query = client
    .from("ai_learning_suggestions")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    console.error("[learning] load suggestions:", error);
    return [];
  }

  return (data ?? []) as LearningSuggestionRow[];
}

export async function upsertDraftSuggestions(
  supabase: SupabaseClient<Database>,
  drafts: Array<{
    suggestion_type: string;
    suggested_text: string;
    target_entry_id: string | null;
    target_intent_key: string | null;
    source_questions: string[];
    source_event_ids: string[];
    occurrence_count: number;
    confidence: number;
    reason: string;
    cluster_key: string;
  }>
): Promise<number> {
  const client = await getAdminLearningClient(supabase);
  let inserted = 0;

  for (const draft of drafts) {
    const { error } = await client.from("ai_learning_suggestions").insert({
      ...draft,
      status: "pending",
    } as never);

    if (error) {
      if (error.code === "23505") continue;
      console.error("[learning] upsert suggestion:", error);
      continue;
    }
    inserted++;
  }

  return inserted;
}
