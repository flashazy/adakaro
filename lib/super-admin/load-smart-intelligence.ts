import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSmartIntelligence } from "@/lib/super-admin/smart-intelligence";
import type {
  LoadSmartIntelligenceResult,
} from "@/lib/super-admin/smart-intelligence-types";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import type { Database } from "@/types/supabase";

function dateStrDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadClassCounts(
  admin: SupabaseClient<Database>
): Promise<Map<string, number>> {
  const rows = await fetchAllRows<{ school_id: string }>({
    label: "classes for smart intelligence",
    fetchPage: async (from, to) =>
      admin.from("classes").select("school_id").range(from, to),
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.school_id, (map.get(row.school_id) ?? 0) + 1);
  }
  return map;
}

async function loadPaymentRevenue(
  admin: SupabaseClient<Database>,
  fromDateStr: string,
  toDateStr: string
): Promise<number> {
  const rows = await fetchAllRows<{ amount: number }>({
    label: `payments revenue ${fromDateStr}–${toDateStr}`,
    fetchPage: async (from, to) =>
      admin
        .from("payments")
        .select("amount")
        .eq("status", "completed")
        .gte("payment_date", fromDateStr)
        .lte("payment_date", toDateStr)
        .range(from, to),
  });

  return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

async function loadRevenueBySchoolLast30Days(
  admin: SupabaseClient<Database>,
  fromDateStr: string,
  toDateStr: string
): Promise<Map<string, number>> {
  const [students, payments] = await Promise.all([
    fetchAllRows<{ id: string; school_id: string }>({
      label: "students for revenue mapping",
      fetchPage: async (from, to) =>
        admin.from("students").select("id, school_id").range(from, to),
    }),
    fetchAllRows<{ amount: number; student_id: string }>({
      label: `payments by student ${fromDateStr}–${toDateStr}`,
      fetchPage: async (from, to) =>
        admin
          .from("payments")
          .select("amount, student_id")
          .eq("status", "completed")
          .gte("payment_date", fromDateStr)
          .lte("payment_date", toDateStr)
          .range(from, to),
    }),
  ]);

  const studentToSchool = new Map(students.map((s) => [s.id, s.school_id]));
  const revenueBySchool = new Map<string, number>();

  for (const payment of payments) {
    const schoolId = studentToSchool.get(payment.student_id);
    if (!schoolId) continue;
    revenueBySchool.set(
      schoolId,
      (revenueBySchool.get(schoolId) ?? 0) + Number(payment.amount ?? 0)
    );
  }

  return revenueBySchool;
}

/**
 * Loads supplemental metrics and computes Smart Intelligence for the dashboard.
 */
export async function loadSmartIntelligence(
  schools: SuperAdminSchoolRow[]
): Promise<LoadSmartIntelligenceResult> {
  try {
    const admin = createAdminClient();
    const today = todayDateStr();
    const from30 = dateStrDaysAgo(30);
    const from60 = dateStrDaysAgo(60);
    const from90 = dateStrDaysAgo(90);

    const [
      classCountBySchool,
      revenueCurrent30Days,
      revenuePrevious30Days,
      revenueLast90Days,
      revenueBySchoolLast30Days,
    ] = await Promise.all([
      loadClassCounts(admin),
      loadPaymentRevenue(admin, from30, today),
      loadPaymentRevenue(admin, from60, from30),
      loadPaymentRevenue(admin, from90, today),
      loadRevenueBySchoolLast30Days(admin, from30, today),
    ]);

    const data = computeSmartIntelligence({
      schools,
      classCountBySchool,
      revenueCurrent30Days,
      revenuePrevious30Days,
      revenueLast90Days,
      revenueBySchoolLast30Days,
    });

    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load smart intelligence.";
    console.error("[loadSmartIntelligence]", message, err);
    return { ok: false, message };
  }
}
