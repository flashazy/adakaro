import type { DemoRequestRow, DemoRequestTimelineEvent } from "@/lib/demo-requests/types";

const KEYWORD_SCORE_TERMS = [
  "fees",
  "report cards",
  "attendance",
  "finance",
  "results",
] as const;

export type LeadScoreTier = "Hot Lead" | "Warm Lead" | "Cold Lead";

export type RevenueTier =
  | "Small School"
  | "Growing School"
  | "Professional School"
  | "Enterprise School";

export const SALES_PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Demo Scheduled",
  "Demo Completed",
  "Won",
] as const;

export type SalesPipelineStage = (typeof SALES_PIPELINE_STAGES)[number];

const REVENUE_ANNUAL_TZS: Record<RevenueTier, number> = {
  "Small School": 600_000,
  "Growing School": 1_200_000,
  "Professional School": 2_400_000,
  "Enterprise School": 3_600_000,
};

const TZ_REGION_HINTS: { region: string; patterns: RegExp[] }[] = [
  { region: "Dar es Salaam", patterns: [/dar(\s|\.|-)?es?\s*salaam/i, /\bdar\b/i, /\bdsm\b/i] },
  { region: "Arusha", patterns: [/arusha/i] },
  { region: "Mwanza", patterns: [/mwanza/i] },
  { region: "Dodoma", patterns: [/dodoma/i] },
  { region: "Mbeya", patterns: [/mbeya/i] },
  { region: "Morogoro", patterns: [/morogoro/i] },
  { region: "Tanga", patterns: [/tanga/i] },
  { region: "Zanzibar", patterns: [/zanzibar/i, /unguja/i, /pemba/i] },
  { region: "Moshi", patterns: [/moshi/i, /kilimanjaro/i] },
];

export function computeLeadScore(
  row: Pick<
    DemoRequestRow,
    "school_type" | "student_count" | "email" | "phone" | "message"
  >
): number {
  let score = 0;

  if (row.school_type === "Primary & Secondary") score += 30;
  if (row.student_count != null && row.student_count > 500) score += 25;
  if (row.email?.trim()) score += 15;
  if (row.phone?.trim()) score += 15;

  const message = (row.message ?? "").toLowerCase();
  if (
    message &&
    KEYWORD_SCORE_TERMS.some((term) => message.includes(term))
  ) {
    score += 15;
  }

  return Math.min(100, score);
}

export function getLeadScoreTier(score: number): LeadScoreTier {
  if (score >= 80) return "Hot Lead";
  if (score >= 50) return "Warm Lead";
  return "Cold Lead";
}

export interface LeadScoreFactor {
  label: string;
  points: number;
  met: boolean;
}

export function getLeadScoreBreakdown(
  row: Pick<
    DemoRequestRow,
    "school_type" | "student_count" | "email" | "phone" | "message"
  >
): LeadScoreFactor[] {
  const message = (row.message ?? "").toLowerCase();
  const hasKeywords = KEYWORD_SCORE_TERMS.some((term) => message.includes(term));
  const studentLabel =
    row.student_count != null
      ? `${row.student_count.toLocaleString()} Students`
      : "500+ Students";

  return [
    {
      label: "Primary & Secondary school",
      points: 30,
      met: row.school_type === "Primary & Secondary",
    },
    {
      label: studentLabel,
      points: 25,
      met: row.student_count != null && row.student_count > 500,
    },
    {
      label: "Email provided",
      points: 15,
      met: Boolean(row.email?.trim()),
    },
    {
      label: "Phone provided",
      points: 15,
      met: Boolean(row.phone?.trim()),
    },
    {
      label: "Interest keywords in message",
      points: 15,
      met: hasKeywords,
    },
  ];
}

