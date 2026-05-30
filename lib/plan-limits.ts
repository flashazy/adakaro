import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_TIER_STUDENT_LIMIT,
  getPlanLimits,
  isPaidPlanId,
  normalizePlanId,
  type PlanId,
} from "@/lib/plans";

export interface SchoolPlanRow {
  plan: string;
  student_limit: number | null;
  admin_limit: number | null;
}

/** Prefer paid = unlimited; then DB columns; then derive from plan name. */
export function effectiveStudentLimit(row: SchoolPlanRow): number | null {
  if (isPaidPlanId(row.plan)) return null;
  if (row.student_limit != null) return row.student_limit;
  return getPlanLimits(row.plan).studentLimit;
}

export function effectiveAdminLimit(row: SchoolPlanRow): number | null {
  if (isPaidPlanId(row.plan)) return null;
  if (row.admin_limit != null) return row.admin_limit;
  return getPlanLimits(row.plan).adminLimit;
}

export async function getSchoolPlanRow(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<SchoolPlanRow | null> {
  const mapRow = (data: {
    plan: string | null;
    student_limit: number | null;
    admin_limit: number | null;
  }): SchoolPlanRow => ({
    plan: data.plan ?? "free",
    student_limit: data.student_limit ?? null,
    admin_limit: data.admin_limit ?? null,
  });

  const { data, error } = await supabase
    .from("schools")
    .select("plan, student_limit, admin_limit")
    .eq("id", schoolId)
    .maybeSingle();

  if (!error && data) {
    return mapRow(
      data as {
        plan: string | null;
        student_limit: number | null;
        admin_limit: number | null;
      }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: adminData, error: adminErr } = await admin
      .from("schools")
      .select("plan, student_limit, admin_limit")
      .eq("id", schoolId)
      .maybeSingle();
    if (!adminErr && adminData) {
      return mapRow(
        adminData as {
          plan: string | null;
          student_limit: number | null;
          admin_limit: number | null;
        }
      );
    }
  } catch {
    /* service role unavailable */
  }

  return null;
}

/**
 * Resolves the school's plan tier for feature gating. Direct `schools` SELECTs
 * can fail or return no row under RLS; `get_my_school_for_dashboard` is
 * SECURITY DEFINER and returns the true `plan` when the row matches this school.
 */
export async function resolveSchoolPlanIdForFeatures(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  planFromSchoolRow: string | null | undefined
): Promise<PlanId> {
  let planId = normalizePlanId(planFromSchoolRow ?? "free");

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_school_for_dashboard",
    {} as never
  );
  if (rpcError || rpcData == null) {
    return planId;
  }

  let raw: unknown = rpcData;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return planId;
    try {
      raw = JSON.parse(t) as unknown;
    } catch {
      return planId;
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return planId;
  }
  const o = raw as { school_id?: string; plan?: string };
  if (o.school_id !== schoolId) {
    return planId;
  }
  if (typeof o.plan === "string" && o.plan.trim() !== "") {
    planId = normalizePlanId(o.plan);
  }
  return planId;
}

export async function getCurrentPlan(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<PlanId> {
  const row = await getSchoolPlanRow(supabase, schoolId);
  return resolveSchoolPlanIdForFeatures(supabase, schoolId, row?.plan);
}

export async function checkStudentLimit(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const row = await getSchoolPlanRow(supabase, schoolId);
  const resolvedPlan = await resolveSchoolPlanIdForFeatures(
    supabase,
    schoolId,
    row?.plan
  );

  const limit = isPaidPlanId(resolvedPlan)
    ? null
    : row?.student_limit ?? FREE_TIER_STUDENT_LIMIT;

  console.log("[plan-limits/checkStudentLimit]", {
    schoolId,
    planFromDatabase: row?.plan ?? null,
    studentLimitColumn: row?.student_limit ?? null,
    resolvedPlan,
    isPaid: isPaidPlanId(resolvedPlan),
    enforcedLimit: limit,
  });

  const { count, error } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("approval_status", "approved");

  const current = error ? 0 : count ?? 0;
  if (limit == null) {
    return { allowed: true, current, limit: null };
  }

  const allowed = current < limit;
  if (!allowed) {
    console.warn(
      "[plan-limits/checkStudentLimit] APP_BYPASS_GUARD: free plan at or over student cap — insert must be blocked",
      {
        schoolId,
        planFromDatabase: row?.plan ?? null,
        resolvedPlan,
        current,
        limit,
        note: "Database trigger students_enforce_free_tier_limit also enforces this limit.",
      }
    );
  }

  return {
    allowed,
    current,
    limit,
  };
}

/** Admin seats = current admin members only (school_members.role = admin). */
export async function checkAdminLimit(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const row = await getSchoolPlanRow(supabase, schoolId);
  const limit = row
    ? effectiveAdminLimit(row)
    : getPlanLimits("free").adminLimit;

  const { count: adminCount, error: adminErr } = await supabase
    .from("school_members")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role", "admin");

  const current = adminErr ? 0 : adminCount ?? 0;

  if (limit == null) {
    return { allowed: true, current, limit: null };
  }
  return {
    allowed: current < limit,
    current,
    limit,
  };
}
