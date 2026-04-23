import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getPlanLimits, normalizePlanId, type PlanId } from "@/lib/plans";

export interface SchoolPlanRow {
  plan: string;
  student_limit: number | null;
  admin_limit: number | null;
}

/** Prefer DB columns when set; otherwise derive from plan name. */
export function effectiveStudentLimit(row: SchoolPlanRow): number | null {
  if (row.student_limit != null) return row.student_limit;
  return getPlanLimits(row.plan).studentLimit;
}

export function effectiveAdminLimit(row: SchoolPlanRow): number | null {
  if (row.admin_limit != null) return row.admin_limit;
  return getPlanLimits(row.plan).adminLimit;
}

export async function getSchoolPlanRow(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<SchoolPlanRow | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("plan, student_limit, admin_limit")
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as {
    plan: string | null;
    student_limit: number | null;
    admin_limit: number | null;
  };
  return {
    plan: r.plan ?? "free",
    student_limit: r.student_limit ?? null,
    admin_limit: r.admin_limit ?? null,
  };
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
  const limit = row
    ? effectiveStudentLimit(row)
    : getPlanLimits("free").studentLimit;

  const { count, error } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  const current = error ? 0 : count ?? 0;
  if (limit == null) {
    return { allowed: true, current, limit: null };
  }
  return {
    allowed: current < limit,
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
