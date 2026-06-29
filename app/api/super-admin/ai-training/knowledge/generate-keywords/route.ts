import { NextRequest, NextResponse } from "next/server";
import {
  generateKnowledgeMetadata,
  type MetadataField,
} from "@/lib/ai-training/knowledge-metadata-generator";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

const METADATA_FIELDS: MetadataField[] = [
  "keywords",
  "synonyms",
  "search_phrases",
  "alternative_wording",
  "related_terms",
];

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    answer?: string;
    category?: string;
    field?: MetadataField;
  };

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const field = body.field && METADATA_FIELDS.includes(body.field) ? body.field : undefined;

  const result = await generateKnowledgeMetadata(
    {
      question,
      answer: body.answer?.trim() ?? "",
      category: body.category?.trim() ?? "General",
    },
    { field }
  );

  return NextResponse.json(result);
}
