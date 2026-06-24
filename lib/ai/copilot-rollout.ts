import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export interface CopilotRolloutSchool {
  id: string;
  name: string;
  plan: string;
  status: string;
  studentCount: number;
  copilotEnabled: boolean;
}

export interface CopilotRolloutData {
  totalSchools: number;
  enabledCount: number;
  disabledCount: number;
  schools: CopilotRolloutSchool[];
}

export interface CopilotOpsStats {
  recentUnanswered: Array<{
    id: string;
    question: string;
    occurrences: number;
    lastSeenAt: string;
  }>;
  pendingUnansweredCount: number;
  copilotKnowledgeDrafts: number;
}

/**
 * Load every school with its Copilot rollout flag, plan, status, and student
 * count. Service-role only (super-admin surfaces); returns null when the admin
 * client is unavailable.
 */
export async function loadCopilotRollout(): Promise<CopilotRolloutData | null> {
  let admin: SupabaseClient<Database>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: schoolsRaw, error } = await admin
    .from("schools")
    .select("id, name, plan, status, copilot_enabled")
    .order("name", { ascending: true })
    .limit(10_000);

  if (error) {
    console.error("[copilot-rollout] schools select:", error.message);
    return null;
  }

  let studentRows: { school_id: string }[] = [];
  try {
    studentRows = await fetchAllRows<{ school_id: string }>({
      label: "copilot-rollout/students",
      fetchPage: async (from, to) =>
        await admin.from("students").select("school_id").range(from, to),
    });
  } catch (e) {
    console.error("[copilot-rollout] students select:", e);
  }

  const studentsBySchool = new Map<string, number>();
  for (const s of studentRows) {
    studentsBySchool.set(
      s.school_id,
      (studentsBySchool.get(s.school_id) ?? 0) + 1
    );
  }

  const rows = (schoolsRaw ?? []) as {
    id: string;
    name: string;
    plan: string | null;
    status: string | null;
    copilot_enabled: boolean | null;
  }[];

  const schools: CopilotRolloutSchool[] = rows.map((s) => ({
    id: s.id,
    name: s.name?.trim() || "Untitled school",
    plan: s.plan ?? "free",
    status: s.status ?? "active",
    studentCount: studentsBySchool.get(s.id) ?? 0,
    copilotEnabled: Boolean(s.copilot_enabled),
  }));

  const enabledCount = schools.filter((s) => s.copilotEnabled).length;

  return {
    totalSchools: schools.length,
    enabledCount,
    disabledCount: schools.length - enabledCount,
    schools,
  };
}

/** Recent Copilot failures and draft knowledge for the AI Ops dashboard. */
export async function loadCopilotOpsStats(): Promise<CopilotOpsStats | null> {
  let admin: SupabaseClient<Database>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const [unansweredRes, draftsRes] = await Promise.all([
    admin
      .from("ai_unanswered_questions")
      .select("id, question, occurrences, last_seen_at")
      .eq("source", "copilot")
      .eq("status", "pending")
      .order("last_seen_at", { ascending: false })
      .limit(8),
    admin
      .from("ai_knowledge_entries")
      .select("id", { count: "exact", head: true })
      .eq("category", "needs_review")
      .eq("status", "archived"),
  ]);

  const recent = (unansweredRes.data ?? []) as Array<{
    id: string;
    question: string;
    occurrences: number;
    last_seen_at: string;
  }>;

  const { count: pendingTotal } = await admin
    .from("ai_unanswered_questions")
    .select("id", { count: "exact", head: true })
    .eq("source", "copilot")
    .eq("status", "pending");

  return {
    recentUnanswered: recent.map((r) => ({
      id: r.id,
      question: r.question,
      occurrences: r.occurrences,
      lastSeenAt: r.last_seen_at,
    })),
    pendingUnansweredCount: pendingTotal ?? 0,
    copilotKnowledgeDrafts: draftsRes.count ?? 0,
  };
}
