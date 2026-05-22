export type ReportCardFeeRuleType = "percentage" | "fixed_amount";

export type ReportCardFeeRuleRow = {
  id: string;
  school_id: string;
  class_id: string;
  rule_type: ReportCardFeeRuleType;
  required_percentage: number | null;
  required_amount: number | null;
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
  reportCardId: string;
  eligible: boolean;
  reason: string;
  paidAmount: number;
  requiredAmount: number | null;
  paidPercent: number;
  requiredPercent: number | null;
  ruleType: ReportCardFeeRuleType | null;
};

export type ClassSendEligibilityPreview = {
  ruleEnabled: boolean;
  allowAdminOverride: boolean;
  eligibleCount: number;
  blockedCount: number;
  totalPending: number;
  students: SendEligibilityStudentRow[];
};
