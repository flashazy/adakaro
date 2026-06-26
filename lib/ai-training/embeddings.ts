import { isPaidEmbeddingsEnabled } from "./retrieval-config";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_CONFIG, isAIConfigured } from "@/lib/ai/config";
import type { Database } from "@/types/supabase";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedding-config";
import {
  cosineSimilarity,
  formatVectorForPg,
  normalizeSemanticScore,
  parseVectorFromPg,
} from "./embedding-math";
import { buildKnowledgeEmbeddingText } from "./knowledge-embedding-text";
import type { AIKnowledgeEntry } from "./types";

export function isEmbeddingConfigured(): boolean {
  return isPaidEmbeddingsEnabled() && isAIConfigured();
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = AI_CONFIG.openaiApiKey.trim();
  if (!apiKey || !text.trim()) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.trim(),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        "[ai-training/embeddings] OpenAI error:",
        response.status,
        body.slice(0, 300)
      );
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding?.length) return null;
    return embedding;
  } catch (error) {
    console.error("[ai-training/embeddings] generate failed:", error);
    return null;
  }
}

export async function upsertKnowledgeEntryEmbedding(
  client: SupabaseClient<Database>,
  entry: AIKnowledgeEntry
): Promise<{ ok: boolean; error?: string }> {
  if (!isEmbeddingConfigured()) {
    return { ok: false, error: "OpenAI API key not configured." };
  }

  const embeddingText = buildKnowledgeEmbeddingText(entry);
  const embedding = await generateEmbedding(embeddingText);
  if (!embedding) {
    return { ok: false, error: "Failed to generate embedding." };
  }

  const { error } = await client.from("ai_knowledge_entry_embeddings").upsert(
    {
      knowledge_entry_id: entry.id,
      embedding: formatVectorForPg(embedding),
      embedding_text: embeddingText,
      embedding_model: EMBEDDING_MODEL,
    } as never,
    { onConflict: "knowledge_entry_id" }
  );

  if (error) {
    console.error("[ai-training/embeddings] upsert:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function loadEmbeddingsForEntryIds(
  client: SupabaseClient<Database>,
  entryIds: string[]
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (entryIds.length === 0) return map;

  const { data, error } = await client
    .from("ai_knowledge_entry_embeddings")
    .select("knowledge_entry_id, embedding")
    .in("knowledge_entry_id", entryIds);

  if (error) {
    console.error("[ai-training/embeddings] load:", error);
    return map;
  }

  for (const row of data ?? []) {
    const parsed = parseVectorFromPg(
      (row as { embedding: unknown }).embedding
    );
    if (parsed?.length) {
      map.set((row as { knowledge_entry_id: string }).knowledge_entry_id, parsed);
    }
  }

  return map;
}

export function semanticScoresFromEmbeddings(
  queryEmbedding: number[],
  embeddingsByEntryId: Map<string, number[]>
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [entryId, embedding] of embeddingsByEntryId) {
    scores.set(
      entryId,
      normalizeSemanticScore(cosineSimilarity(queryEmbedding, embedding))
    );
  }
  return scores;
}

export async function semanticSearchAllActive(
  client: SupabaseClient<Database>,
  queryEmbedding: number[],
  threshold: number,
  limit: number
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  const { data, error } = await client.rpc("match_knowledge_embeddings", {
    query_embedding: formatVectorForPg(queryEmbedding),
    match_count: limit,
    similarity_threshold: threshold,
  } as never);

  if (error) {
    console.error("[ai-training/embeddings] rpc search:", error);
    return scores;
  }

  for (const row of (data ?? []) as Array<{
    knowledge_entry_id: string;
    similarity: number;
  }>) {
    scores.set(row.knowledge_entry_id, normalizeSemanticScore(row.similarity));
  }

  return scores;
}

export async function regenerateAllEmbeddings(
  client: SupabaseClient<Database>,
  entries: AIKnowledgeEntry[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const result = await upsertKnowledgeEntryEmbedding(client, entry);
    if (result.ok) {
      success++;
    } else {
      failed++;
      errors.push(`${entry.question}: ${result.error ?? "unknown error"}`);
    }
  }

  return { success, failed, errors };
}

export async function getEmbeddingStatus(
  client: SupabaseClient<Database>,
  activeEntryCount: number
): Promise<{
  embeddedEntries: number;
  missingEntries: number;
  lastEmbeddingUpdate: string | null;
}> {
  const { count, error: countError } = await client
    .from("ai_knowledge_entry_embeddings")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("[ai-training/embeddings] status count:", countError);
  }

  const embeddedEntries = count ?? 0;

  const { data: latest, error: latestError } = await client
    .from("ai_knowledge_entry_embeddings")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("[ai-training/embeddings] status latest:", latestError);
  }

  return {
    embeddedEntries,
    missingEntries: Math.max(0, activeEntryCount - embeddedEntries),
    lastEmbeddingUpdate:
      (latest as { updated_at?: string } | null)?.updated_at ?? null,
  };
}

export async function listEntriesMissingEmbeddings(
  client: SupabaseClient<Database>,
  entries: AIKnowledgeEntry[]
): Promise<AIKnowledgeEntry[]> {
  const { data, error } = await client
    .from("ai_knowledge_entry_embeddings")
    .select("knowledge_entry_id");

  if (error) {
    console.error("[ai-training/embeddings] missing list:", error);
    return entries;
  }

  const embedded = new Set(
    (data ?? []).map(
      (row) => (row as { knowledge_entry_id: string }).knowledge_entry_id
    )
  );

  return entries.filter((entry) => !embedded.has(entry.id));
}

/** Fire-and-forget embedding sync after knowledge entry changes. */
export async function syncKnowledgeEntryEmbeddingSafe(
  client: SupabaseClient<Database>,
  entry: AIKnowledgeEntry
): Promise<void> {
  if (!isPaidEmbeddingsEnabled() || !isEmbeddingConfigured()) return;

  try {
    const result = await upsertKnowledgeEntryEmbedding(client, entry);
    if (!result.ok) {
      console.error("[ai-training/embeddings] sync:", result.error);
    }
  } catch (error) {
    console.error("[ai-training/embeddings] sync failed:", error);
  }
}
