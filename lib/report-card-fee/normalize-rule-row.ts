import type { ReportCardFeeRuleRow, ReportCardFeeRuleType } from "./types";
import type { ReportCardFeeScheduleType } from "./schedule-types";

/** Normalize DB rows (legacy rows may omit schedule_type). */
export function normalizeReportCardFeeRuleRow(
  raw: Record<string, unknown>
): ReportCardFeeRuleRow {
  const scheduleRaw = raw.schedule_type as string | null | undefined;
  let schedule_type: ReportCardFeeScheduleType = "simple";
  if (
    scheduleRaw === "term_based" ||
    scheduleRaw === "monthly_milestones" ||
    scheduleRaw === "simple"
  ) {
    schedule_type = scheduleRaw;
  } else if (raw.term != null) {
    schedule_type = "term_based";
  } else if (raw.month != null) {
    schedule_type = "monthly_milestones";
  }

  const ruleTypeRaw = raw.rule_type as string;
  const rule_type: ReportCardFeeRuleType =
    ruleTypeRaw === "fixed_amount" ? "fixed_amount" : "percentage";

  return {
    id: String(raw.id ?? ""),
    school_id: String(raw.school_id ?? ""),
    class_id: String(raw.class_id ?? ""),
    schedule_type,
    rule_type,
    required_percentage:
      raw.required_percentage != null
        ? Number(raw.required_percentage)
        : null,
    required_amount:
      raw.required_amount != null ? Number(raw.required_amount) : null,
    academic_year:
      raw.academic_year != null ? String(raw.academic_year) : null,
    term: raw.term != null ? Number(raw.term) : null,
    month: raw.month != null ? Number(raw.month) : null,
    is_enabled: raw.is_enabled !== false && raw.is_enabled !== "false",
    allow_admin_override:
      raw.allow_admin_override !== false && raw.allow_admin_override !== "false",
    message_to_parent:
      raw.message_to_parent != null ? String(raw.message_to_parent) : null,
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}
