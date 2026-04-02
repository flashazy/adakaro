import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSuperAdminNotificationEmails } from "@/lib/notifications/super-admin-email";
import type { Database } from "@/types/supabase";

const PAGE_SIZE = 1000;

export type AnalyticsPreset =
  | "last30d"
  | "last3m"
  | "last6m"
  | "last12m"
  | "custom";

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

export interface RevenueBySchoolRow {
  schoolId: string;
  name: string;
  revenue: number;
}

export interface StudentDistributionSlice {
  name: string;
  value: number;
}

export interface CumulativeSchoolPoint {
  label: string;
  cumulative: number;
}

export interface GrowthPercent {
  schools: number | null;
  students: number | null;
  revenue: number | null;
}

export interface SuperAdminAnalyticsPayload {
  meta: {
    preset: AnalyticsPreset | string;
    fromIso: string;
    toIso: string;
    bucketGranularity: "day" | "month";
  };
  summary: {
    /** Schools created in selected range */
    totalSchools: number;
    /** Students registered in selected range */
    totalStudents: number;
    /** Completed payment sum in selected range */
    totalRevenue: number;
    /** Platform snapshot (not range-filtered) */
    activeSchools: number;
    suspendedSchools: number;
    totalSchoolsPlatform: number;
    totalStudentsPlatform: number;
    growthPercent: GrowthPercent;
  };
  monthlyTrends: MonthlyTrendRow[];
  topSchoolsByStudents: TopSchoolRow[];
  topSchoolsByRevenue: TopSchoolRow[];
  revenueBySchoolTop10: RevenueBySchoolRow[];
  studentDistributionPie: StudentDistributionSlice[];
  cumulativeSchoolGrowth: CumulativeSchoolPoint[];
}

export type LoadSuperAdminAnalyticsResult =
  | { ok: true; data: SuperAdminAnalyticsPayload }
  | { ok: false; message: string };

export interface ActivityHighlightRow {
  created_at: string;
  action: string;
  user_email: string;
  school_id: string | null;
  action_details: unknown;
}

function utcStartOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}

function utcEndOfDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addUtcMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

/** Parse YYYY-MM-DD or ISO to Date (UTC components for date parts). */
export function parsePresetToRange(
  preset: AnalyticsPreset | string,
  customFrom?: string | null,
  customTo?: string | null
): { fromIso: string; toIso: string; preset: AnalyticsPreset | string } {
  const now = new Date();
  const end = utcEndOfDay(now);
  let start: Date;

  switch (preset) {
    case "last30d":
      start = utcStartOfDay(addUtcDays(end, -29));
      break;
    case "last3m":
      start = utcStartOfDay(addUtcMonths(end, -3));
      break;
    case "last6m":
      start = utcStartOfDay(addUtcMonths(end, -6));
      break;
    case "last12m":
      start = utcStartOfDay(addUtcMonths(end, -12));
      break;
    case "custom": {
      if (!customFrom?.trim() || !customTo?.trim()) {
        return parsePresetToRange("last12m");
      }
      const a = new Date(`${customFrom.trim()}T00:00:00.000Z`);
      const b = new Date(`${customTo.trim()}T23:59:59.999Z`);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
        return parsePresetToRange("last12m");
      }
      return {
        fromIso: a.toISOString(),
        toIso: b.toISOString(),
        preset: "custom",
      };
    }
    default:
      return parsePresetToRange("last12m");
  }

  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    preset,
  };
}

export function parseAnalyticsSearchParams(
  searchParams: URLSearchParams
): { fromIso: string; toIso: string; preset: AnalyticsPreset | string } {
  const preset = (searchParams.get("preset") ?? "last12m") as AnalyticsPreset;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (preset === "custom") {
    return parsePresetToRange("custom", from, to);
  }
  return parsePresetToRange(preset, from, to);
}

