import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { normalizeQuestionForDedup } from "./keyword-generator";
import { MATCH_SCORE_THRESHOLD } from "./types";
import type {
  IntentLearningOverrides,
  LearningCaptureInput,
  LearningConfidenceLevel,
} from "./learning-types";
import { getAdminLearningClient } from "./learning-apply";

export function confidenceLevelFromScore(
  score: number | null
): LearningConfidenceLevel {
  if (score === null) return "low";
  if (score >= MATCH_SCORE_THRESHOLD) return "high";
  if (score >= 0.42) return "medium";
  return "low";
}

export async function captureLearningEvent(
  supabase: SupabaseClient<Database>,
  input: LearningCaptureInput
): Promise<void> {
  const client = await getAdminLearningClient(supabase);
  const normalized = normalizeQuestionForDedup(input.question);
  if (!normalized) return;

  const { error } = await client.from("ai_learning_events").insert({
    original_question: input.question.trim(),
    normalized_question: normalized,
    source: input.source ?? "public_ai",
    matched_entry_id: input.matchedEntryId,
    matched_intent_key: input.matchedIntentKey,
    final_score: input.finalScore,
    confidence_level: confidenceLevelFromScore(input.finalScore),
    answer_status: input.answerStatus,
    top_candidate_entries: input.topCandidateEntries,
    top_candidate_intents: input.topCandidateIntents,
    reason_signals: input.reasonSignals,
    page_path: input.pagePath ?? null,
  } as never);

  if (error) {
    console.error("[learning] capture event:", error);
  }
}

export async function loadIntentLearningOverrides(
  supabase: SupabaseClient<Database>
): Promise<IntentLearningOverrides> {
  const client = await getAdminLearningClient(supabase);
  const overrides: IntentLearningOverrides = {
    triggerPhrases: new Map(),
    negativePhrases: new Map(),
  };

  const { data, error } = await client
    .from("ai_intent_learning_overrides")
    .select("intent_key, trigger_phrases, negative_phrases");

  if (error) {
    console.error("[learning] load overrides:", error);
    return overrides;
  }

  for (const row of data ?? []) {
    const item = row as {
      intent_key: string;
      trigger_phrases: string[];
      negative_phrases: string[];
    };
    overrides.triggerPhrases.set(item.intent_key, item.trigger_phrases ?? []);
    overrides.negativePhrases.set(item.intent_key, item.negative_phrases ?? []);
  }

  return overrides;
}

export function buildLearningCaptureFromResult(
  question: string,
  params: {
    matchedEntryId: string | null;
    matchedIntentKey: string | null;
    finalScore: number | null;
    answerStatus: LearningCaptureInput["answerStatus"];
    candidates: Array<{
      entry: { id: string; question: string; intent_key?: string | null };
      score: number;
    }>;
    reasonSignals: string[];
    pagePath?: string | null;
  }
): LearningCaptureInput {
  return {
    question,
    matchedEntryId: params.matchedEntryId,
    matchedIntentKey: params.matchedIntentKey,
    finalScore: params.finalScore,
    answerStatus: params.answerStatus,
    topCandidateEntries: params.candidates.slice(0, 5).map((c) => ({
      entryId: c.entry.id,
      question: c.entry.question,
      intentKey: c.entry.intent_key ?? null,
      score: c.score,
    })),
    topCandidateIntents: [
      ...new Set(
        params.candidates
          .map((c) => c.entry.intent_key)
          .filter(Boolean) as string[]
      ),
    ].slice(0, 5),
    reasonSignals: params.reasonSignals.slice(0, 10),
    pagePath: params.pagePath ?? null,
    source: "public_ai",
  };
}
