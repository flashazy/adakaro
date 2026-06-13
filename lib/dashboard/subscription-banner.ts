import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { parseSchoolDashboardRpc } from "@/lib/dashboard/parse-school-dashboard-rpc";
import { getSchoolSubscriptionRow } from "@/lib/plan-limits";
import {
  FREE_TIER_STUDENT_LIMIT,
  isPaidPlanId,
  normalizePlanId,
  type PlanId,
} from "@/lib/plans";

/** Show approaching warning when this many slots or fewer remain. */
export const FREE_PLAN_LOW_SLOTS_REMAINING = 5;

export type FreePlanCapacityState = "available" | "approaching" | "limit_reached";

export type PlanStatusAvailability = "available" | "unavailable";

export interface SchoolPlanStatus {
  availability: PlanStatusAvailability;
  planId: PlanId | null;
  planRaw: string | null;
  isPaid: boolean;
  studentLimit: number | null;
  schoolStatus: string | null;
}

export function getRemainingStudentSlots(
  studentCount: number,
  limit: number = FREE_TIER_STUDENT_LIMIT
): number {
  return Math.max(0, limit - studentCount);
}

export function getFreePlanCapacityState(
  studentCount: number,
  limit: number = FREE_TIER_STUDENT_LIMIT
): FreePlanCapacityState {
  if (studentCount >= limit) {
    return "limit_reached";
  }
  if (getRemainingStudentSlots(studentCount, limit) <= FREE_PLAN_LOW_SLOTS_REMAINING) {
    return "approaching";
  }
  return "available";
}

export function getPlanStatusCardTitle(isPaid: boolean): string {
  return isPaid ? "Paid Plan" : "Free Plan";
}

export function formatRemainingSlotsLabel(remaining: number): string {
  const noun = remaining === 1 ? "slot" : "slots";
  return `You have ${remaining} student ${noun} remaining.`;
}

const UNAVAILABLE_PLAN_STATUS: SchoolPlanStatus = {
  availability: "unavailable",
  planId: null,
  planRaw: null,
  isPaid: false,
  studentLimit: null,
  schoolStatus: null,
};

/**
 * Resolves the school's real subscription plan for the dashboard Plan Status card.
 * Prefers `get_my_school_for_dashboard` (SECURITY DEFINER) over direct SELECTs that
 * may fail under RLS. Never defaults to Free when plan data cannot be confirmed.
 */
export async function resolveSchoolPlanStatus(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<SchoolPlanStatus> {
  const row = await getSchoolSubscriptionRow(supabase, schoolId);
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_school_for_dashboard",
    {} as never
  );

  let rpcPlan: string | null = null;
  if (!rpcError && rpcData != null) {
    const parsed = parseSchoolDashboardRpc(rpcData);
    if (parsed?.school_id === schoolId) {
      rpcPlan = parsed.plan;
    }
  }

  const dbPlan = row?.plan?.trim() ? row.plan.trim() : null;
  const planRaw = rpcPlan ?? dbPlan;

  if (!planRaw) {
    return {
      ...UNAVAILABLE_PLAN_STATUS,
      schoolStatus: row?.status ?? null,
    };
  }

  const planId = normalizePlanId(planRaw);
  const isPaid = isPaidPlanId(planId);
  const studentLimit = isPaid
    ? null
    : row?.student_limit ?? FREE_TIER_STUDENT_LIMIT;

  return {
    availability: "available",
    planId,
    planRaw,
    isPaid,
    studentLimit,
    schoolStatus: row?.status ?? null,
  };
}
