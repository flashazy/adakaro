import {
  computeLeadScore,
  computeRevenueTier,
  type ConversationHistoryItem,
} from "@/lib/demo-requests/sales-intelligence";
import type {
  DemoRequestRow,
  DemoRequestTimelineEvent,
} from "@/lib/demo-requests/types";

export const LOST_REASONS = [
  "Too expensive",
  "No budget",
  "Using another system",
  "No decision maker",
  "No response",
  "Not interested",
  "Other",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export const WON_REASONS = [
  "Good fit",
  "Needed report cards",
  "Needed finance management",
  "Needed student management",
  "Recommended by another school",
  "Other",
] as const;

export type WonReason = (typeof WON_REASONS)[number];

export const LEAD_OWNER_OPTIONS = [
  { id: "", label: "Unassigned" },
  { id: "super_admin", label: "Super Admin" },
  { id: "sales_agent", label: "Sales Agent" },
] as const;

export const NOTE_TEMPLATES = [
  "Interested in demo",
  "Needs pricing details",
  "Decision maker unavailable",
  "Call back next week",
  "Demo completed",
  "Budget approved",
] as const;

export type TimelineFilter =
  | "all"
  | "calls"
  | "whatsapp"
  | "emails"
  | "meetings"
  | "notes";

export type DealHealth = "Healthy" | "At Risk" | "Cold" | "Stale";

export type CloseProbabilityTier =
  | "Cold"
  | "Possible"
  | "Likely"
  | "High Chance";

export interface AttentionFlag {
  emoji: string;
  label: string;
  detail: string;
  tone: "red" | "amber" | "green";
  priority: number;
}

export interface NextDeadline {
  label: string;
  detail: string;
  isOverdue: boolean;
  isToday: boolean;
}

export interface CloseProbability {
  percent: number;
  tier: CloseProbabilityTier;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isTomorrow(dateIso: string): boolean {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameCalendarDay(d, tomorrow);
}

function isWithinHours(dateIso: string, hours: number): boolean {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff <= hours * 60 * 60 * 1000;
}

function parseDemoDateTime(
  demoDate: string | null,
  demoTime: string | null
): Date | null {
  if (!demoDate) return null;
  const timePart = demoTime?.slice(0, 5) ?? "09:00";
  const d = new Date(`${demoDate}T${timePart}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getLastActivityIso(
  row: Pick<DemoRequestRow, "last_contact_at" | "updated_at" | "created_at">,
  timeline: DemoRequestTimelineEvent[]
): string | null {
  const candidates = [
    row.last_contact_at,
    timeline[0]?.created_at ?? null,
    row.updated_at,
    row.created_at,
  ].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}

export function computeDealHealth(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[]
): DealHealth {
  if (row.status === "Won") return "Healthy";
  if (row.status === "Lost") return "Stale";

  const last = getLastActivityIso(row, timeline);
  const days = daysSince(last) ?? daysSince(row.created_at) ?? 0;

  const hasUpcomingFollowUp = Boolean(
    row.next_action_date &&
      !isNextActionOverdue(row.next_action_date)
  );
  const hasDemoScheduled = Boolean(row.demo_date && row.status === "Demo Scheduled");

  if (hasDemoScheduled || hasUpcomingFollowUp) {
    if (days < 14) return "Healthy";
  }

  if (days >= 14) return "Stale";
  if (days >= 7) return "Cold";
  if (days >= 3) return "At Risk";
  return "Healthy";
}

function isNextActionOverdue(dateIso: string): boolean {
  const due = new Date(dateIso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function formatLastActivitySummary(
  timeline: DemoRequestTimelineEvent[],
  row: Pick<DemoRequestRow, "last_contact_at" | "created_at">
): string {
  const latest = timeline[0];
  if (!latest && !row.last_contact_at) {
    return "No activity yet";
  }

  const event = latest;
  const iso = event?.created_at ?? row.last_contact_at;
  if (!iso) return "No activity yet";

  const hours = hoursSince(iso);
  const days = daysSince(iso);

  const label = (event?.label ?? "Contact").toLowerCase();

  let verb = "Activity recorded";
  if (label.includes("call")) verb = "Called";
  else if (label.includes("whatsapp")) verb = "WhatsApp sent";
  else if (label.includes("email")) verb = "Email sent";
  else if (label.includes("demo scheduled")) verb = "Demo scheduled";
  else if (label.includes("note")) verb = "Note added";
  else if (label.includes("lead created")) verb = "Lead created";
  else if (event?.label) verb = event.label;

  if (hours !== null && hours < 1) return `${verb} just now`;
  if (hours !== null && hours < 24) {
    return `${verb} ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return `${verb} today`;
  if (days === 1) return `${verb} yesterday`;
  if (days !== null) return `${verb} ${days} days ago`;
  return verb;
}

export function computeAttentionFlags(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[],
  score: number
): AttentionFlag[] {
  if (row.status === "Won" || row.status === "Lost") return [];

  const flags: AttentionFlag[] = [];
  const lastActivity = getLastActivityIso(row, timeline);
  const inactiveDays = daysSince(lastActivity) ?? daysSince(row.created_at) ?? 0;

  if (inactiveDays >= 3) {
    flags.push({
      emoji: "🔴",
      label: "High Risk",
      detail: `No contact after ${inactiveDays} days`,
      tone: "red",
      priority: 1,
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (row.next_action_date) {
    const due = new Date(row.next_action_date);
    due.setHours(0, 0, 0, 0);
    const isToday = due.getTime() === today.getTime();
    const isOverdue = due < today;
    if (isToday || isOverdue) {
      flags.push({
        emoji: "🟡",
        label: isOverdue ? "Follow-Up Overdue" : "Follow-Up Due",
        detail: isOverdue
          ? `Was due ${row.next_action_date}`
          : "Follow-up scheduled for today",
        tone: "amber",
        priority: 2,
      });
    }
  }

  const demoAt = parseDemoDateTime(row.demo_date, row.demo_time);
  if (demoAt && isWithinHours(demoAt.toISOString(), 24)) {
    flags.push({
      emoji: "🟢",
      label: isTomorrow(row.demo_date!) ? "Demo Tomorrow" : "Demo Soon",
      detail: "Demo meeting scheduled within 24 hours",
      tone: "green",
      priority: 3,
    });
  }

  if (score > 80) {
    flags.push({
      emoji: "🟢",
      label: "Hot Opportunity",
      detail: `Lead score above 80 (${score})`,
      tone: "green",
      priority: 4,
    });
  }

  return flags.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function computeNextDeadline(
  row: Pick<
    DemoRequestRow,
    "next_action" | "next_action_date" | "demo_date" | "demo_time" | "status"
  >
): NextDeadline {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (row.next_action_date) {
    const due = new Date(row.next_action_date);
    due.setHours(0, 0, 0, 0);
    const isOverdue = due < today;
    const isToday = due.getTime() === today.getTime();
    const action = row.next_action?.toLowerCase() ?? "";

    if (action.includes("proposal")) {
      return {
        label: isOverdue
          ? "Proposal overdue"
          : isToday
            ? "Proposal due today"
            : "Proposal due",
        detail: isToday ? "Due today" : row.next_action_date,
        isOverdue,
        isToday,
      };
    }

    return {
      label: isOverdue
        ? "Follow-up overdue"
        : isToday
          ? "Follow-up due today"
          : "Follow-up due",
      detail: isToday ? "Due today" : row.next_action_date,
      isOverdue,
      isToday,
    };
  }

  if (row.demo_date) {
    const dayLabel = new Date(row.demo_date).toLocaleDateString("en-GB", {
      weekday: "long",
    });
    const timeLabel = row.demo_time?.slice(0, 5);
    return {
      label: "Demo scheduled",
      detail: timeLabel ? `Demo on ${dayLabel} ${timeLabel}` : `Demo on ${dayLabel}`,
      isOverdue: false,
      isToday: isSameCalendarDay(new Date(row.demo_date), new Date()),
    };
  }

  return {
    label: "No upcoming actions",
    detail: "Set a follow-up date or schedule a demo",
    isOverdue: false,
    isToday: false,
  };
}

export function computeCloseProbability(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[]
): CloseProbability {
  if (row.status === "Won") {
    return { percent: 100, tier: "High Chance" };
  }
  if (row.status === "Lost") {
    return { percent: 0, tier: "Cold" };
  }

  const score = computeLeadScore(row);
  let percent = Math.round(score * 0.35);

  switch (row.status) {
    case "New":
      percent += 5;
      break;
    case "Contacted":
      percent += 15;
      break;
    case "Demo Scheduled":
      percent += 28;
      break;
    case "Demo Completed":
      percent += 38;
      break;
    default:
      break;
  }

  const tier = computeRevenueTier(row.student_count);
  if (tier === "Enterprise School") percent += 12;
  else if (tier === "Professional School") percent += 8;
  else if (tier === "Growing School") percent += 4;

  const last = getLastActivityIso(row, timeline);
  const days = daysSince(last);
  if (days !== null && days <= 7) percent += 12;
  else if (days !== null && days <= 14) percent += 6;

  percent = Math.min(100, Math.max(0, percent));

  let closeTier: CloseProbabilityTier = "Cold";
  if (percent >= 81) closeTier = "High Chance";
  else if (percent >= 61) closeTier = "Likely";
  else if (percent >= 31) closeTier = "Possible";

  return { percent, tier: closeTier };
}

export function generateExecutiveSummary(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[],
  score: number,
  closeProb: CloseProbability,
  dealHealth: DealHealth
): string {
  const tier = computeRevenueTier(row.student_count);
  const size =
    row.student_count != null
      ? `${row.student_count.toLocaleString()}-student`
      : "prospect";

  if (row.status === "Won") {
    return `${row.school_name} converted — ${tier.toLowerCase()} now an Adakaro customer.`;
  }
  if (row.status === "Lost") {
    return `Lost ${size} lead${row.lost_reason ? ` (${row.lost_reason.toLowerCase()})` : ""}. Review for future nurture.`;
  }
  if (row.status === "Demo Scheduled" && closeProb.percent >= 60) {
    return `Warm lead with demo scheduled and ${closeProb.tier.toLowerCase()} conversion likelihood (${closeProb.percent}%).`;
  }
  if (dealHealth === "Stale" || dealHealth === "Cold") {
    return `Stalled ${tier.toLowerCase()} lead requiring immediate follow-up — no recent activity.`;
  }
  if (dealHealth === "At Risk") {
    return `${tier} lead at risk — follow up before the deal goes cold.`;
  }
  if (score >= 80) {
    return `Large ${tier.toLowerCase()} prospect with strong revenue potential${row.last_contact_at ? " and active engagement" : " and no contact activity yet"}.`;
  }
  if (row.status === "Demo Completed") {
    return `${tier} lead post-demo — ${closeProb.percent}% close probability; send proposal to advance.`;
  }
  if (row.status === "New") {
    return `${tier} inbound lead (${size}) — contact within 24 hours to maximize conversion.`;
  }
  return `${tier} lead at ${row.status} stage — ${dealHealth.toLowerCase()} pipeline health, ${closeProb.percent}% estimated close rate.`;
}

export function filterConversationHistory(
  items: ConversationHistoryItem[],
  filter: TimelineFilter
): ConversationHistoryItem[] {
  if (filter === "all") return items;

  return items.filter((item) => {
    const key = `${item.eventType ?? ""} ${item.label}`.toLowerCase();
    switch (filter) {
      case "calls":
        return key.includes("call");
      case "whatsapp":
        return key.includes("whatsapp");
      case "emails":
        return key.includes("email");
      case "meetings":
        return (
          key.includes("demo") ||
          key.includes("meeting") ||
          key.includes("scheduled") ||
          key.includes("google meet") ||
          key.includes("zoom") ||
          key.includes("invitation")
        );
      case "notes":
        return key.includes("note");
      default:
        return true;
    }
  });
}

export function computeConversionDays(
  createdAt: string,
  wonAt?: string | null
): number {
  const start = new Date(createdAt);
  const end = wonAt ? new Date(wonAt) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function dealHealthTone(health: DealHealth): string {
  switch (health) {
    case "Healthy":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "At Risk":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "Cold":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    default:
      return "bg-red-50 text-red-800 ring-red-200";
  }
}

export function closeProbabilityTone(tier: CloseProbabilityTier): string {
  switch (tier) {
    case "High Chance":
      return "text-emerald-700";
    case "Likely":
      return "text-indigo-700";
    case "Possible":
      return "text-amber-700";
    default:
      return "text-slate-500";
  }
}
