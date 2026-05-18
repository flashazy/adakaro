import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_TIER_STUDENT_LIMIT,
  isPaidPlanId,
  normalizePlanId,
  type PlanId,
} from "@/lib/plans";
import { resolveSchoolPlanIdForFeatures } from "@/lib/plan-limits";

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
  plan: PlanId;
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

async function loadAuthoritativePlan(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  admin: SupabaseClient<Database> | null
): Promise<PlanId> {
  const reader = admin ?? supabase;
  const { data, error } = await reader
    .from("schools")
    .select("plan")
    .eq("id", schoolId)
    .maybeSingle();

  const planRaw = error
    ? null
    : (data as { plan: string | null } | null)?.plan;

  return resolveSchoolPlanIdForFeatures(supabase, schoolId, planRaw);
}

/**
 * Server-side gate evaluated on every dashboard load.
 *
 * Returns `blocked: true` ONLY when:
 *   - the school is on the free plan (not basic / pro / enterprise / "paid"), AND
 *   - the school's live student count is strictly greater than 20.
 *
 * Paid schools are never blocked by this gate, even with a stale `student_limit`
 * column still set to 20.
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

  let admin: SupabaseClient<Database> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const plan = await loadAuthoritativePlan(supabase, schoolId, admin);

  let studentCount = 0;
  let pendingRequest: UpgradeRequestSummary | null = null;
  let lastRejected: UpgradeRequestSummary | null = null;

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

  const blocked = !isPaidPlanId(plan) && studentCount > FREE_LIMIT;

  if (process.env.NODE_ENV === "development" && blocked) {
    console.info("[dashboard-block] school blocked", {
      schoolId,
      plan,
      normalized: normalizePlanId(plan),
      studentCount,
      freeLimit: FREE_LIMIT,
    });
  }

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
