import { formatCurrency, type SchoolCurrencyCode } from "@/lib/currency";
import type { ClassFeeRulesConfig, ReportCardFeeRuleType } from "./types";
import { scheduleTypeSummary } from "./build-class-rules-config";

export interface FeeRuleRowRule {
  ruleType: ReportCardFeeRuleType;
  requiredPercentage: number | null;
  requiredAmount: number | null;
  isEnabled: boolean;
}

export const PARENT_MESSAGE_TEMPLATES = [
  "Report card becomes available after completing required school fee payment.",
  "Please contact the finance office for assistance regarding report card access.",
  "Report card access is temporarily restricted until required fee payment is completed.",
] as const;

export function formatRuleTypeLabel(type: ReportCardFeeRuleType | null | undefined): string {
  if (!type) return "—";
  return type === "percentage" ? "Percentage" : "Fixed amount";
}

export type FinanceRulesStatus = "active" | "no_rules" | "setup_needed";

export function classHasEnabledAccessRule(config: ClassFeeRulesConfig): boolean {
  return Boolean(configToDisplayRule(config)?.isEnabled);
}

export function countClassesWithEnabledRules(
  rows: { config: ClassFeeRulesConfig }[]
): number {
  return rows.filter((r) => classHasEnabledAccessRule(r.config)).length;
}

export function deriveFinanceRulesStatus(
  rows: { config: ClassFeeRulesConfig; feeAssigned: number }[]
): FinanceRulesStatus {
  const hasEnabled = rows.some((r) => classHasEnabledAccessRule(r.config));
  if (!hasEnabled) return "no_rules";
  if (rows.some((r) => r.feeAssigned <= 0)) return "setup_needed";
  return "active";
}

export function configToDisplayRule(
  config: ClassFeeRulesConfig
): FeeRuleRowRule | null {
  if (config.scheduleType === "simple" && config.simple) {
    return {
      ruleType: config.simple.ruleType,
      requiredPercentage: config.simple.requiredPercentage,
      requiredAmount: config.simple.requiredAmount,
      isEnabled: config.simple.isEnabled,
    };
  }
  if (config.scheduleType === "term_based") {
    const active = config.terms.find((t) => t.isEnabled);
    if (active) {
      return {
        ruleType: active.ruleType,
        requiredPercentage: active.requiredPercentage,
        requiredAmount: active.requiredAmount,
        isEnabled: true,
      };
    }
  }
  if (config.scheduleType === "monthly_milestones") {
    const active = config.months.filter((m) => m.isEnabled).pop();
    if (active) {
      return {
        ruleType: active.ruleType,
        requiredPercentage: active.requiredPercentage,
        requiredAmount: active.requiredAmount,
        isEnabled: true,
      };
    }
  }
  return config.simple
    ? {
        ruleType: config.simple.ruleType,
        requiredPercentage: config.simple.requiredPercentage,
        requiredAmount: config.simple.requiredAmount,
        isEnabled: config.simple.isEnabled,
      }
    : null;
}

export function configScheduleLabel(config: ClassFeeRulesConfig): string {
  const base = scheduleTypeSummary(config.scheduleType);
  if (config.scheduleType === "term_based") {
    const n = config.terms.filter((t) => t.isEnabled).length;
    return n > 0 ? `${base} · ${n} term${n === 1 ? "" : "s"}` : base;
  }
  if (config.scheduleType === "monthly_milestones") {
    const n = config.months.filter((m) => m.isEnabled).length;
    return n > 0 ? `${base} · ${n} month${n === 1 ? "" : "s"}` : base;
  }
  return base;
}

export function parentAccessBadgeText(
  rule: FeeRuleRowRule | null,
  currency: SchoolCurrencyCode,
  feeAssigned?: number
): { label: string; tone: "disabled" | "active" | "warning" } {
  if (feeAssigned != null && feeAssigned <= 0 && rule?.isEnabled) {
    return { label: "Needs class fee", tone: "warning" };
  }
  if (!rule?.isEnabled) {
    return { label: "Rule off", tone: "disabled" };
  }
  if (rule.ruleType === "percentage") {
    const pct = rule.requiredPercentage ?? 0;
    return { label: `${pct}% required`, tone: "active" };
  }
  const amt = formatCurrency(rule.requiredAmount ?? 0, currency);
  return { label: `${amt} required`, tone: "active" };
}

export function requirementDisplay(
  ruleType: ReportCardFeeRuleType,
  requiredPercentage: number,
  requiredAmount: number,
  currency: SchoolCurrencyCode
): string {
  if (ruleType === "percentage") {
    return `${requiredPercentage}%`;
  }
  return formatCurrency(requiredAmount, currency);
}

export function minimumPaymentNeeded(
  feeAssigned: number,
  ruleType: ReportCardFeeRuleType,
  requiredPercentage: number,
  requiredAmount: number
): number | null {
  if (feeAssigned <= 0) return null;
  if (ruleType === "percentage") {
    const pct = Math.min(100, Math.max(0, requiredPercentage));
    return (feeAssigned * pct) / 100;
  }
  return Math.max(0, requiredAmount);
}

export function requirementExplanation(
  feeAssigned: number,
  ruleType: ReportCardFeeRuleType,
  requiredPercentage: number,
  requiredAmount: number,
  currency: SchoolCurrencyCode
): string {
  if (ruleType === "percentage") {
    if (feeAssigned <= 0) {
      return "Assign a class fee before using a percentage rule. Parents are compared against the total assigned fee.";
    }
    const min = minimumPaymentNeeded(feeAssigned, ruleType, requiredPercentage, requiredAmount);
    const minStr = min != null ? formatCurrency(min, currency) : "—";
    return `Parents can receive report cards only after paying at least ${requiredPercentage}% of the assigned fee (${minStr}).`;
  }
  const amt = formatCurrency(requiredAmount, currency);
  return `Parents can receive report cards only after paying at least ${amt}.`;
}
