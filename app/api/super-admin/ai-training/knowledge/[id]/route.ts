import { NextRequest, NextResponse } from "next/server";
import { syncKnowledgeEntryEmbeddingSafe } from "@/lib/ai-training/embeddings";
import {
  intentPatchIfQuestionChanged,
  logIntentHistory,
} from "@/lib/ai-training/intent-recalculate";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry, KnowledgePriority, KnowledgeStatus } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient, userId } = auth;
  const { id } = await context.params;

  const { data: existing, error: fetchError } = await dataClient
    .from("ai_knowledge_entries")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const current = existing as AIKnowledgeEntry;

  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    question?: string;
    keywords?: string[];
    search_phrases?: string[];
    alternative_wording?: string[];
    synonyms?: string[];
    related_terms?: string[];
    answer?: string;
    priority?: KnowledgePriority;
    status?: KnowledgeStatus;
  };

  const patch: Record<string, unknown> = {};
  if (body.category !== undefined) patch.category = body.category.trim();
  if (body.question !== undefined) patch.question = body.question.trim();
  if (body.answer !== undefined) patch.answer = body.answer.trim();
  if (body.keywords !== undefined) patch.keywords = body.keywords;
  if (body.search_phrases !== undefined) patch.search_phrases = body.search_phrases;
  if (body.alternative_wording !== undefined) patch.alternative_wording = body.alternative_wording;
  if (body.synonyms !== undefined) patch.synonyms = body.synonyms;
  if (body.related_terms !== undefined) patch.related_terms = body.related_terms;
  if (body.priority !== undefined) patch.priority = body.priority;
  if (body.status !== undefined) patch.status = body.status;

  const nextQuestion =
    body.question !== undefined ? body.question.trim() : current.question;
  const nextCategory =
    body.category !== undefined ? body.category.trim() : current.category;
  const questionChanged =
    body.question !== undefined && body.question.trim() !== current.question;
  const categoryChanged =
    body.category !== undefined && body.category.trim() !== current.category;

  const intentPatch = intentPatchIfQuestionChanged(
    nextQuestion,
    nextCategory,
    current,
    questionChanged,
    categoryChanged
  );

  let historyMeta: {
    previousIntentKey: string | null;
    newIntentKey: string | null;
    previousIntentName: string | null;
    newIntentName: string | null;
    reason: string;
  } | null = null;

  if (intentPatch) {
    const { _history, ...fields } = intentPatch as Record<string, unknown> & {
      _history?: {
        previousIntentKey: string | null;
        newIntentKey: string | null;
        previousIntentName: string | null;
        newIntentName: string | null;
        reason: string;
      };
    };
    historyMeta = _history ?? null;
    Object.assign(patch, fields);
  }

  const { data, error } = await dataClient
    .from("ai_knowledge_entries")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (historyMeta) {
    await logIntentHistory(dataClient, {
      entryId: id,
      previousIntentKey: historyMeta.previousIntentKey,
      newIntentKey: historyMeta.newIntentKey,
      previousIntentName: historyMeta.previousIntentName,
      newIntentName: historyMeta.newIntentName,
      reason: historyMeta.reason,
      userId,
    });
  }

  void syncKnowledgeEntryEmbeddingSafe(dataClient, data as AIKnowledgeEntry);

  return NextResponse.json({ row: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient } = auth;
  const { id } = await context.params;

  const { error } = await dataClient
    .from("ai_knowledge_entries")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
