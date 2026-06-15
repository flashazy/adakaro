import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  createAdminClient,
  normalizeServiceRoleKey,
} from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  normalizeSchoolLifecycleStatus,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";
import {
  computeAutomaticStatus,
  enrichSchoolLifecycle,
  loadSchoolLifecycleMetrics,
  mergeLifecycleCountFallbacks,
} from "@/lib/super-admin/load-school-lifecycle-metrics";
import type {
  LoadSuperAdminDashboardResult,
  SuperAdminLifecycleStats,
  SuperAdminSchoolRow,
  SuperAdminStats,
} from "@/lib/super-admin/types";

export type {
  LoadSuperAdminDashboardResult,
  SuperAdminLifecycleStats,
  SuperAdminSchoolRow,
  SuperAdminStats,
} from "@/lib/super-admin/types";

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

function emptyLifecycleStats(): SuperAdminLifecycleStats {
  return {
    setupSchools: 0,
    activeSchools: 0,
    inactiveSchools: 0,
    archivedSchools: 0,
    healthExcellent: 0,
    healthHealthy: 0,
    healthAtRisk: 0,
    healthInactive: 0,
    newSetupSchoolsLast30Days: 0,
    setupSchoolsOlderThan14Days: 0,
    activeSchoolsThisMonth: 0,
    schoolsAtRisk: 0,
  };
}

function isWithinLastDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const age = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return age <= days;
}

function isWithinCurrentMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

function buildLifecycleStats(schools: SuperAdminSchoolRow[]): SuperAdminLifecycleStats {
  const stats = emptyLifecycleStats();
  for (const s of schools) {
    const status = normalizeSchoolLifecycleStatus(s.school_status);
    if (status === "active") stats.activeSchools += 1;
    if (status === "setup") stats.setupSchools += 1;
    if (status === "inactive") stats.inactiveSchools += 1;
    if (status === "archived") stats.archivedSchools += 1;
    if (s.health_category === "excellent") stats.healthExcellent += 1;
    if (s.health_category === "healthy") stats.healthHealthy += 1;
    if (s.health_category === "at_risk") stats.healthAtRisk += 1;
    if (s.health_category === "inactive") stats.healthInactive += 1;

    if (status === "setup" && isWithinLastDays(s.created_at, 30)) {
      stats.newSetupSchoolsLast30Days += 1;
    }
    if (status === "setup" && !isWithinLastDays(s.created_at, 14)) {
      stats.setupSchoolsOlderThan14Days += 1;
    }
    if (status === "active" && isWithinCurrentMonth(s.last_activity_at)) {
      stats.activeSchoolsThisMonth += 1;
    }
    if (
      status === "active" &&
      (s.health_category === "at_risk" || s.health_score < 40)
    ) {
      stats.schoolsAtRisk += 1;
    }
  }
  return stats;
}

