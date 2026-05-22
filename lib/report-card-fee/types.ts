import type { ReportCardFeeScheduleType } from "./schedule-types";

export type { ReportCardFeeScheduleType };

export type ReportCardFeeRuleType = "percentage" | "fixed_amount";

export type ReportCardFeeRuleRow = {
  id: string;
  school_id: string;
  class_id: string;
  schedule_type: ReportCardFeeScheduleType;
  rule_type: ReportCardFeeRuleType;
  required_percentage: number | null;
  required_amount: number | null;
  academic_year: string | null;
  term: number | null;
  month: number | null;
  is_enabled: boolean;
  allow_admin_override: boolean;
  message_to_parent: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ParentReportEligibilityResult = {
  eligible: boolean;
  reason: string;
  paidAmount: number;
  requiredAmount: number | null;
  paidPercent: number;
  requiredPercent: number | null;
  ruleType: ReportCardFeeRuleType | null;
  remainingAmount: number | null;
  parentMessage: string | null;
  scheduleType: ReportCardFeeScheduleType | null;
  appliedRuleLabel: string;
};

export type ReportCardFeeAuditAction =
  | "rule_created"
  | "rule_changed"
  | "rule_disabled"
  | "admin_override_used"
  | "report_blocked";

export type SendEligibilityStudentRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  reportCardId: string;
  eligible: boolean;
  reason: string;
  paidAmount: number;
  requiredAmount: number | null;
  paidPercent: number;
  requiredPercent: number | null;
  ruleType: ReportCardFeeRuleType | null;
  appliedRuleLabel: string;
};

export type ClassSendEligibilityPreview = {
  ruleEnabled: boolean;
  allowAdminOverride: boolean;
  appliedRuleLabel: string | null;
  scheduleType: ReportCardFeeScheduleType | null;
  eligibleCount: number;
  blockedCount: number;
  totalPending: number;
  students: SendEligibilityStudentRow[];
};

/** Finance UI: grouped rules for one class. */
export type ClassFeeRulesConfig = {
  scheduleType: ReportCardFeeScheduleType;
  allowAdminOverride: boolean;
  academicYear: string;
  termCount: 2 | 3;
  simple: {
    id: string | null;
    ruleType: ReportCardFeeRuleType;
    requiredPercentage: number | null;
    requiredAmount: number | null;
    isEnabled: boolean;
    messageToParent: string;
  } | null;
  terms: Array<{
    id: string | null;
    term: number;
    ruleType: ReportCardFeeRuleType;
    requiredPercentage: number | null;
    requiredAmount: number | null;
    isEnabled: boolean;
    messageToParent: string;
  }>;
  months: Array<{
    id: string | null;
    month: number;
    ruleType: ReportCardFeeRuleType;
    requiredPercentage: number | null;
    requiredAmount: number | null;
    isEnabled: boolean;
    messageToParent: string;
  }>;
};

export type TermRuleInput = {
  term: number;
  isEnabled: boolean;
  ruleType: ReportCardFeeRuleType;
  requiredPercentage: number | null;
  requiredAmount: number | null;
  messageToParent: string | null;
};

export type MonthRuleInput = {
  month: number;
  isEnabled: boolean;
  ruleType: ReportCardFeeRuleType;
  requiredPercentage: number | null;
  requiredAmount: number | null;
  messageToParent: string | null;
};
