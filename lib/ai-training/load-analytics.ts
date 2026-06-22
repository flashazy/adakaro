import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeAIHealthScore,
  computeEntryQuality,
  computeEntrySuccessRate,
} from "./scoring";
import type { AITrainingAnalytics, AIKnowledgeEntry } from "./types";

async function getClient(supabase: SupabaseClient<Database>) {
  try {
    return createAdminClient();
  } catch {
    return supabase;
  }
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function loadAITrainingAnalytics(
  supabase: SupabaseClient<Database>
): Promise<AITrainingAnalytics> {
  const client = await getClient(supabase);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [entriesRes, unansweredRes, usageRes, trendingRes] = await Promise.all([
    client.from("ai_knowledge_entries").select("*"),
    client.from("ai_unanswered_questions").select("*"),
    client
      .from("ai_knowledge_usage_logs")
      .select("created_at, knowledge_entry_id, match_score")
      .gte("created_at", thirtyDaysAgo),
    client
      .from("ai_unanswered_questions")
      .select("id, question, occurrences, source, first_seen_at, last_seen_at, status")
      .eq("status", "pending")
      .order("occurrences", { ascending: false })
      .limit(8),
  ]);

  const entries = (entriesRes.data ?? []) as AIKnowledgeEntry[];
  const activeEntries = entries.filter((e) => e.status === "active");
  const unanswered = unansweredRes.data ?? [];
  const usageLogs = usageRes.data ?? [];

  const pendingUnanswered = unanswered.filter(
    (u) => (u as { status: string }).status === "pending"
  ).length;

  const totalAnsweredViaKb = entries.reduce((sum, e) => sum + e.usage_count, 0);
  const totalQuestions = totalAnsweredViaKb + pendingUnanswered;
  const knowledgeCoveragePercent =
    totalQuestions === 0
      ? activeEntries.length > 0
        ? 100
        : 0
      : Math.round((totalAnsweredViaKb / totalQuestions) * 100);

  const avgMatchScores = new Map<string, number[]>();
  for (const log of usageLogs) {
    const row = log as { knowledge_entry_id: string; match_score: number };
    const list = avgMatchScores.get(row.knowledge_entry_id) ?? [];
    list.push(Number(row.match_score));
    avgMatchScores.set(row.knowledge_entry_id, list);
  }

  let matchTotal = 0;
  let matchCount = 0;
  for (const scores of avgMatchScores.values()) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    matchTotal += avg;
    matchCount++;
  }
  const answerSuccessRate =
    matchCount > 0
      ? Math.round((matchTotal / matchCount) * 100)
      : totalAnsweredViaKb > 0
        ? 72
        : 0;

  const recentTrainingActions =
    entries.filter(
      (e) => e.created_at >= sevenDaysAgo || e.updated_at >= sevenDaysAgo
    ).length +
    unanswered.filter(
      (u) => (u as { last_seen_at: string }).last_seen_at >= sevenDaysAgo
    ).length;

  const aiHealth = computeAIHealthScore({
    knowledgeCoveragePercent,
    pendingUnansweredCount: pendingUnanswered,
    totalUnansweredCount: unanswered.length,
    activeKnowledgeEntries: activeEntries.length,
    recentTrainingActions,
  });

  const keywordCounts = new Map<string, number>();
  for (const entry of activeEntries) {
    for (const kw of entry.keywords) {
      const key = kw.toLowerCase();
      keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + entry.usage_count + 1);
    }
  }

  const mostSearchedKeywords = [...keywordCounts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const categoryMap = new Map<string, { count: number; usage: number }>();
  for (const entry of entries) {
    const current = categoryMap.get(entry.category) ?? { count: 0, usage: 0 };
    categoryMap.set(entry.category, {
      count: current.count + 1,
      usage: current.usage + entry.usage_count,
    });
  }

  const totalUsage = entries.reduce((s, e) => s + e.usage_count, 0) || 1;
  const topCategories = [...categoryMap.entries()]
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 8);

  const coverageByCategory = [...categoryMap.entries()]
    .map(([category, stats]) => ({
      category,
      entryCount: stats.count,
      usageCount: stats.usage,
      coveragePercent: Math.round((stats.usage / totalUsage) * 100),
    }))
    .sort((a, b) => b.coveragePercent - a.coveragePercent);

  const dayKeys = lastNDays(14);
  const usageByDay = new Map(dayKeys.map((d) => [d, 0]));
  const questionsByDay = new Map(dayKeys.map((d) => [d, 0]));

  for (const log of usageLogs) {
    const day = (log as { created_at: string }).created_at.slice(0, 10);
    if (usageByDay.has(day)) {
      usageByDay.set(day, (usageByDay.get(day) ?? 0) + 1);
    }
  }

  for (const u of unanswered) {
    const day = (u as { last_seen_at: string }).last_seen_at.slice(0, 10);
    if (questionsByDay.has(day)) {
      questionsByDay.set(day, (questionsByDay.get(day) ?? 0) + 1);
    }
  }

  const usageTrend = dayKeys.map((date) => ({
    date,
    count: usageByDay.get(date) ?? 0,
  }));

  const questionFrequency = dayKeys.map((date) => ({
    date,
    count: questionsByDay.get(date) ?? 0,
  }));

  const mostUsedQuestions = [...activeEntries]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      question: e.question,
      category: e.category,
      usage_count: e.usage_count,
      last_used_at: e.last_used_at,
    }));

  const trendingUnanswered = (trendingRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      question: string;
      occurrences: number;
      source: AITrainingAnalytics["trendingUnanswered"][0]["source"];
      first_seen_at: string;
      last_seen_at: string;
    };
    return {
      id: r.id,
      question: r.question,
      occurrences: r.occurrences,
      source: r.source,
      first_seen_at: r.first_seen_at,
      last_seen_at: r.last_seen_at,
    };
  });

  return {
    totalKnowledgeEntries: entries.length,
    activeKnowledgeEntries: activeEntries.length,
    unansweredCount: unanswered.length,
    pendingUnansweredCount: pendingUnanswered,
    knowledgeCoveragePercent,
    answerSuccessRate,
    aiHealth,
    recentTrainingActions,
    mostUsedQuestions,
    mostSearchedKeywords,
    topCategories,
    coverageByCategory,
    usageTrend,
    questionFrequency,
    trendingUnanswered,
  };
}

export function enrichEntryMetrics(
  entry: AIKnowledgeEntry,
  avgMatchScore: number | null
) {
  const quality = computeEntryQuality(entry);
  return {
    ...entry,
    qualityScore: quality.score,
    qualityLevel: quality.level,
    successRate: computeEntrySuccessRate(entry, avgMatchScore),
  };
}
