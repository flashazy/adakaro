import { NextRequest, NextResponse } from "next/server";
import { syncKnowledgeEntryEmbeddingSafe } from "@/lib/ai-training/embeddings";
import { generateKnowledgeMetadataSync } from "@/lib/ai-training/knowledge-metadata-generator";
import { serializeDuplicateCheckForApi } from "@/lib/ai-training/knowledge-duplicates";
import {
  createKnowledgeEntry,
  type KnowledgeEntryPayload,
} from "@/lib/ai-training/knowledge-entry-mutations";
import { logIntentHistory } from "@/lib/ai-training/intent-recalculate";
import { normalizeKnowledgeEntry } from "@/lib/ai-training/normalize-knowledge-entry";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type {
  AIKnowledgeEntry,
  DuplicateSaveAction,
  KnowledgePriority,
} from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient } = auth;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") ?? "25")));
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status") ?? "active";
  const category = params.get("category")?.trim() ?? "";

  let query = dataClient
    .from("ai_knowledge_entries")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (search) {
    query = query.or(
      `question.ilike.%${search}%,answer.ilike.%${search}%,category.ilike.%${search}%`
    );
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    console.error("[ai-training/knowledge] list:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (data ?? []).map((row) =>
      normalizeKnowledgeEntry(row as Record<string, unknown>)
    ),
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient, userId } = auth;

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
    autoGenerateKeywords?: boolean;
    unansweredId?: string;
    duplicateAction?: DuplicateSaveAction;
    targetEntryId?: string;
    curriculum_module?: string | null;
  };

  const question = body.question?.trim();
  const answer = body.answer?.trim();
  const category = body.category?.trim() || "General";

  if (!question || !answer) {
    return NextResponse.json(
      { error: "Question and answer are required." },
      { status: 400 }
    );
  }

  const generated =
    body.autoGenerateKeywords !== false
      ? generateKnowledgeMetadataSync({
          question,
          answer,
          category,
        })
      : null;

  const payload: KnowledgeEntryPayload = {
    category,
    curriculum_module: body.curriculum_module ?? null,
    question,
    answer,
    keywords: body.keywords?.length ? body.keywords : generated?.keywords ?? [],
    search_phrases: body.search_phrases?.length
      ? body.search_phrases
      : generated?.search_phrases ?? [],
    alternative_wording: body.alternative_wording?.length
      ? body.alternative_wording
      : generated?.alternative_wording ?? [],
    synonyms: body.synonyms?.length
      ? body.synonyms
      : generated?.synonyms ?? [],
    related_terms: body.related_terms?.length
      ? body.related_terms
      : generated?.related_terms ?? [],
    priority: body.priority ?? "normal",
  };

  const result = await createKnowledgeEntry(dataClient, payload, userId, {
    duplicateAction: body.duplicateAction ?? "create",
    targetEntryId: body.targetEntryId,
  });

  if (!result.ok) {
    if ("duplicate" in result && result.duplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          check: serializeDuplicateCheckForApi(result.check),
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "error" in result ? result.error : "Create failed." }, { status: 400 });
  }

  const created = result.row;
  if (created.intent_key) {
    await logIntentHistory(dataClient, {
      entryId: created.id,
      previousIntentKey: null,
      newIntentKey: created.intent_key,
      previousIntentName: null,
      newIntentName: created.intent_name ?? null,
      reason: "Initial intent classification on create.",
      userId,
    });
  }

  if (body.unansweredId) {
    await dataClient
      .from("ai_unanswered_questions")
      .update({
        status: "answered",
        linked_knowledge_entry_id: created.id,
      } as never)
      .eq("id", body.unansweredId);
  }

  void syncKnowledgeEntryEmbeddingSafe(dataClient, created as AIKnowledgeEntry);

  return NextResponse.json({ row: created });
}
