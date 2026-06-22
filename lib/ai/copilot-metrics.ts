import { createAdminClient } from "@/lib/supabase/admin";

export interface CopilotKnowledgeMetrics {
  knowledgeEntries: number;
  coveragePercent: number;
}

export async function loadCopilotKnowledgeMetrics(): Promise<CopilotKnowledgeMetrics> {
  try {
    const client = createAdminClient();
    const [entriesRes, pendingRes] = await Promise.all([
      client
        .from("ai_knowledge_entries")
        .select("usage_count")
        .eq("status", "active"),
      client
        .from("ai_unanswered_questions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const entries = entriesRes.data ?? [];
    const activeCount = entries.length;
    const totalUsage = entries.reduce(
      (sum, row) => sum + Number((row as { usage_count: number }).usage_count),
      0
    );
    const pending = pendingRes.count ?? 0;
    const denominator = totalUsage + pending;

    const coveragePercent =
      denominator === 0
        ? activeCount > 0
          ? 100
          : 0
        : Math.round((totalUsage / denominator) * 100);

    return {
      knowledgeEntries: activeCount,
      coveragePercent,
    };
  } catch {
    return { knowledgeEntries: 0, coveragePercent: 0 };
  }
}
