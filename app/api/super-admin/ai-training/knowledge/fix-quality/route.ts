import { NextRequest, NextResponse } from "next/server";
import { fixAllQualityIssues } from "@/lib/ai-training/knowledge-authoring";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

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
  };

  const question = body.question?.trim();
  const answer = body.answer?.trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
  }

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
  });

  return NextResponse.json(result);
}