async function enrichSchoolsWithLifecycle(
  admin: ReturnType<typeof createAdminClient>,
  list: {
    id: string;
    name: string;
    plan: string | null;
    currency: string | null;
    created_at: string;
    created_by: string;
    updated_at?: string | null;
    school_status?: string | null;
    last_activity_at?: string | null;
  }[],
  adminBySchool: Map<string, number>,
  studentsBySchool: Map<string, number>
): Promise<SuperAdminSchoolRow[]> {
  const schoolIds = list.map((s) => s.id);
  const metricsMap = await loadSchoolLifecycleMetrics(admin, schoolIds);

  const statusUpdates: { id: string; school_status: SchoolLifecycleStatus }[] =
    [];
  const activityUpdates: { id: string; last_activity_at: string }[] = [];

  const schools: SuperAdminSchoolRow[] = list.map((s) => {
    const baseMetrics = metricsMap.get(s.id) ?? {
      studentCount: 0,
      teacherCount: 0,
      adminCount: 0,
      paymentCount: 0,
      feeStructureCount: 0,
      reportCardCount: 0,
      syllabusActivityCount: 0,
      attendanceCount: 0,
      lastLoginAt: null,
      lastStudentAt: null,
      lastPaymentAt: null,
      lastSyllabusAt: null,
      lastReportAt: null,
      lastFeeAt: null,
      lastMemberAt: null,
      lastTeacherAt: null,
      lastAttendanceAt: null,
      lastActivityAt: null,
    };

    const metrics = mergeLifecycleCountFallbacks(baseMetrics, {
      studentCount: studentsBySchool.get(s.id) ?? 0,
      adminCount: adminBySchool.get(s.id) ?? 0,
    });

    const currentStatus = normalizeSchoolLifecycleStatus(s.school_status);
    const autoStatus = computeAutomaticStatus(
      currentStatus,
      s.last_activity_at ?? null,
      metrics,
      { updatedAt: s.updated_at ?? null, createdAt: s.created_at }
    );

    if (currentStatus !== "archived" && autoStatus !== currentStatus) {
      statusUpdates.push({ id: s.id, school_status: autoStatus });
    }

    const effectiveStatus =
      currentStatus === "archived" ? "archived" : autoStatus;

    const enriched = enrichSchoolLifecycle(
      effectiveStatus,
      s.last_activity_at ?? null,
      metrics,
      { updatedAt: s.updated_at ?? null, createdAt: s.created_at }
    );

    const effectiveLastActivity = enriched.lastActivityAt;
    if (
      effectiveLastActivity &&
      effectiveLastActivity !== (s.last_activity_at ?? null)
    ) {
      activityUpdates.push({
        id: s.id,
        last_activity_at: effectiveLastActivity,
      });
    }

    return {
      id: s.id,
      name: s.name,
      plan: s.plan ?? "free",
      currency: s.currency ?? "KES",
      created_at: s.created_at,
      created_by: s.created_by,
      admin_count: metrics.adminCount,
      student_count: metrics.studentCount,
      teacher_count: metrics.teacherCount,
      payment_count: metrics.paymentCount,
      school_status: effectiveStatus,
      last_activity_at: effectiveLastActivity,
      health_score: enriched.health.score,
      health_category: enriched.health.category,
      health_label: enriched.health.label,
      can_delete_permanently: enriched.deleteEligibility.allowed,
    };
  });

  const dbUpdates = [
    ...statusUpdates.map((row) =>
      admin
        .from("schools")
        .update({
          school_status: row.school_status,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id)
    ),
    ...activityUpdates.map((row) =>
      admin
        .from("schools")
        .update({
          last_activity_at: row.last_activity_at,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id)
    ),
  ];

  if (dbUpdates.length > 0) {
    await Promise.all(dbUpdates);
  }

  return schools;
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
    .select(
      "id, name, plan, currency, created_at, created_by, updated_at, school_status, last_activity_at"
    )
    .order("created_at", { ascending: false })
    .limit(10_000);

  let schoolsList = schoolsListRes.data;
  let schoolsListError = schoolsListRes.error;

  if (
    schoolsListError &&
    /school_status|last_activity_at/i.test(schoolsListError.message)
  ) {
    logSuperAdminDebug(
      "schools lifecycle columns missing, retrying without them",
      schoolsListError.message
    );
    const fallbackRes = await admin
      .from("schools")
      .select(
        "id, name, plan, currency, created_at, created_by, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(10_000);
    schoolsList = (fallbackRes.data ?? []).map((row) => ({
      ...(row as Record<string, unknown>),
      school_status: "setup",
      last_activity_at: null,
    })) as typeof schoolsListRes.data;
    schoolsListError = fallbackRes.error;
  }

  if (schoolsListError) {
    logSuperAdminDebug("schools list error", schoolsListError);
    return {
      ok: false,
      message: `schools select: ${schoolsListError.message}`,
    };
  }

  const membersRes = await fetchAllRows<{ school_id: string; role: string }>({
    label: "super-admin/school_members",
    fetchPage: async (from, to) =>
      await admin.from("school_members").select("school_id, role").range(from, to),
  }).then(
    (data) => ({ data, error: null }),
    (e) => ({
      data: null,
      error: { message: e instanceof Error ? e.message : String(e) },
    })
  );

  if (membersRes.error) {
    logSuperAdminDebug("school_members error", membersRes.error);
    return {
      ok: false,
      message: `school_members select: ${membersRes.error.message}`,
    };
  }

  let studentRows: { school_id: string }[] = [];
  try {
    studentRows = await fetchAllRows<{ school_id: string }>({
      label: "super-admin/students",
      fetchPage: async (from, to) =>
        await admin.from("students").select("school_id").range(from, to),
    });
  } catch (e) {
    logSuperAdminDebug("students error", e);
    return {
      ok: false,
      message: `students select: ${e instanceof Error ? e.message : String(e)}`,
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
  for (const s of studentRows) {
    studentsBySchool.set(
      s.school_id,
      (studentsBySchool.get(s.school_id) ?? 0) + 1
    );
  }

  const list = (schoolsList ?? []) as {
    id: string;
    name: string;
    plan: string | null;
    currency: string | null;
    created_at: string;
    created_by: string;
    updated_at?: string | null;
    school_status?: string | null;
    last_activity_at?: string | null;
  }[];

  const schools = await enrichSchoolsWithLifecycle(
    admin,
    list,
    adminBySchool,
    studentsBySchool
  );

  const stats: SuperAdminStats = {
    totalSchools: schoolsCountRes.count ?? 0,
    totalStudents: studentsCountRes.count ?? 0,
    totalAdmins: adminsCountRes.count ?? 0,
    totalPayments: paymentsCountRes.count ?? 0,
    lifecycle: buildLifecycleStats(schools),
  };

  logSuperAdminDebug("service role OK", {
    stats,
    schoolRows: schools.length,
    membersFetched: membersRes.data?.length ?? 0,
    studentsFetched: studentRows.length,
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
  const rpcSchools = (schoolsRaw ?? []) as SuperAdminSchoolRow[];

  if (
    !skipSr &&
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    const adminRetry = await loadSuperAdminDashboardWithServiceRole();
    if (adminRetry.ok) return adminRetry;
  }

  const schools: SuperAdminSchoolRow[] = rpcSchools.map((s) => ({
    ...s,
    school_status: normalizeSchoolLifecycleStatus(s.school_status),
    last_activity_at: s.last_activity_at ?? null,
    health_score: s.health_score ?? 0,
    health_category: s.health_category ?? "inactive",
    health_label: s.health_label ?? "Inactive",
    can_delete_permanently: s.can_delete_permanently ?? false,
    teacher_count: s.teacher_count ?? 0,
    payment_count: s.payment_count ?? 0,
  }));

  const stats: SuperAdminStats = {
    totalSchools: Number(statsObj.total_schools ?? 0),
    totalStudents: Number(statsObj.total_students ?? 0),
    totalAdmins: Number(statsObj.total_admins ?? 0),
    totalPayments: Number(statsObj.total_payments ?? 0),
    lifecycle: buildLifecycleStats(schools),
  };

  return { ok: true, stats, schools };
}
