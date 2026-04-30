import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolPlanRow } from "@/lib/plan-limits";
import { FREE_TIER_STUDENT_LIMIT, normalizePlanId } from "@/lib/plans";

export interface UpgradeRequestSummary {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestedPlan: string;
  createdAt: string;
}

export interface DashboardBlockState {
  /** True when this admin must see the BlockedDashboard instead of the page. */
  blocked: boolean;
  schoolId: string | null;
  /** Authoritative current plan (normalized). */
  plan: string;
  /** Live student head-count for the school. */
  studentCount: number;
  /** The free-tier cap surfaced to UI copy. */
  freeLimit: number;
  /** Latest pending request, if any (used to disable the button). */
  pendingRequest: UpgradeRequestSummary | null;
  /** Most recent rejection (if any) so we can surface the status. */
  lastRejected: UpgradeRequestSummary | null;
}

const FREE_LIMIT = FREE_TIER_STUDENT_LIMIT ?? 20;

/**
 * Server-side gate evaluated on every dashboard load.
 *
 * Returns `blocked: true` ONLY when:
 *   - the school is currently on the `free` plan, AND
 *   - the school's live student count is strictly greater than 20.
 *
 * Schools on any paid plan (basic / pro / enterprise) are never blocked,
 * even if they exceed 20 students — paid = unlimited under the new model.
 *
 * Uses the service role for the count + upgrade-request lookup so RLS
 * variations on `students` / `upgrade_requests` cannot accidentally hide
 * the row and let a school slip past the cap.
 */
export async function getDashboardBlockState(
  supabase: SupabaseClient<Database>,
  schoolId: string | null
): Promise<DashboardBlockState> {
  if (!schoolId) {
    return {
      blocked: false,
      schoolId: null,
      plan: "free",
      studentCount: 0,
      freeLimit: FREE_LIMIT,
      pendingRequest: null,
      lastRejected: null,
    };
  }

  const planRow = await getSchoolPlanRow(supabase, schoolId);
  const plan = normalizePlanId(planRow?.plan);

  let studentCount = 0;
  let pendingRequest: UpgradeRequestSummary | null = null;
  let lastRejected: UpgradeRequestSummary | null = null;

  let admin: SupabaseClient<Database> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const counter = admin ?? supabase;
  const { count, error: countErr } = await counter
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);
  if (!countErr) {
    studentCount = count ?? 0;
  }

  const requestClient = admin ?? supabase;
  const [{ data: pendingRow }, { data: lastRejectedRow }] = await Promise.all([
    requestClient
      .from("upgrade_requests")
      .select("id, status, requested_plan, created_at")
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    requestClient
      .from("upgrade_requests")
      .select("id, status, requested_plan, created_at")
      .eq("school_id", schoolId)
      .eq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (pendingRow) {
    const r = pendingRow as {
      id: string;
      status: string;
      requested_plan: string;
      created_at: string;
    };
    pendingRequest = {
      id: r.id,
      status: "pending",
      requestedPlan: r.requested_plan,
      createdAt: r.created_at,
    };
  }
  if (lastRejectedRow) {
    const r = lastRejectedRow as {
      id: string;
      status: string;
      requested_plan: string;
      created_at: string;
    };
    lastRejected = {
      id: r.id,
      status: "rejected",
      requestedPlan: r.requested_plan,
      createdAt: r.created_at,
    };
  }

  const blocked = plan === "free" && studentCount > FREE_LIMIT;

  return {
    blocked,
    schoolId,
    plan,
    studentCount,
    freeLimit: FREE_LIMIT,
    pendingRequest,
    lastRejected,
  };
}
