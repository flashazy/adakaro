import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  createAdminClient,
  normalizeServiceRoleKey,
} from "@/lib/supabase/admin";

export interface SuperAdminSchoolRow {
  id: string;
  name: string;
  plan: string;
  currency: string;
  created_at: string;
  created_by: string;
  admin_count: number;
  student_count: number;
}

export interface SuperAdminStats {
  totalSchools: number;
  totalStudents: number;
  totalAdmins: number;
  totalPayments: number;
}

export type LoadSuperAdminDashboardResult =
  | { ok: true; stats: SuperAdminStats; schools: SuperAdminSchoolRow[] }
  | { ok: false; message: string };

function parseStatsRpc(raw: unknown): {
  total_schools?: number;
  total_students?: number;
  total_admins?: number;
  total_payments?: number;
} {
  if (raw == null || raw === undefined) return {};
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return {};
    try {
      const p = JSON.parse(t) as unknown;
      return typeof p === "object" && p !== null && !Array.isArray(p)
        ? (p as Record<string, number>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }
  return {};
}

function logSuperAdminDebug(label: string, payload: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[super-admin/dashboard] ${label}`, payload);
  }
}

/**
 * Load dashboard via service role (bypasses RLS). Checks every query for `.error`.
 */
export async function loadSuperAdminDashboardWithServiceRole(): Promise<LoadSuperAdminDashboardResult> {
  if (!normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return {
      ok: false,
      message:
        "SUPABASE_SERVICE_ROLE_KEY is missing or empty after trim (check .env.local for duplicates).",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    logSuperAdminDebug("createAdminClient", "ok");
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `createAdminClient: ${e.message}`
          : String(e),
    };
  }

  const schoolsListRes = await admin
    .from("schools")
    .select("id, name, plan, currency, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (schoolsListRes.error) {
    logSuperAdminDebug("schools list error", schoolsListRes.error);
    return {
      ok: false,
      message: `schools select: ${schoolsListRes.error.message}`,
    };
  }

  const membersRes = await admin
    .from("school_members")
    .select("school_id, role");

  if (membersRes.error) {
    logSuperAdminDebug("school_members error", membersRes.error);
    return {
      ok: false,
      message: `school_members select: ${membersRes.error.message}`,
    };
  }

  const studentRes = await admin.from("students").select("school_id");

  if (studentRes.error) {
    logSuperAdminDebug("students error", studentRes.error);
    return {
      ok: false,
      message: `students select: ${studentRes.error.message}`,
    };
  }

  const [schoolsCountRes, studentsCountRes, adminsCountRes, paymentsCountRes] =
    await Promise.all([
      admin.from("schools").select("*", { count: "exact", head: true }),
      admin.from("students").select("*", { count: "exact", head: true }),
      admin
        .from("school_members")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin"),
      admin.from("payments").select("*", { count: "exact", head: true }),
    ]);

  const countErrors = [
    schoolsCountRes.error && `schools count: ${schoolsCountRes.error.message}`,
    studentsCountRes.error &&
      `students count: ${studentsCountRes.error.message}`,
    adminsCountRes.error && `admins count: ${adminsCountRes.error.message}`,
    paymentsCountRes.error &&
      `payments count: ${paymentsCountRes.error.message}`,
  ].filter(Boolean);

  if (countErrors.length > 0) {
    logSuperAdminDebug("count errors", countErrors);
    return { ok: false, message: countErrors.join(" | ") };
  }

  const adminBySchool = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    const row = m as { school_id: string; role: string };
    if (row.role === "admin") {
      adminBySchool.set(
        row.school_id,
        (adminBySchool.get(row.school_id) ?? 0) + 1
      );
    }
  }

  const studentsBySchool = new Map<string, number>();
  for (const s of studentRes.data ?? []) {
    const row = s as { school_id: string };
    studentsBySchool.set(
      row.school_id,
      (studentsBySchool.get(row.school_id) ?? 0) + 1
    );
  }

  const list = (schoolsListRes.data ?? []) as {
    id: string;
    name: string;
    plan: string | null;
    currency: string | null;
    created_at: string;
    created_by: string;
  }[];

  const schools: SuperAdminSchoolRow[] = list.map((s) => ({
    id: s.id,
    name: s.name,
    plan: s.plan ?? "free",
    currency: s.currency ?? "KES",
    created_at: s.created_at,
    created_by: s.created_by,
    admin_count: adminBySchool.get(s.id) ?? 0,
    student_count: studentsBySchool.get(s.id) ?? 0,
  }));

  const stats: SuperAdminStats = {
    totalSchools: schoolsCountRes.count ?? 0,
    totalStudents: studentsCountRes.count ?? 0,
    totalAdmins: adminsCountRes.count ?? 0,
    totalPayments: paymentsCountRes.count ?? 0,
  };

  logSuperAdminDebug("service role OK", {
    stats,
    schoolRows: schools.length,
    membersFetched: membersRes.data?.length ?? 0,
    studentsFetched: studentRes.data?.length ?? 0,
  });

  return { ok: true, stats, schools };
}

export interface LoadSuperAdminDashboardOptions {
  /** Skip service-role reads (e.g. after they already failed in the same request). */
  skipServiceRole?: boolean;
}

/**
 * Load super-admin dashboard aggregates.
 *
 * 1. If `SUPABASE_SERVICE_ROLE_KEY` is set → **prefer service-role reads** (unless skipped).
 * 2. Otherwise → `super_admin_*` RPCs (with JSON parsing for jsonb stats).
 */
export async function loadSuperAdminDashboardData(
  supabase: SupabaseClient<Database>,
  options?: LoadSuperAdminDashboardOptions
): Promise<LoadSuperAdminDashboardResult> {
  const skipSr = options?.skipServiceRole === true;
  if (
    !skipSr &&
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    const adminResult = await loadSuperAdminDashboardWithServiceRole();
    if (adminResult.ok) {
      return adminResult;
    }
    logSuperAdminDebug("service role failed, trying RPC", adminResult.message);
  }

  const { data: statsRaw, error: statsErr } = await supabase.rpc(
    "super_admin_dashboard_stats",
    {} as never
  );

  const { data: schoolsRaw, error: schoolsErr } = await supabase.rpc(
    "super_admin_list_schools_with_counts",
    {} as never
  );

  const rpcHint = [statsErr?.message, schoolsErr?.message]
    .filter(Boolean)
    .join(" | ");

  if (statsErr || schoolsErr) {
    if (
      !skipSr &&
      normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      const retry = await loadSuperAdminDashboardWithServiceRole();
      if (retry.ok) return retry;
    }
    return {
      ok: false,
      message:
        rpcHint ||
        "Super admin RPCs failed. Apply migration 00028 or fix SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const statsObj = parseStatsRpc(statsRaw);
  const schools = (schoolsRaw ?? []) as SuperAdminSchoolRow[];

  const stats: SuperAdminStats = {
    totalSchools: Number(statsObj.total_schools ?? 0),
    totalStudents: Number(statsObj.total_students ?? 0),
    totalAdmins: Number(statsObj.total_admins ?? 0),
    totalPayments: Number(statsObj.total_payments ?? 0),
  };

  const rpcLooksEmpty =
    stats.totalSchools === 0 &&
    stats.totalStudents === 0 &&
    stats.totalAdmins === 0 &&
    stats.totalPayments === 0 &&
    schools.length === 0;

  if (
    !skipSr &&
    rpcLooksEmpty &&
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    const adminRetry = await loadSuperAdminDashboardWithServiceRole();
    if (adminRetry.ok) {
      const hasRealData =
        adminRetry.stats.totalSchools > 0 ||
        adminRetry.schools.length > 0 ||
        adminRetry.stats.totalStudents > 0;
      if (hasRealData) {
        logSuperAdminDebug(
          "using service role data (RPC returned all zeros/empty)",
          adminRetry.stats
        );
        return adminRetry;
      }
    }
  }

  return { ok: true, stats, schools };
}