/** ISO timestamp → `YYYY-MM` in UTC. */
export function toMonthKeyUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ISO timestamp → `YYYY-MM-DD` in UTC. */
export function toDayKeyUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Date-only or ISO string → `YYYY-MM` (UTC). */
export function paymentDateToMonthKey(value: string): string {
  const t = value.trim();
  const d = new Date(t.includes("T") ? t : `${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function paymentDateToDayKey(value: string): string {
  const t = value.trim();
  const d = new Date(t.includes("T") ? t : `${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function decideGranularity(from: Date, to: Date): "day" | "month" {
  const ms = to.getTime() - from.getTime();
  const days = ms / (24 * 60 * 60 * 1000);
  return days <= 45 ? "day" : "month";
}

interface BucketDef {
  key: string;
  label: string;
}

function buildBuckets(
  fromIso: string,
  toIso: string,
  granularity: "day" | "month"
): BucketDef[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const out: BucketDef[] = [];

  if (granularity === "day") {
    let cur = utcStartOfDay(from);
    const end = utcEndOfDay(to);
    while (cur.getTime() <= end.getTime()) {
      const key = toDayKeyUtc(cur.toISOString());
      const label = cur.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      out.push({ key, label });
      cur = addUtcDays(cur, 1);
    }
    return out;
  }

  let curM = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  const endM = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  while (curM.getTime() <= endM.getTime()) {
    const y = curM.getUTCFullYear();
    const m = curM.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const label = curM.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    out.push({ key, label });
    curM = addUtcMonths(curM, 1);
  }
  return out;
}

function emptyTrends(buckets: BucketDef[]): MonthlyTrendRow[] {
  return buckets.map((b) => ({
    monthKey: b.key,
    monthLabel: b.label,
    newSchools: 0,
    newStudents: 0,
    revenue: 0,
  }));
}

function pctPrev(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
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

function previousPeriodRange(
  fromIso: string,
  toIso: string
): { prevFromIso: string; prevToIso: string } {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const len = to - from;
  const prevTo = from - 1;
  const prevFrom = prevTo - len;
  return {
    prevFromIso: new Date(prevFrom).toISOString(),
    prevToIso: new Date(prevTo).toISOString(),
  };
}

async function sumPaymentsInRange(
  admin: SupabaseClient<Database>,
  fromDateStr: string,
  toDateStr: string
): Promise<{ ok: true; sum: number } | { ok: false; message: string }> {
  const res = await paginateSelect<{ amount: number }>(
    admin,
    async (from, to) =>
      admin
        .from("payments")
        .select("amount")
        .eq("status", "completed")
        .gte("payment_date", fromDateStr)
        .lte("payment_date", toDateStr)
        .range(from, to)
  );
  if (!res.ok) return res;
  const sum = res.rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return { ok: true, sum };
}

/**
 * Aggregated analytics for the super-admin dashboard (service-role client).
 */
export async function loadSuperAdminAnalytics(
  admin: SupabaseClient<Database>,
  options: {
    fromIso: string;
    toIso: string;
    preset: string;
  }
): Promise<LoadSuperAdminAnalyticsResult> {
  const { fromIso, toIso, preset } = options;
  const fromD = new Date(fromIso);
  const toD = new Date(toIso);
  const fromDateStr = fromIso.slice(0, 10);
  const toDateStr = toIso.slice(0, 10);

  const granularity = decideGranularity(fromD, toD);
  const buckets = buildBuckets(fromIso, toIso, granularity);
  const bucketKeys = new Set(buckets.map((b) => b.key));
  const trendIndex = new Map(buckets.map((b, i) => [b.key, i]));

  const { prevFromIso, prevToIso } = previousPeriodRange(fromIso, toIso);
  const prevFromStr = prevFromIso.slice(0, 10);
  const prevToStr = prevToIso.slice(0, 10);

  const [
    totalSchoolsRes,
    activeSchoolsRes,
    suspendedSchoolsRes,
    studentsPlatformRes,
    schoolsInPeriodRes,
    studentsInPeriodRes,
    prevSchoolsRes,
    prevStudentsRes,
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
    admin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    admin
      .from("students")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    admin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevFromIso)
      .lte("created_at", prevToIso),
    admin
      .from("students")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevFromIso)
      .lte("created_at", prevToIso),
  ]);

  const countErr =
    totalSchoolsRes.error?.message ||
    activeSchoolsRes.error?.message ||
    suspendedSchoolsRes.error?.message ||
    studentsPlatformRes.error?.message ||
    schoolsInPeriodRes.error?.message ||
    studentsInPeriodRes.error?.message ||
    prevSchoolsRes.error?.message ||
    prevStudentsRes.error?.message;
  if (countErr) {
    return { ok: false, message: countErr };
  }

  const revenueThis = await sumPaymentsInRange(admin, fromDateStr, toDateStr);
  if (!revenueThis.ok) return revenueThis;
  const revenuePrev = await sumPaymentsInRange(admin, prevFromStr, prevToStr);
  if (!revenuePrev.ok) return revenuePrev;

  const schoolsForTrend = await paginateSelect<{ created_at: string }>(
    admin,
    async (from, to) =>
      admin
        .from("schools")
        .select("created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
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
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
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
      .gte("payment_date", fromDateStr)
      .lte("payment_date", toDateStr)
      .range(from, to)
  );
  if (!paymentsForTrend.ok) {
    return paymentsForTrend;
  }

  const paymentsForTop10 = await paginateSelect<{
    amount: number;
    student_id: string;
  }>(admin, async (from, to) =>
    admin
      .from("payments")
      .select("amount, student_id")
      .eq("status", "completed")
      .gte("payment_date", fromDateStr)
      .lte("payment_date", toDateStr)
      .range(from, to)
  );
  if (!paymentsForTop10.ok) {
    return paymentsForTop10;
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

  const trends = emptyTrends(buckets);

  for (const row of schoolsForTrend.rows) {
    const key =
      granularity === "day"
        ? toDayKeyUtc(row.created_at)
        : toMonthKeyUtc(row.created_at);
    if (!bucketKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) trends[idx]!.newSchools += 1;
  }

  for (const row of studentsForTrend.rows) {
    const key =
      granularity === "day"
        ? toDayKeyUtc(row.created_at)
        : toMonthKeyUtc(row.created_at);
    if (!bucketKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) trends[idx]!.newStudents += 1;
  }

  for (const row of paymentsForTrend.rows) {
    const key =
      granularity === "day"
        ? paymentDateToDayKey(row.payment_date)
        : paymentDateToMonthKey(row.payment_date);
    if (!key || !bucketKeys.has(key)) continue;
    const idx = trendIndex.get(key);
    if (idx !== undefined) {
      trends[idx]!.revenue += Number(row.amount ?? 0);
    }
  }

  const studentIdToSchoolId = new Map<string, string>();
  const studentCountBySchool = new Map<string, number>();
  for (const s of allStudentsRows.rows) {
    studentIdToSchoolId.set(s.id, s.school_id);
    studentCountBySchool.set(
      s.school_id,
      (studentCountBySchool.get(s.school_id) ?? 0) + 1
    );
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

  const revenueBySchoolInRange = new Map<string, number>();
  for (const p of paymentsForTop10.rows) {
    const schoolId = studentIdToSchoolId.get(p.student_id);
    if (!schoolId) continue;
    revenueBySchoolInRange.set(
      schoolId,
      (revenueBySchoolInRange.get(schoolId) ?? 0) + Number(p.amount ?? 0)
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

  const revenueBySchoolTop10 = [...revenueBySchoolInRange.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([schoolId, revenue]) => ({
      schoolId,
      name: schoolNameById.get(schoolId) ?? "Unknown school",
      revenue,
    }));

  const sortedDist = [...studentCountBySchool.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  const top5 = sortedDist.slice(0, 5);
  const restSum = sortedDist.slice(5).reduce((s, [, c]) => s + c, 0);
  const studentDistributionPie: StudentDistributionSlice[] = [
    ...top5.map(([id, value]) => ({
      name: schoolNameById.get(id) ?? id.slice(0, 8),
      value,
    })),
    ...(restSum > 0 ? [{ name: "Other", value: restSum }] : []),
  ];

  let cum = 0;
  const cumulativeSchoolGrowth: CumulativeSchoolPoint[] = trends.map((t) => {
    cum += t.newSchools;
    return { label: t.monthLabel, cumulative: cum };
  });

  const schoolsInPeriod = schoolsInPeriodRes.count ?? 0;
  const studentsInPeriod = studentsInPeriodRes.count ?? 0;
  const prevSchools = prevSchoolsRes.count ?? 0;
  const prevStudents = prevStudentsRes.count ?? 0;

  const data: SuperAdminAnalyticsPayload = {
    meta: {
      preset,
      fromIso,
      toIso,
      bucketGranularity: granularity,
    },
    summary: {
      totalSchools: schoolsInPeriod,
      totalStudents: studentsInPeriod,
      totalRevenue: revenueThis.sum,
      activeSchools: activeSchoolsRes.count ?? 0,
      suspendedSchools: suspendedSchoolsRes.count ?? 0,
      totalSchoolsPlatform: totalSchoolsRes.count ?? 0,
      totalStudentsPlatform: studentsPlatformRes.count ?? 0,
      growthPercent: {
        schools: pctPrev(schoolsInPeriod, prevSchools),
        students: pctPrev(studentsInPeriod, prevStudents),
        revenue: pctPrev(revenueThis.sum, revenuePrev.sum),
      },
    },
    monthlyTrends: trends,
    topSchoolsByStudents: topByStudents,
    topSchoolsByRevenue: topByRevenue,
    revenueBySchoolTop10,
    studentDistributionPie,
    cumulativeSchoolGrowth,
  };

  return { ok: true, data };
}

export async function fetchRecentActivityHighlights(
  admin: SupabaseClient<Database>,
  sinceIso: string,
  limit = 12
): Promise<
  { ok: true; rows: ActivityHighlightRow[] } | { ok: false; message: string }
> {
  const { data, error } = await admin
    .from("admin_activity_logs")
    .select("created_at, action, user_email, school_id, action_details")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    rows: (data ?? []) as ActivityHighlightRow[],
  };
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAnalyticsCsv(payload: SuperAdminAnalyticsPayload): string {
  const lines: string[] = [];
  const { meta, summary } = payload;
  lines.push("section,key,value");
  lines.push(
    `meta,preset,${csvEscape(String(meta.preset))}`,
    `meta,from,${csvEscape(meta.fromIso)}`,
    `meta,to,${csvEscape(meta.toIso)}`,
    `meta,granularity,${csvEscape(meta.bucketGranularity)}`
  );
  lines.push(
    `summary,new_schools_in_range,${summary.totalSchools}`,
    `summary,new_students_in_range,${summary.totalStudents}`,
    `summary,revenue_in_range,${summary.totalRevenue}`,
    `summary,active_schools_platform,${summary.activeSchools}`,
    `summary,suspended_schools_platform,${summary.suspendedSchools}`,
    `summary,total_schools_platform,${summary.totalSchoolsPlatform}`,
    `summary,total_students_platform,${summary.totalStudentsPlatform}`,
    `summary,growth_schools_pct,${summary.growthPercent.schools ?? ""}`,
    `summary,growth_students_pct,${summary.growthPercent.students ?? ""}`,
    `summary,growth_revenue_pct,${summary.growthPercent.revenue ?? ""}`
  );
  lines.push("trends,bucket,new_schools,new_students,revenue");
  for (const t of payload.monthlyTrends) {
    lines.push(
      `trend,${csvEscape(t.monthKey)},${t.newSchools},${t.newStudents},${t.revenue}`
    );
  }
  lines.push("top_schools,student_rank,name,school_id,students,revenue");
  payload.topSchoolsByStudents.forEach((r, i) => {
    lines.push(
      `top_students,${i + 1},${csvEscape(r.name)},${r.schoolId},${r.studentCount},${r.totalRevenue}`
    );
  });
  lines.push("top_schools,revenue_rank,name,school_id,students,revenue");
  payload.topSchoolsByRevenue.forEach((r, i) => {
    lines.push(
      `top_revenue,${i + 1},${csvEscape(r.name)},${r.schoolId},${r.studentCount},${r.totalRevenue}`
    );
  });
  lines.push("revenue_by_school_in_range,rank,name,school_id,revenue");
  payload.revenueBySchoolTop10.forEach((r, i) => {
    lines.push(
      `rev_bar,${i + 1},${csvEscape(r.name)},${r.schoolId},${r.revenue}`
    );
  });
  lines.push("student_distribution,name,count");
  for (const s of payload.studentDistributionPie) {
    lines.push(`dist,${csvEscape(s.name)},${s.value}`);
  }
  return lines.join("\n") + "\n";
}

export function buildReportEmailHtml(params: {
  payload: SuperAdminAnalyticsPayload;
  highlights: ActivityHighlightRow[];
  appBaseUrl: string;
}): { subject: string; html: string; text: string } {
  const { payload, highlights, appBaseUrl } = params;
  const s = payload.summary;
  const g = s.growthPercent;
  const fmt = (n: number | null) =>
    n === null ? "—" : `${n}%`;
  const analyticsUrl = `${appBaseUrl}/super-admin/analytics`;

  const hlHtml = highlights
    .slice(0, 8)
    .map(
      (h) =>
        `<li>${h.created_at.slice(0, 10)} — <strong>${escapeHtml(h.action)}</strong> — ${escapeHtml(h.user_email)}</li>`
    )
    .join("");

  const subject = `Adakaro analytics summary (${payload.meta.preset})`;

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5">
    <h2>Platform metrics</h2>
    <p>Range: ${escapeHtml(payload.meta.fromIso.slice(0, 10))} → ${escapeHtml(payload.meta.toIso.slice(0, 10))}</p>
    <ul>
      <li>New schools: ${s.totalSchools} (${fmt(g.schools)} vs prior period)</li>
      <li>New students: ${s.totalStudents} (${fmt(g.students)} vs prior period)</li>
      <li>Revenue (completed): ${s.totalRevenue.toFixed(0)} (${fmt(g.revenue)} vs prior period)</li>
      <li>Active / suspended (platform): ${s.activeSchools} / ${s.suspendedSchools}</li>
    </ul>
    <p><a href="${analyticsUrl}">Open analytics dashboard</a> for charts and trends.</p>
    <h3>Recent activity</h3>
    <ul>${hlHtml || "<li>No recent log entries.</li>"}</ul>
  </div>`;

  const text = [
    `Adakaro analytics (${payload.meta.preset})`,
    `Range: ${payload.meta.fromIso} → ${payload.meta.toIso}`,
    `New schools: ${s.totalSchools} (${fmt(g.schools)})`,
    `New students: ${s.totalStudents} (${fmt(g.students)})`,
    `Revenue: ${s.totalRevenue}`,
    `Active/suspended: ${s.activeSchools}/${s.suspendedSchools}`,
    `Dashboard: ${analyticsUrl}`,
    "",
    "Recent activity:",
    ...highlights.map(
      (h) =>
        `- ${h.created_at} ${h.action} ${h.user_email}`
    ),
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportAppBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const host = v.replace(/^https?:\/\//, "");
    return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
  }
  return "http://localhost:3000";
}

/**
 * Build and email the analytics summary (SMTP). Merges super admin emails with optional extras.
 */
export async function sendAnalyticsReportEmails(params: {
  extraRecipients?: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (process.env.SUPER_ADMIN_EMAIL_NOTIFICATIONS_ENABLED === "false") {
    return { ok: true };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client error.",
    };
  }

  const { fromIso, toIso, preset } = parsePresetToRange("last12m");
  const analytics = await loadSuperAdminAnalytics(admin, {
    fromIso,
    toIso,
    preset: String(preset),
  });
  if (!analytics.ok) {
    return { ok: false, message: analytics.message };
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  const highlights = await fetchRecentActivityHighlights(
    admin,
    since.toISOString(),
    15
  );
  if (!highlights.ok) {
    return { ok: false, message: highlights.message };
  }

  const { subject, html, text } = buildReportEmailHtml({
    payload: analytics.data,
    highlights: highlights.rows,
    appBaseUrl: reportAppBaseUrl(),
  });

  const base = await fetchSuperAdminNotificationEmails(admin);
  const extra = params.extraRecipients ?? [];
  const merged = [
    ...new Set(
      [...base, ...extra]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ),
  ];

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim();

  if (!host || !from) {
    return { ok: false, message: "SMTP not configured (SMTP_HOST / SMTP_FROM)." };
  }

  if (merged.length === 0) {
    return { ok: false, message: "No recipient email addresses." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: port === 465,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
    });

    for (const to of merged) {
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true };
}

