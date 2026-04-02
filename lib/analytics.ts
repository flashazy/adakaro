import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const PAGE_SIZE = 1000;

export interface MonthlyTrendRow {
  monthKey: string;
  monthLabel: string;
  newSchools: number;
  newStudents: number;
  revenue: number;
}

export interface TopSchoolRow {
  schoolId: string;
  name: string;
  studentCount: number;
  totalRevenue: number;
}

export interface SuperAdminAnalyticsPayload {
  summary: {
    totalSchools: number;
    activeSchools: number;
    suspendedSchools: number;
    totalStudents: number;
    totalRevenue: number;
  };
  monthlyTrends: MonthlyTrendRow[];
  topSchoolsByStudents: TopSchoolRow[];
  topSchoolsByRevenue: TopSchoolRow[];
}

export type LoadSuperAdminAnalyticsResult =
  | { ok: true; data: SuperAdminAnalyticsPayload }
  | { ok: false; message: string };

/** Last 12 calendar months (oldest → newest), each starting on the 1st. */
export function getLast12MonthBuckets(): { monthKey: string; monthLabel: string }[] {
  const now = new Date();
  const out: { monthKey: string; monthLabel: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    out.push({ monthKey, monthLabel });
  }
  return out;
}

/** ISO timestamp → `YYYY-MM` in UTC (consistent with server data). */
export function toMonthKeyUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Date-only or ISO string → `YYYY-MM` (UTC). */
export function paymentDateToMonthKey(value: string): string {
  const t = value.trim();
  const d = new Date(t.includes("T") ? t : `${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function emptyTrends(
  buckets: { monthKey: string; monthLabel: string }[]
): MonthlyTrendRow[] {
  return buckets.map((b) => ({
    monthKey: b.monthKey,
    monthLabel: b.monthLabel,
    newSchools: 0,
    newStudents: 0,
    revenue: 0,
  }));
}

async function paginateSelect<T>(
  admin: SupabaseClient<Database>,
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ ok: true; rows: T[] } | { ok: false; message: string }> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      return { ok: false, message: error.message };
    }
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { ok: true, rows };
}

/**
 * Aggregated analytics for the super-admin dashboard (service-role client).
 */
export async function loadSuperAdminAnalytics(
  admin: SupabaseClient<Database>
): Promise<LoadSuperAdminAnalyticsResult> {
  const buckets = getLast12MonthBuckets();
  const monthKeys = new Set(buckets.map((b) => b.monthKey));
  const firstMonthKey = buckets[0]?.monthKey;
  if (!firstMonthKey) {
    return {
      ok: false,
      message: "Could not compute month range.",
    };
  }
  const rangeStartIso = `${firstMonthKey}-01T00:00:00.000Z`;

  const [
    totalSchoolsRes,
    activeSchoolsRes,
    suspendedSchoolsRes,
    studentsCountRes,
  ] = await Promise.all([
    admin.from("schools").select("*", { count: "exact", head: true }),
    admin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended"),
    admin.from("students").select("*", { count: "exact", head: true }),
  ]);

  const countErr =
    totalSchoolsRes.error?.message ||
    activeSchoolsRes.error?.message ||
    suspendedSchoolsRes.error?.message ||
    studentsCountRes.error?.message;
  if (countErr) {
    return { ok: false, message: countErr };
  }

  const schoolsForTrend = await paginateSelect<{ created_at: string }>(
    admin,
    async (from, to) =>
      admin
        .from("schools")
        .select("created_at")
        .gte("created_at", rangeStartIso)
        .range(from, to)
  );
  if (!schoolsForTrend.ok) {
    return schoolsForTrend;
  }

  const studentsForTrend = await paginateSelect<{ created_at: string }>(
    admin,
    async (from, to) =>
      admin
        .from("students")
        .select("created_at")
        .gte("created_at", rangeStartIso)
        .range(from, to)
  );
  if (!studentsForTrend.ok) {
    return studentsForTrend;
  }

  const paymentsForTrend = await paginateSelect<{
    amount: number;
    payment_date: string;
    status: string;
  }>(admin, async (from, to) =>
    admin
      .from("payments")
      .select("amount, payment_date, status")
      .eq("status", "completed")
      .gte("payment_date", rangeStartIso.split("T")[0]!)
      .range(from, to)
  );
  if (!paymentsForTrend.ok) {
    return paymentsForTrend;
  }

  const allPaymentsForTotal = await paginateSelect<{ amount: number }>(
    admin,
    async (from, to) =>
      admin
        .from("payments")
        .select("amount")
        .eq("status", "completed")
        .range(from, to)
  );
  if (!allPaymentsForTotal.ok) {
    return allPaymentsForTotal;
  }

  const allStudentsRows = await paginateSelect<{ id: string; school_id: string }>(
    admin,
    async (from, to) =>
      admin.from("students").select("id, school_id").range(from, to)
  );
  if (!allStudentsRows.ok) {
    return allStudentsRows;
  }

  const allPaymentsForRevenue = await paginateSelect<{
    amount: number;
    student_id: string;
  }>(admin, async (from, to) =>
    admin
      .from("payments")
      .select("amount, student_id")
      .eq("status", "completed")
      .range(from, to)
  );
  if (!allPaymentsForRevenue.ok) {
    return allPaymentsForRevenue;
  }

  const allSchoolsMeta = await paginateSelect<{ id: string; name: string }>(
    admin,
    async (from, to) => admin.from("schools").select("id, name").range(from, to)
  );
  if (!allSchoolsMeta.ok) {
    return allSchoolsMeta;
  }

  const totalRevenue = allPaymentsForTotal.rows.reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );

  const trends = emptyTrends(buckets);
  const trendIndex = new Map(trends.map((t, i) => [t.monthKey, i]));

  for (const row of schoolsForTrend.rows) {
    const key = toMonthKeyUtc(row.created_at);
    if (!monthKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) trends[idx]!.newSchools += 1;
  }

  for (const row of studentsForTrend.rows) {
    const key = toMonthKeyUtc(row.created_at);
    if (!monthKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) trends[idx]!.newStudents += 1;
  }

  for (const row of paymentsForTrend.rows) {
    const key = paymentDateToMonthKey(row.payment_date);
    if (!key || !monthKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) {
      trends[idx]!.revenue += Number(row.amount ?? 0);
    }
  }

  const studentCountBySchool = new Map<string, number>();
  const studentIdToSchoolId = new Map<string, string>();
  for (const s of allStudentsRows.rows) {
    studentCountBySchool.set(
      s.school_id,
      (studentCountBySchool.get(s.school_id) ?? 0) + 1
    );
    studentIdToSchoolId.set(s.id, s.school_id);
  }

  const revenueBySchool = new Map<string, number>();
  for (const p of allPaymentsForRevenue.rows) {
    const schoolId = studentIdToSchoolId.get(p.student_id);
    if (!schoolId) continue;
    revenueBySchool.set(
      schoolId,
      (revenueBySchool.get(schoolId) ?? 0) + Number(p.amount ?? 0)
    );
  }

  const schoolNameById = new Map<string, string>();
  for (const s of allSchoolsMeta.rows) {
    schoolNameById.set(s.id, s.name);
  }

  function buildTopRow(schoolId: string): TopSchoolRow {
    return {
      schoolId,
      name: schoolNameById.get(schoolId) ?? "Unknown school",
      studentCount: studentCountBySchool.get(schoolId) ?? 0,
      totalRevenue: revenueBySchool.get(schoolId) ?? 0,
    };
  }

  const topByStudents = [...studentCountBySchool.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([schoolId]) => buildTopRow(schoolId));

  const topByRevenue = [...revenueBySchool.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([schoolId]) => buildTopRow(schoolId));

  const data: SuperAdminAnalyticsPayload = {
    summary: {
      totalSchools: totalSchoolsRes.count ?? 0,
      activeSchools: activeSchoolsRes.count ?? 0,
      suspendedSchools: suspendedSchoolsRes.count ?? 0,
      totalStudents: studentsCountRes.count ?? 0,
      totalRevenue,
    },
    monthlyTrends: trends,
    topSchoolsByStudents: topByStudents,
    topSchoolsByRevenue: topByRevenue,
  };

  return { ok: true, data };
}
