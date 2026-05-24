import type { ReportCardFeeScheduleType } from "./schedule-types";
import type {
  ParentReportEligibilityResult,
  ReportCardFeeRuleRow,
  ReportCardFeeRuleType,
} from "./types";

const DEFAULT_PARENT_MESSAGE =
  "Your child's report card will become available after completing required school fee payment.";

function formatPercent(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function buildEligibleResult(
  paidAmount: number,
  totalRequired: number,
  scheduleType: ReportCardFeeScheduleType | null,
  appliedRuleLabel: string
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
    ruleType: null,
    remainingAmount: null,
    parentMessage: null,
    scheduleType,
    appliedRuleLabel,
  };
}

export function evaluateRuleForStudent(
  rule: ReportCardFeeRuleRow,
  scheduleType: ReportCardFeeScheduleType,
  appliedRuleLabel: string,
  totalPaid: number,
  totalRequired: number,
  classRequired: number
): ParentReportEligibilityResult {
  const parentMessage =
    rule.message_to_parent?.trim() || DEFAULT_PARENT_MESSAGE;

  if (rule.rule_type === "percentage") {
    const requiredPct = Number(rule.required_percentage ?? 0);
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
      requiredAmount:
        denominator > 0 ? (denominator * requiredPct) / 100 : null,
      paidPercent: Math.round(paidPercent * 100) / 100,
      requiredPercent: requiredPct,
      ruleType: "percentage" as ReportCardFeeRuleType,
      remainingAmount:
        denominator > 0
          ? Math.max(0, (denominator * requiredPct) / 100 - totalPaid)
          : null,
      parentMessage,
      scheduleType,
      appliedRuleLabel,
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
    scheduleType,
    appliedRuleLabel,
  };
}
