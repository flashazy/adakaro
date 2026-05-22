import type { ReportCardFeeRuleRow, ReportCardFeeRuleType } from "./types";
import type { ReportCardFeeScheduleType } from "./schedule-types";
import {
  formatTermLabel,
  monthLabel,
  parseReportCardTermNumber,
} from "./schedule-types";

export interface ReportCardEligibilityContext {
  academicYear?: string | null;
  term?: string | null;
  /** Calendar month 1–12; defaults to current month when omitted. */
  sendMonth?: number | null;
}

export interface ResolvedFeeRule {
  rule: ReportCardFeeRuleRow;
  scheduleType: ReportCardFeeScheduleType;
  appliedRuleLabel: string;
}

function formatRequirementForLabel(rule: ReportCardFeeRuleRow): string {
  if (rule.rule_type === "percentage") {
    return `${Number(rule.required_percentage ?? 0)}% required`;
  }
  const amt = Number(rule.required_amount ?? 0);
  return `${amt.toLocaleString("en-US", { maximumFractionDigits: 0 })} required`;
}

export function buildAppliedRuleLabel(
  rule: ReportCardFeeRuleRow,
  scheduleType: ReportCardFeeScheduleType
): string {
  const req = formatRequirementForLabel(rule);
  if (scheduleType === "term_based" && rule.term != null) {
    const year = rule.academic_year?.trim() || "";
    return `${formatTermLabel(rule.term)}${year ? ` · ${year}` : ""} · ${req}`;
  }
  if (scheduleType === "monthly_milestones" && rule.month != null) {
    const year = rule.academic_year?.trim() || "";
    return `${monthLabel(rule.month)} milestone${year ? ` · ${year}` : ""} · ${req}`;
  }
  return `Class rule · ${req}`;
}

function resolveTermRule(
  rules: ReportCardFeeRuleRow[],
  academicYear: string,
  termNum: number
): ReportCardFeeRuleRow | null {
  const match = rules.find(
    (r) =>
      r.schedule_type === "term_based" &&
      r.is_enabled &&
      (r.academic_year ?? "").trim() === academicYear &&
      r.term === termNum
  );
  return match ?? null;
}

function resolveMonthlyMilestone(
  rules: ReportCardFeeRuleRow[],
  academicYear: string,
  sendMonth: number
): ReportCardFeeRuleRow | null {
  const candidates = rules.filter(
    (r) =>
      r.schedule_type === "monthly_milestones" &&
      r.is_enabled &&
      (r.academic_year ?? "").trim() === academicYear &&
      r.month != null &&
      r.month <= sendMonth
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.month ?? 0) - (a.month ?? 0));
  return candidates[0] ?? null;
}

function resolveSimpleRule(
  rules: ReportCardFeeRuleRow[],
  allRulesIncludingParent: ReportCardFeeRuleRow[],
  classId: string
): ReportCardFeeRuleRow | null {
  const direct = rules.find(
    (r) => r.schedule_type === "simple" && r.class_id === classId
  );
  if (direct) return direct.is_enabled ? direct : null;

  const parentSimple = allRulesIncludingParent.find(
    (r) =>
      r.schedule_type === "simple" &&
      r.class_id !== classId &&
      r.is_enabled
  );
  return parentSimple ?? null;
}

/**
 * Resolve which fee rule applies for parent access (term → monthly → simple).
 */
export function resolveReportCardFeeRule(
  rules: ReportCardFeeRuleRow[],
  allRulesIncludingParent: ReportCardFeeRuleRow[],
  classId: string,
  context?: ReportCardEligibilityContext
): ResolvedFeeRule | null {
  const academicYear = context?.academicYear?.trim() || null;
  const termNum = parseReportCardTermNumber(context?.term);
  const sendMonth =
    context?.sendMonth != null &&
    context.sendMonth >= 1 &&
    context.sendMonth <= 12
      ? context.sendMonth
      : null;

  if (academicYear && termNum != null) {
    const termRule = resolveTermRule(rules, academicYear, termNum);
    if (termRule) {
      return {
        rule: termRule,
        scheduleType: "term_based",
        appliedRuleLabel: buildAppliedRuleLabel(termRule, "term_based"),
      };
    }
  }

  if (academicYear && sendMonth != null) {
    const monthRule = resolveMonthlyMilestone(rules, academicYear, sendMonth);
    if (monthRule) {
      return {
        rule: monthRule,
        scheduleType: "monthly_milestones",
        appliedRuleLabel: buildAppliedRuleLabel(
          monthRule,
          "monthly_milestones"
        ),
      };
    }
  }

  const simple = resolveSimpleRule(rules, allRulesIncludingParent, classId);
  if (simple?.is_enabled) {
    return {
      rule: simple,
      scheduleType: "simple",
      appliedRuleLabel: buildAppliedRuleLabel(simple, "simple"),
    };
  }

  return null;
}

/** Primary schedule mode configured for a class (for finance UI). */
export function inferClassScheduleType(
  rules: ReportCardFeeRuleRow[]
): ReportCardFeeScheduleType {
  const hasTerm = rules.some((r) => r.schedule_type === "term_based");
  if (hasTerm) return "term_based";
  const hasMonthly = rules.some(
    (r) => r.schedule_type === "monthly_milestones"
  );
  if (hasMonthly) return "monthly_milestones";
  return "simple";
}

export type { ReportCardFeeRuleType };
