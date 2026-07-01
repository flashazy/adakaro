import { NextRequest, NextResponse } from "next/server";
import { fixAllQualityIssues } from "@/lib/ai-training/knowledge-authoring";
import { computeKnowledgeHealth } from "@/lib/ai-training/knowledge-duplicates";
import { loadEntriesForDuplicateCheck } from "@/lib/ai-training/knowledge-entry-mutations";
import { normalizeKnowledgeEntry } from "@/lib/ai-training/normalize-knowledge-entry";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    question?: string;
    answer?: string;
    keywords?: string[];
    synonyms?: string[];
    search_phrases?: string[];
    alternative_wording?: string[];
    related_terms?: string[];
    editingEntryId?: string | null;
  };

  const question = body.question?.trim();
  const answer = body.answer?.trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
  }

  const allEntries = await loadEntriesForDuplicateCheck(auth.dataClient);

  const result = fixAllQualityIssues({
    category: body.category?.trim() || "General",
    question,
    answer,
    metadata: {
      keywords: body.keywords,
      synonyms: body.synonyms,
      search_phrases: body.search_phrases,
      alternative_wording: body.alternative_wording,
      related_terms: body.related_terms,
    },
    allEntries,
    editingEntryId: body.editingEntryId ?? null,
  });

  const draftEntry = normalizeKnowledgeEntry({
    id: body.editingEntryId ?? "draft",
    category: body.category?.trim() || "General",
    question,
    answer: result.answer,
    keywords: result.metadata.keywords,
    synonyms: result.metadata.synonyms,
    search_phrases: result.metadata.search_phrases,
    alternative_wording: result.metadata.alternative_wording,
    related_terms: result.metadata.related_terms,
    priority: "normal",
    status: "active",
  } as Record<string, unknown>) as AIKnowledgeEntry;

  const health = computeKnowledgeHealth(draftEntry, allEntries);

  return NextResponse.json({
    ...result,
    health,
  });
}
