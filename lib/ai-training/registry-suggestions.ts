/**
 * Registry-backed draft knowledge suggestions for unanswered Copilot questions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findRegistryModule,
  findRegistryCard,
  type AdakaroRegistryEntry,
} from "@/lib/ai/adakaro-registry";
import { normalizeQuestionForDedup } from "@/lib/ai-training/keyword-generator";

const DRAFT_CATEGORY = "needs_review";

function buildSuggestedAnswer(
  question: string,
  module: AdakaroRegistryEntry,
  cardLabel?: string
): string {
  if (cardLabel) {
    const card = module.cards.find((c) => c.label === cardLabel);
    if (card) {
      return `**${card.label}**\n\n${card.description}\n\nThis is part of the ${module.dashboardPage} area in Adakaro.`;
    }
  }
  return `**${module.name}**\n\n${module.description}`;
}

/**
 * When Copilot cannot answer, auto-create a draft knowledge entry from the
 * platform registry so super admins can approve, edit, or reject it.
 */
export async function createDraftKnowledgeFromRegistry(
  supabase: SupabaseClient<Database>,
  question: string,
  userId?: string | null
): Promise<string | null> {
  const cardMatch = findRegistryCard(question);
  const moduleMatch = findRegistryModule(question);
  const mod = cardMatch?.module ?? moduleMatch;
  if (!mod) return null;

  const answer = buildSuggestedAnswer(
    question,
    mod,
    cardMatch?.card.label
  );

  const normalizedQ = normalizeQuestionForDedup(question);
  if (!normalizedQ) return null;

  let client = supabase;
  try {
    client = createAdminClient();
  } catch {
    /* use passed client */
  }

  const { data: existing } = await client
    .from("ai_knowledge_entries")
    .select("id")
    .eq("question", question.trim())
    .eq("category", DRAFT_CATEGORY)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const keywords = [
    ...mod.keywords.slice(0, 5),
    ...(cardMatch?.card.keywords.slice(0, 3) ?? []),
  ];

  const { data, error } = await client
    .from("ai_knowledge_entries")
    .insert({
      category: DRAFT_CATEGORY,
      question: question.trim(),
      answer,
      keywords,
      search_phrases: [question.trim().toLowerCase()],
      alternative_wording: [],
      related_terms: mod.relatedModules,
      priority: "normal",
      status: "archived",
      created_by: userId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[registry-suggestions] insert draft:", error.message);
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}
