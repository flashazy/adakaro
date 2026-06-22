import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AIActivityItem } from "./types";

async function getClient(supabase: SupabaseClient<Database>) {
  try {
    return createAdminClient();
  } catch {
    return supabase;
  }
}

export async function loadRecentAIActivity(
  supabase: SupabaseClient<Database>,
  limit = 12
): Promise<AIActivityItem[]> {
  const client = await getClient(supabase);
  const items: AIActivityItem[] = [];

  const [unansweredRes, entriesRes] = await Promise.all([
    client
      .from("ai_unanswered_questions")
      .select("id, question, status, last_seen_at, created_at")
      .eq("status", "pending")
      .order("last_seen_at", { ascending: false })
      .limit(6),
    client
      .from("ai_knowledge_entries")
      .select("id, question, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  for (const row of unansweredRes.data ?? []) {
    const r = row as {
      id: string;
      question: string;
      last_seen_at: string;
    };
    items.push({
      id: `unanswered-${r.id}`,
      type: "unanswered",
      label: r.question,
      timestamp: r.last_seen_at,
    });
  }

  for (const row of entriesRes.data ?? []) {
    const r = row as {
      id: string;
      question: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    const created = new Date(r.created_at).getTime();
    const updated = new Date(r.updated_at).getTime();
    const isNew = updated - created < 60_000;

    if (r.status === "archived") {
      items.push({
        id: `archived-${r.id}`,
        type: "archived",
        label: r.question,
        timestamp: r.updated_at,
      });
    } else if (isNew) {
      items.push({
        id: `created-${r.id}`,
        type: "created",
        label: r.question,
        timestamp: r.created_at,
      });
    } else {
      items.push({
        id: `edited-${r.id}`,
        type: "edited",
        label: r.question,
        timestamp: r.updated_at,
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);
}
