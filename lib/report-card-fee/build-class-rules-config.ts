import type { ReportCardFeeRuleRow, ClassFeeRulesConfig } from "./types";
import type { ReportCardFeeScheduleType } from "./schedule-types";
import {
  defaultAcademicYear,
  scheduleTypeSummary,
  SCHEDULE_TYPE_SUMMARY_LABELS,
} from "./schedule-types";

export { scheduleTypeSummary, SCHEDULE_TYPE_SUMMARY_LABELS };

function inferClassScheduleType(
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

function emptyTermRows(termCount: 2 | 3) {
  return Array.from({ length: termCount }, (_, i) => ({
    id: null as string | null,
    term: i + 1,
    ruleType: "percentage" as const,
    requiredPercentage: 70,
    requiredAmount: null as number | null,
    isEnabled: false,
    messageToParent: "",
  }));
}

function emptyMonthRows() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: null as string | null,
    month: i + 1,
    ruleType: "percentage" as const,
    requiredPercentage: null as number | null,
    requiredAmount: null as number | null,
    isEnabled: false,
    messageToParent: "",
  }));
}

export function buildClassFeeRulesConfig(
  rules: ReportCardFeeRuleRow[]
): ClassFeeRulesConfig {
  const scheduleType = inferClassScheduleType(rules);
  const academicYear =
    rules.find((r) => r.academic_year)?.academic_year?.trim() ||
    defaultAcademicYear();

  const termRules = rules.filter((r) => r.schedule_type === "term_based");
  const maxTerm = termRules.reduce((m, r) => Math.max(m, r.term ?? 0), 0);
  const termCount: 2 | 3 = maxTerm >= 3 ? 3 : 2;

  const monthRules = rules.filter(
    (r) => r.schedule_type === "monthly_milestones"
  );

  const simpleRow =
    rules.find((r) => r.schedule_type === "simple") ??
    rules.find(
      (r) =>
        r.schedule_type !== "term_based" &&
        r.schedule_type !== "monthly_milestones" &&
        r.term == null &&
        r.month == null
    ) ??
    (rules.length === 1 ? rules[0] : null);

  const allowAdminOverride =
    rules.find((r) => r.allow_admin_override === false) == null;

  const terms = emptyTermRows(termCount).map((row) => {
    const existing = termRules.find((r) => r.term === row.term);
    if (!existing) return row;
    return {
      id: existing.id,
      term: row.term,
      ruleType: existing.rule_type,
      requiredPercentage:
        existing.required_percentage != null
          ? Number(existing.required_percentage)
          : null,
      requiredAmount:
        existing.required_amount != null
          ? Number(existing.required_amount)
          : null,
      isEnabled: existing.is_enabled,
      messageToParent: existing.message_to_parent ?? "",
    };
  });

  const months = emptyMonthRows().map((row) => {
    const existing = monthRules.find((r) => r.month === row.month);
    if (!existing) return row;
    return {
      id: existing.id,
      month: row.month,
      ruleType: existing.rule_type,
      requiredPercentage:
        existing.required_percentage != null
          ? Number(existing.required_percentage)
          : null,
      requiredAmount:
        existing.required_amount != null
          ? Number(existing.required_amount)
          : null,
      isEnabled: existing.is_enabled,
      messageToParent: existing.message_to_parent ?? "",
    };
  });

  return {
    scheduleType,
    allowAdminOverride,
    academicYear,
    termCount,
    simple: simpleRow
      ? {
          id: simpleRow.id,
          ruleType: simpleRow.rule_type,
          requiredPercentage:
            simpleRow.required_percentage != null
              ? Number(simpleRow.required_percentage)
              : null,
          requiredAmount:
            simpleRow.required_amount != null
              ? Number(simpleRow.required_amount)
              : null,
          isEnabled: simpleRow.is_enabled,
          messageToParent: simpleRow.message_to_parent ?? "",
        }
      : null,
    terms,
    months,
  };
}
