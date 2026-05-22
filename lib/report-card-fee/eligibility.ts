import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ParentReportEligibilityResult,
  ReportCardFeeRuleRow,
  ReportCardFeeRuleType,
} from "./types";

type FeeDb = SupabaseClient;

const DEFAULT_PARENT_MESSAGE =
  "Your child's report card will become available after completing required school fee payment.";

export async function loadReportCardFeeRuleForClass(
  db: FeeDb,
  classId: string
): Promise<ReportCardFeeRuleRow | null> {
  const { data: classRow } = await db
    .from("classes")
    .select("id, parent_class_id, school_id")
    .eq("id", classId)
    .maybeSingle();

  if (!classRow) return null;

  const typed = classRow as {
    id: string;
    parent_class_id: string | null;
    school_id: string;
  };

  const classIds = [typed.id];
  if (typed.parent_class_id) classIds.push(typed.parent_class_id);

  const { data: rules } = await db
    .from("report_card_fee_rules")
    .select("*")
    .in("class_id", classIds)
    .order("updated_at", { ascending: false });

  const list = (rules ?? []) as ReportCardFeeRuleRow[];
  const direct = list.find((r) => r.class_id === typed.id);
  if (direct) return direct;
  if (typed.parent_class_id) {
    return list.find((r) => r.class_id === typed.parent_class_id) ?? null;
  }
  return null;
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

function buildEligibleResult(
  paidAmount: number,
  totalRequired: number,
  rule: ReportCardFeeRuleRow | null
): ParentReportEligibilityResult {
  const paidPercent =
    totalRequired > 0 ? (paidAmount / totalRequired) * 100 : 100;
  return {
    eligible: true,
    reason: "No fee rule blocking parent access.",
    paidAmount,
    requiredAmount: null,
    paidPercent: Math.round(paidPercent * 100) / 100,
    requiredPercent: null,
    ruleType: rule?.rule_type ?? null,
    remainingAmount: null,
    parentMessage: rule?.message_to_parent?.trim() || null,
  };
}

function formatPercent(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Whether a student may receive parent-facing report card access.
 * Does not affect teacher/coordinator generation or internal views.
 */
export async function checkParentReportEligibility(
  studentId: string,
  classId: string,
  db?: FeeDb
): Promise<ParentReportEligibilityResult> {
  const client = db ?? createAdminClient();

  const { data: student } = await client
    .from("students")
    .select("id, class_id, school_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return {
      eligible: false,
      reason: "Student not found.",
      paidAmount: 0,
      requiredAmount: null,
      paidPercent: 0,
      requiredPercent: null,
      ruleType: null,
      remainingAmount: null,
      parentMessage: null,
    };
  }

  const typedStudent = student as {
    id: string;
    class_id: string | null;
    school_id: string;
  };

  const rule = await loadReportCardFeeRuleForClass(
    client,
    classId || typedStudent.class_id || ""
  );

  const { totalRequired, totalPaid } = await getStudentFeeTotals(
    client,
    studentId
  );

  if (!rule || !rule.is_enabled) {
    return buildEligibleResult(totalPaid, totalRequired, rule);
  }

  const parentMessage =
    rule.message_to_parent?.trim() || DEFAULT_PARENT_MESSAGE;

  if (rule.rule_type === "percentage") {
    const requiredPct = Number(rule.required_percentage ?? 0);
    const classRequired = await getClassAssignedFeeTotal(
      client,
      typedStudent.school_id,
      rule.class_id
    );
    const denominator = classRequired > 0 ? classRequired : totalRequired;
    const paidPercent =
      denominator > 0 ? (totalPaid / denominator) * 100 : 100;
    const eligible = paidPercent >= requiredPct;

    return {
      eligible,
      reason: eligible
        ? "Fee payment meets the required percentage."
        : `Paid ${formatPercent(paidPercent)} — required ${formatPercent(requiredPct)}.`,
      paidAmount: totalPaid,
      requiredAmount: denominator > 0 ? (denominator * requiredPct) / 100 : null,
      paidPercent: Math.round(paidPercent * 100) / 100,
      requiredPercent: requiredPct,
      ruleType: "percentage" as ReportCardFeeRuleType,
      remainingAmount:
        denominator > 0
          ? Math.max(0, (denominator * requiredPct) / 100 - totalPaid)
          : null,
      parentMessage,
    };
  }

  const requiredAmt = Number(rule.required_amount ?? 0);
  const eligible = totalPaid >= requiredAmt;
  const remaining = Math.max(0, requiredAmt - totalPaid);
  const paidPercent =
    requiredAmt > 0 ? (totalPaid / requiredAmt) * 100 : 100;

  return {
    eligible,
    reason: eligible
      ? "Fee payment meets the required amount."
      : `Paid ${formatMoney(totalPaid)} TZS — required ${formatMoney(requiredAmt)} TZS.`,
    paidAmount: totalPaid,
    requiredAmount: requiredAmt,
    paidPercent: Math.round(paidPercent * 100) / 100,
    requiredPercent: null,
    ruleType: "fixed_amount" as ReportCardFeeRuleType,
    remainingAmount: remaining,
    parentMessage,
  };
}
