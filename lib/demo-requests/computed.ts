import type { DemoRequestRow } from "@/lib/demo-requests/types";
import {
  computeExecutiveInsightsV2,
  computePipelineStatsV2,
  type DemoLeadExecutiveInsightsV2,
  type DemoLeadPipelineStatsV2,
} from "@/lib/demo-requests/sales-intelligence";

export type LeadPriority = "High" | "Medium" | "Low";

export type LeadValueTier =
  | "Small School"
  | "Growing School"
  | "Enterprise School";

export function computeLeadPriority(
  studentCount: number | null,
  schoolType: string | null
): LeadPriority {
  if (
    (studentCount !== null && studentCount >= 500) ||
    schoolType === "Primary & Secondary"
  ) {
    return "High";
  }
  if (studentCount !== null && studentCount >= 150 && studentCount <= 499) {
    return "Medium";
  }
  return "Low";
}

export function computeLeadValue(studentCount: number | null): LeadValueTier {
  if (studentCount === null || studentCount < 100) {
    return "Small School";
  }
  if (studentCount < 500) {
    return "Growing School";
  }
  return "Enterprise School";
}

export function isNextActionOverdue(dateIso: string | null): boolean {
  if (!dateIso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateIso);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function isDemoScheduled(
  row: Pick<DemoRequestRow, "demo_date" | "status">
): boolean {
  return row.demo_date != null || row.status === "Demo Scheduled";
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "#";
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

export function buildDemoWhatsAppMessage(
  row: Pick<DemoRequestRow, "full_name" | "school_name">
): string {
  return `Hello ${row.full_name}, this is Adakaro regarding your demo request for ${row.school_name}.`;
}

export type DemoLeadPipelineStats = DemoLeadPipelineStatsV2;
export type DemoLeadExecutiveInsights = DemoLeadExecutiveInsightsV2;

export function computePipelineStats(rows: DemoRequestRow[]): DemoLeadPipelineStats {
  return computePipelineStatsV2(rows);
}

export function computeExecutiveInsights(
  rows: DemoRequestRow[]
): DemoLeadExecutiveInsights {
  return computeExecutiveInsightsV2(rows);
}

export type {
  LeadScoreTier,
  RevenueTier,
  SalesPipelineStage,
  ConversationHistoryItem,
  LeadScoreFactor,
  ContextualNextAction,
} from "@/lib/demo-requests/sales-intelligence";

export {
  computeLeadScore,
  getLeadScoreTier,
  getLeadScoreBreakdown,
  getNextBestAction,
  getContextualNextAction,
  computeRevenueTier,
  computeAnnualRevenueTzs,
  formatRevenueTzs,
  inferRegion,
  computeDaysWaiting,
  formatRelativeContact,
  isNewLeadFollowUpOverdue,
  needsNextStep,
  isLeadOverdue,
  computePipelineStageCounts,
  buildConversationHistory,
  formatTimelineDay,
  SALES_PIPELINE_STAGES,
} from "@/lib/demo-requests/sales-intelligence";
