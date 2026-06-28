/**
 * AI Memory — long-term organizational knowledge (Phase 11).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { KnowledgeMemoryItem, MemoryCategory } from "./knowledge-intelligence-types";
import type { AIKnowledgeEntry } from "./types";

export const DEFAULT_MEMORY_ITEMS: Omit<KnowledgeMemoryItem, "id" | "updatedAt">[] = [
  {
    category: "brand_language",
    key: "product_name",
    value: "Always refer to the product as Adakaro (capital A).",
    confidence: 99,
    source: "brand_guidelines",
    usageCount: 0,
  },
  {
    category: "terminology",
    key: "school_administrator",
    value: "Use 'school administrator' or 'school owner' — not 'admin user'.",
    confidence: 95,
    source: "reviewer_preference",
    usageCount: 0,
  },
  {
    category: "writing_style",
    key: "tone",
    value: "Professional consultant tone — direct, helpful, never robotic.",
    confidence: 92,
    source: "knowledge_writing_standard",
    usageCount: 0,
  },
  {
    category: "feature_naming",
    key: "parent_portal",
    value: "Parent Portal — capitalize both words.",
    confidence: 98,
    source: "product_terminology",
    usageCount: 0,
  },
];

export async function loadKnowledgeMemory(
  client: SupabaseClient<Database>
): Promise<KnowledgeMemoryItem[]> {
  const { data, error } = await client
    .from("ai_knowledge_memory")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return DEFAULT_MEMORY_ITEMS.map((item, i) => ({
        ...item,
        id: `default-${i}`,
        updatedAt: new Date().toISOString(),
      }));
    }
    console.error("[intelligence] load memory:", error);
    return DEFAULT_MEMORY_ITEMS.map((item, i) => ({
      ...item,
      id: `default-${i}`,
      updatedAt: new Date().toISOString(),
    }));
  }

  if (!data?.length) {
    return DEFAULT_MEMORY_ITEMS.map((item, i) => ({
      ...item,
      id: `default-${i}`,
      updatedAt: new Date().toISOString(),
    }));
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    category: row.category as MemoryCategory,
    key: String(row.memory_key),
    value: String(row.memory_value),
    confidence: Number(row.confidence ?? 80),
    source: String(row.source ?? "system"),
    usageCount: Number(row.usage_count ?? 0),
    updatedAt: String(row.updated_at),
  }));
}

export function inferMemoryFromEntries(entries: AIKnowledgeEntry[]): KnowledgeMemoryItem[] {
  const inferred: KnowledgeMemoryItem[] = [];
  const phrases = new Map<string, number>();

  for (const entry of entries) {
    for (const phrase of entry.search_phrases.slice(0, 2)) {
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + entry.usage_count + 1);
    }
  }

  for (const [phrase, count] of [...phrases.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    inferred.push({
      id: `inferred-${hash(phrase)}`,
      category: "faq_pattern",
      key: phrase.slice(0, 40),
      value: `Users frequently search: "${phrase}"`,
      confidence: Math.min(95, 60 + count * 5),
      source: "usage_analysis",
      usageCount: count,
      updatedAt: new Date().toISOString(),
    });
  }

  return inferred;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function memoryToPromptContext(items: KnowledgeMemoryItem[]): string {
  return items
    .slice(0, 12)
    .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
    .join("\n");
}