export function getNextBestAction(status: DemoRequestRow["status"]): {
  title: string;
  description: string;
} {
  switch (status) {
    case "New":
      return {
        title: "Contact school within 24 hours",
        description:
          "Reach out on WhatsApp first — introduce Adakaro and confirm their pain points.",
      };
    case "Contacted":
      return {
        title: "Schedule demo meeting",
        description:
          "Book a live walkthrough and capture decision makers on the call.",
      };
    case "Demo Scheduled":
      return {
        title: "Prepare presentation",
        description:
          "Tailor the demo to their school size, fees workflow, and report cards.",
      };
    case "Demo Completed":
      return {
        title: "Send proposal",
        description:
          "Follow up with pricing, implementation timeline, and next steps to sign.",
      };
    case "Won":
      return {
        title: "Onboard the school",
        description: "Coordinate setup, training, and first-week success check-ins.",
      };
    case "Lost":
      return {
        title: "Log learnings",
        description:
          "Record why the deal was lost and set a future nurture follow-up date.",
      };
    default:
      return {
        title: "Review lead status",
        description: "Update the pipeline stage and set a clear next action.",
      };
  }
}

export interface ContextualNextAction {
  completedTitle?: string;
  title: string;
  description: string;
}

function hasLoggedContact(
  timeline: DemoRequestTimelineEvent[],
  row: Pick<DemoRequestRow, "last_contact_at">
): boolean {
  if (row.last_contact_at) return true;
  return timeline.some((event) => {
    const key = `${event.event_type ?? ""} ${event.label}`.toLowerCase();
    return (
      key.includes("call") ||
      key.includes("whatsapp") ||
      key.includes("email") ||
      event.event_type === "call_opened" ||
      event.event_type === "whatsapp_opened" ||
      event.event_type === "email_opened"
    );
  });
}

export function getContextualNextAction(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[]
): ContextualNextAction {
  const base = getNextBestAction(row.status);
  const contacted = hasLoggedContact(timeline, row);

  if (row.status === "New" && contacted) {
    return {
      completedTitle: "✓ First contact completed",
      title: "Schedule demo",
      description:
        "Book a live walkthrough while interest is fresh — confirm decision makers on the call.",
    };
  }

  if (row.status === "Contacted" && contacted && !row.demo_date) {
    return {
      completedTitle: "✓ First contact completed",
      title: "Schedule demo",
      description:
        "Set a demo date and time, then send the meeting link to the school owner.",
    };
  }

  if (row.status === "Contacted" && row.demo_date) {
    return {
      completedTitle: "✓ Demo scheduled",
      title: "Prepare presentation",
      description:
        "Tailor the walkthrough to their school size, fees workflow, and report cards.",
    };
  }

  if (row.status === "Demo Completed") {
    if (row.next_action?.toLowerCase().includes("proposal")) {
      return {
        completedTitle: "✓ Demo completed",
        title: "Await decision",
        description:
          "Follow up with the decision maker and confirm timeline to sign.",
      };
    }
    return {
      completedTitle: contacted ? "✓ Demo completed" : undefined,
      title: "Send pricing information",
      description:
        "Follow up with pricing tiers, implementation timeline, and clear next steps to sign.",
    };
  }

  if (row.status === "Demo Scheduled" && contacted) {
    return {
      completedTitle: "✓ Contact established",
      title: base.title,
      description: base.description,
    };
  }

  if (row.status === "Won") {
    return {
      title: "Close deal",
      description: "Create the school workspace and schedule onboarding.",
    };
  }

  if (row.status === "New" && !contacted) {
    return {
      title: "Contact school within 24 hours",
      description: base.description,
    };
  }

  return {
    title: base.title,
    description: base.description,
  };
}

export function computeRevenueTier(studentCount: number | null): RevenueTier {
  if (studentCount == null || studentCount <= 100) return "Small School";
  if (studentCount <= 300) return "Growing School";
  if (studentCount <= 600) return "Professional School";
  return "Enterprise School";
}

export function computeAnnualRevenueTzs(studentCount: number | null): number {
  return REVENUE_ANNUAL_TZS[computeRevenueTier(studentCount)];
}

