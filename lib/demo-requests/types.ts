export const DEMO_REQUEST_STATUSES = [
  "New",
  "Contacted",
  "Demo Scheduled",
  "Demo Completed",
  "Won",
  "Lost",
] as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const DEMO_REQUEST_SCHOOL_TYPES = [
  "Primary",
  "Secondary",
  "Primary & Secondary",
  "Other",
] as const;

export type DemoRequestSchoolType = (typeof DEMO_REQUEST_SCHOOL_TYPES)[number];

export const DEMO_REQUEST_NEXT_ACTIONS = [
  "Call school owner",
  "Send WhatsApp",
  "Schedule demo",
  "Follow up",
  "Proposal sent",
] as const;

export type DemoRequestNextAction = (typeof DEMO_REQUEST_NEXT_ACTIONS)[number];

export const DEMO_REQUEST_SELECT_COLS =
  "id, created_at, full_name, school_name, phone, email, school_type, student_count, message, status, source, request_type, notes, updated_at, next_action, next_action_date, demo_date, demo_time, meeting_link, last_contact_at, lost_reason, won_reason, assigned_to_id, assigned_to_name";

export const DEMO_REQUEST_LEAD_SOURCES = [
  "contact_page",
  "whatsapp",
] as const;

export type DemoRequestLeadSource = (typeof DEMO_REQUEST_LEAD_SOURCES)[number];

export const DEMO_REQUEST_REQUEST_TYPES = ["demo", "support"] as const;

export type DemoRequestRequestType = (typeof DEMO_REQUEST_REQUEST_TYPES)[number];

export const DEMO_REQUEST_SOURCE_LABELS: Record<DemoRequestLeadSource, string> = {
  contact_page: "Website Form",
  whatsapp: "WhatsApp",
};

export const DEMO_REQUEST_TYPE_LABELS: Record<DemoRequestRequestType, string> = {
  demo: "Demo",
  support: "Support",
};

export interface DemoRequestRow {
  id: string;
  created_at: string;
  full_name: string;
  school_name: string;
  phone: string;
  email: string | null;
  school_type: string | null;
  student_count: number | null;
  message: string | null;
  status: DemoRequestStatus;
  source: DemoRequestLeadSource | string;
  request_type: DemoRequestRequestType | string;
  notes: string | null;
  updated_at: string;
  next_action: string | null;
  next_action_date: string | null;
  demo_date: string | null;
  demo_time: string | null;
  meeting_link: string | null;
  last_contact_at: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
}

export interface DemoRequestNote {
  id: string;
  demo_request_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface DemoRequestStats {
  total: number;
  new: number;
  contacted: number;
  demoScheduled: number;
  won: number;
}

export function computeDemoRequestStats(
  rows: Pick<DemoRequestRow, "status">[]
): DemoRequestStats {
  return {
    total: rows.length,
    new: rows.filter((r) => r.status === "New").length,
    contacted: rows.filter((r) => r.status === "Contacted").length,
    demoScheduled: rows.filter((r) => r.status === "Demo Scheduled").length,
    won: rows.filter((r) => r.status === "Won").length,
  };
}

export type {
  DemoLeadPipelineStats,
  DemoLeadExecutiveInsights,
  LeadPriority,
  LeadValueTier,
  LeadScoreTier,
  RevenueTier,
  SalesPipelineStage,
  ConversationHistoryItem,
  LeadScoreFactor,
} from "@/lib/demo-requests/computed";

export {
  computeLeadPriority,
  computeLeadValue,
  computePipelineStats,
  computeExecutiveInsights,
  isNextActionOverdue,
  isDemoScheduled,
  buildWhatsAppUrl,
  buildDemoWhatsAppMessage,
  computeLeadScore,
  getLeadScoreTier,
  getLeadScoreBreakdown,
  getNextBestAction,
  getContextualNextAction,
  computeRevenueTier,
  computeAnnualRevenueTzs,
  formatRevenueTzs,
  computeDaysWaiting,
  formatRelativeContact,
  isNewLeadFollowUpOverdue,
  needsNextStep,
  isLeadOverdue,
  computePipelineStageCounts,
  buildConversationHistory,
  formatTimelineDay,
  SALES_PIPELINE_STAGES,
} from "@/lib/demo-requests/computed";

export type { DemoRequestTimelineEvent } from "@/lib/demo-requests/timeline";

export {
  LOST_REASONS,
  WON_REASONS,
  LEAD_OWNER_OPTIONS,
  NOTE_TEMPLATES,
  computeDealHealth,
  computeAttentionFlags,
  computeNextDeadline,
  computeCloseProbability,
  generateExecutiveSummary,
  formatLastActivitySummary,
  filterConversationHistory,
  computeConversionDays,
  dealHealthTone,
  closeProbabilityTone,
} from "@/lib/demo-requests/sales-execution";

export type {
  LostReason,
  WonReason,
  TimelineFilter,
  DealHealth,
  CloseProbability,
  CloseProbabilityTier,
  AttentionFlag,
  NextDeadline,
} from "@/lib/demo-requests/sales-execution";

export type { ContextualNextAction } from "@/lib/demo-requests/sales-intelligence";

export {
  computeLeadReminders,
  reminderToneClass,
} from "@/lib/demo-requests/reminders";

export type { LeadReminder, ReminderTone } from "@/lib/demo-requests/reminders";

export {
  computeDailyActivity,
  computeConversionAnalytics,
} from "@/lib/demo-requests/crm-analytics";

export type {
  DailyActivityMetrics,
  DailyActivityPeriods,
  ConversionAnalytics,
  TimelineEventLite,
} from "@/lib/demo-requests/crm-analytics";

export {
  pipelineStageBadgeClass,
  pipelineStageTextClass,
  pipelineStageSelectAccentClass,
  timelineActivityIconClass,
  TIMELINE_FILTER_ACTIVE_STYLES,
  PIPELINE_STAGE_STYLES,
} from "@/lib/demo-requests/pipeline-stage-styles";
