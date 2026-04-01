import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { normalizePlanId, type PlanId } from "@/lib/plans";

export interface SuspendedSchoolContext {
  schoolId: string;
  name: string;
  plan: PlanId;
  currency: string;
  suspensionReason: string | null;
  defaultAmountTz: number;
}

function envAmount(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default TZS amounts by plan — override via env (server-side). */
export function getDefaultReactivationAmountTz(plan: string): number {
  const p = normalizePlanId(plan);
  switch (p) {
    case "basic":
      return envAmount("SUSPENSION_REACTIVATION_BASIC_TZS", 50_000);
    case "pro":
      return envAmount("SUSPENSION_REACTIVATION_PRO_TZS", 100_000);
    case "enterprise":
      return envAmount("SUSPENSION_REACTIVATION_ENTERPRISE_TZS", 200_000);
    default:
      return envAmount("SUSPENSION_REACTIVATION_FREE_TZS", 50_000);
  }
}

/**
 * Returns the first suspended school where the user is an admin member or creator.
 * Uses service role to bypass RLS.
 */
export async function findSuspendedSchoolForAdmin(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<SuspendedSchoolContext | null> {
  const schoolIds = new Set<string>();

  const { data: members } = await admin
    .from("school_members")
    .select("school_id, role")
    .eq("user_id", userId);
  for (const m of (members ?? []) as { school_id: string; role: string }[]) {
    if (m.role === "admin") schoolIds.add(m.school_id);
  }

  const { data: createdSchools } = await admin
    .from("schools")
    .select("id")
    .eq("created_by", userId);
  for (const s of (createdSchools ?? []) as { id: string }[]) {
    schoolIds.add(s.id);
  }

  for (const schoolId of schoolIds) {
    const { data: school, error } = await admin
      .from("schools")
      .select("id, name, plan, currency, status, suspension_reason")
      .eq("id", schoolId)
      .maybeSingle();
    if (error) continue;
    const row = school as {
      id: string;
      name: string;
      plan: string;
      currency: string;
      status: string;
      suspension_reason: string | null;
    } | null;
    if (row?.status === "suspended") {
      const plan = normalizePlanId(row.plan);
      return {
        schoolId: row.id,
        name: row.name,
        plan,
        currency: row.currency ?? "TZS",
        suspensionReason: row.suspension_reason?.trim() ?? null,
        defaultAmountTz: getDefaultReactivationAmountTz(plan),
      };
    }
  }

  return null;
}

export function buildReactivationOrderReference(schoolId: string): string {
  const compact = schoolId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const t = Date.now().toString();
  const raw = `REACT${compact}T${t}`.replace(/[^a-zA-Z0-9]/g, "");
  return raw.slice(0, 64) || `REACT${t}`;
}