export function formatRevenueTzs(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label =
      millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    return `TZS ${label}/year`;
  }
  if (amount >= 1_000) {
    return `TZS ${Math.round(amount / 1_000)}K/year`;
  }
  return `TZS ${amount.toLocaleString()}/year`;
}

export function inferRegion(
  row: Pick<DemoRequestRow, "school_name" | "message" | "phone">
): string {
  const haystack = `${row.school_name} ${row.message ?? ""}`.trim();
  for (const { region, patterns } of TZ_REGION_HINTS) {
    if (patterns.some((p) => p.test(haystack))) return region;
  }
  return "Unspecified";
}

export function computeDaysWaiting(createdAt: string): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatRelativeContact(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfContact = new Date(date);
  startOfContact.setHours(0, 0, 0, 0);

  if (startOfContact.getTime() === startOfToday.getTime()) return "Today";
  if (startOfContact.getTime() === startOfYesterday.getTime()) return "Yesterday";

  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfContact.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function isNewLeadFollowUpOverdue(
  row: Pick<DemoRequestRow, "status" | "created_at">
): boolean {
  if (row.status !== "New") return false;
  const created = new Date(row.created_at);
  if (Number.isNaN(created.getTime())) return false;
  const hours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return hours > 24;
}

export function needsNextStep(
  row: Pick<DemoRequestRow, "status" | "next_action">
): boolean {
  return row.status === "Contacted" && !row.next_action?.trim();
}

export function isLeadOverdue(
  row: Pick<
    DemoRequestRow,
    "status" | "created_at" | "next_action" | "next_action_date"
  >
): boolean {
  if (isNewLeadFollowUpOverdue(row)) return true;
  if (needsNextStep(row)) return true;
  if (row.next_action?.trim() && row.next_action_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(row.next_action_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) return true;
  }
  return false;
}

export function computePipelineStageCounts(
  rows: Pick<DemoRequestRow, "status">[]
): Record<SalesPipelineStage, number> {
  return {
    New: rows.filter((r) => r.status === "New").length,
    Contacted: rows.filter((r) => r.status === "Contacted").length,
    "Demo Scheduled": rows.filter((r) => r.status === "Demo Scheduled").length,
    "Demo Completed": rows.filter((r) => r.status === "Demo Completed").length,
    Won: rows.filter((r) => r.status === "Won").length,
  };
}

export interface DemoLeadExecutiveInsightsV2 {
  topSchoolType: string;
  averageStudentsPerLead: number | null;
  conversionRate: number;
  largestLead: { schoolName: string; studentCount: number } | null;
  mostActiveRegion: string;
  highestValueLead: {
    schoolName: string;
    tier: RevenueTier;
    annualRevenueTzs: number;
  } | null;
  averageResponseTimeHours: number | null;
  revenueOpportunityTzs: number;
  schoolsWaitingFollowUp: number;
  upcomingDemos: number;
  dealsAtRisk: number;
}

export function computeExecutiveInsightsV2(
  rows: DemoRequestRow[]
): DemoLeadExecutiveInsightsV2 {
  const typeCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();

  for (const row of rows) {
    const type = row.school_type?.trim() || "Unknown";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    const region = inferRegion(row);
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }

  let topSchoolType = "—";
  let maxTypeCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > maxTypeCount) {
      maxTypeCount = count;
      topSchoolType = type;
    }
  }

  let mostActiveRegion = "—";
  let maxRegionCount = 0;
  for (const [region, count] of regionCounts) {
    if (count > maxRegionCount) {
      maxRegionCount = count;
      mostActiveRegion = region;
    }
  }

  const withStudents = rows.filter((r) => r.student_count != null);
  const averageStudentsPerLead =
    withStudents.length > 0
      ? Math.round(
          withStudents.reduce((sum, r) => sum + (r.student_count ?? 0), 0) /
            withStudents.length
        )
      : null;

  const total = rows.length;
  const won = rows.filter((r) => r.status === "Won").length;
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  let largestLead: DemoLeadExecutiveInsightsV2["largestLead"] = null;
  let highestValueLead: DemoLeadExecutiveInsightsV2["highestValueLead"] = null;
  let maxRevenue = 0;

  for (const row of rows) {
    const revenue = computeAnnualRevenueTzs(row.student_count);
    if (revenue > maxRevenue) {
      maxRevenue = revenue;
      highestValueLead = {
        schoolName: row.school_name,
        tier: computeRevenueTier(row.student_count),
        annualRevenueTzs: revenue,
      };
    }
    if (row.student_count == null) continue;
    if (!largestLead || row.student_count > largestLead.studentCount) {
      largestLead = {
        schoolName: row.school_name,
        studentCount: row.student_count,
      };
    }
  }

  const responseSamples = rows
    .filter((r) => r.last_contact_at)
    .map((r) => {
      const created = new Date(r.created_at).getTime();
      const contacted = new Date(r.last_contact_at!).getTime();
      if (Number.isNaN(created) || Number.isNaN(contacted)) return null;
      return (contacted - created) / (1000 * 60 * 60);
    })
    .filter((h): h is number => h != null && h >= 0);

  const averageResponseTimeHours =
    responseSamples.length > 0
      ? Math.round(
          responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length
        )
      : null;

  const revenueOpportunityTzs = rows
    .filter((r) => r.status !== "Lost" && r.status !== "Won")
    .reduce((sum, r) => sum + computeAnnualRevenueTzs(r.student_count), 0);

  const schoolsWaitingFollowUp = rows.filter((r) => isLeadOverdue(r)).length;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const upcomingDemos = rows.filter((r) => {
    if (!r.demo_date || r.status === "Won" || r.status === "Lost") return false;
    const d = new Date(r.demo_date);
    d.setHours(0, 0, 0, 0);
    return d >= now && d <= weekAhead;
  }).length;

  const dealsAtRisk = rows.filter((r) => {
    if (r.status === "Won" || r.status === "Lost") return false;
    const last = r.last_contact_at ?? r.created_at;
    const days = Math.floor(
      (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days >= 3;
  }).length;

  return {
    topSchoolType,
    averageStudentsPerLead,
    conversionRate,
    largestLead,
    mostActiveRegion,
    highestValueLead,
    averageResponseTimeHours,
    revenueOpportunityTzs,
    schoolsWaitingFollowUp,
    upcomingDemos,
    dealsAtRisk,
  };
}

export interface DemoLeadPipelineStatsV2 {
  newLeadsToday: number;
  newLeadsThisWeek: number;
  pendingFollowUps: number;
  scheduledDemos: number;
  overdueLeads: number;
}

export function computePipelineStatsV2(
  rows: DemoRequestRow[]
): DemoLeadPipelineStatsV2 {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diff);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    newLeadsToday: rows.filter((r) => new Date(r.created_at) >= startOfToday)
      .length,
    newLeadsThisWeek: rows.filter((r) => new Date(r.created_at) >= startOfWeek)
      .length,
    pendingFollowUps: rows.filter(
      (r) =>
        Boolean(r.next_action?.trim()) &&
        r.next_action_date &&
        new Date(r.next_action_date) < today
    ).length,
    scheduledDemos: rows.filter(
      (r) => r.demo_date != null || r.status === "Demo Scheduled"
    ).length,
    overdueLeads: rows.filter((r) => isLeadOverdue(r)).length,
  };
}

export interface ConversationHistoryItem {
  id: string;
  kind: "timeline" | "note";
  label: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
  eventType?: string;
}

export function buildConversationHistory(
  timeline: DemoRequestTimelineEvent[],
  _notes: { id: string; author_name: string; content: string; created_at: string }[]
): ConversationHistoryItem[] {
  return timeline
    .map((event) => ({
      id: `tl-${event.id}`,
      kind: "timeline" as const,
      label: event.label,
      detail: event.detail,
      actorName: event.actor_name,
      createdAt: event.created_at,
      eventType: event.event_type,
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function formatTimelineDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}
