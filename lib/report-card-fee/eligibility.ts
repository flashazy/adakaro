import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ReportCardEligibilityContext } from "./rule-resolution";
import { checkParentReportEligibilityBatched } from "./batch-eligibility";
import { loadReportCardFeeRulesForClass } from "./rule-resolution-server";
import type {
  ParentReportEligibilityResult,
  ReportCardFeeRuleRow,
} from "./types";

export type { ReportCardEligibilityContext };
export { buildEligibleResult, evaluateRuleForStudent } from "./eligibility-eval";

type FeeDb = SupabaseClient;

/** @deprecated Use loadReportCardFeeRulesForClass — returns first simple rule for backward compat. */
export async function loadReportCardFeeRuleForClass(
  db: FeeDb,
  classId: string
): Promise<ReportCardFeeRuleRow | null> {
  const loaded = await loadReportCardFeeRulesForClass(db, classId);
  if (!loaded) return null;
  return (
    loaded.directRules.find((r) => r.schedule_type === "simple") ??
    loaded.directRules[0] ??
    null
  );
}

/** Sum of active class-level fee structure amounts (not per-student overrides). */
export async function getClassAssignedFeeTotal(
  db: FeeDb,
  schoolId: string,
  classId: string
): Promise<number> {
  const { data } = await db
    .from("fee_structures")
    .select("amount")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("is_active", true)
    .is("student_id", null);

  return (data ?? []).reduce(
    (sum, row) => sum + Number((row as { amount: number }).amount ?? 0),
    0
  );
}

export async function getStudentFeeTotals(
  db: FeeDb,
  studentId: string
): Promise<{ totalRequired: number; totalPaid: number }> {
  const { data: balances } = await db
    .from("student_fee_balances")
    .select("total_fee, total_paid")
    .eq("student_id", studentId);

  let totalRequired = 0;
  let totalPaid = 0;
  for (const row of balances ?? []) {
    const r = row as { total_fee: number; total_paid: number };
    totalRequired += Number(r.total_fee) || 0;
    totalPaid += Number(r.total_paid) || 0;
  }
  return { totalRequired, totalPaid };
}

/**
 * Whether a student may receive parent-facing report card access.
 * Does not affect teacher/coordinator generation or internal views.
 */
export async function checkParentReportEligibility(
  studentId: string,
  classId: string,
  db?: FeeDb,
  context?: ReportCardEligibilityContext
): Promise<ParentReportEligibilityResult> {
  const client = db ?? createAdminClient();
  return checkParentReportEligibilityBatched(
    studentId,
    classId,
    client,
    context
  );
}
