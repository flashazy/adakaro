import { computeConversionDays } from "@/lib/demo-requests/sales-execution";
import { computeAnnualRevenueTzs } from "@/lib/demo-requests/sales-intelligence";
import type { DemoRequestRow } from "@/lib/demo-requests/types";

export interface TimelineEventLite {
  event_type: string;
  created_at: string;
}

export interface DailyActivityMetrics {
  callsMade: number;
  emailsSent: number;
  whatsAppMessages: number;
  demosScheduled: number;
  demosCompleted: number;
  newLeads: number;
  wonDeals: number;
  revenueOpportunityAdded: number;
}

export interface DailyActivityPeriods {
  today: DailyActivityMetrics;
  thisWeek: DailyActivityMetrics;
  thisMonth: DailyActivityMetrics;
}

export interface ConversionAnalytics {
  leadToContacted: number;
  contactedToDemo: number;
  demoToWon: number;
  overallConversion: number;
  averageDaysToClose: number;
  revenuePipelineValue: number;
  potentialAnnualRevenue: number;
  leadToContactedTrend: number;
  overallConversionTrend: number;
  topWonReasons: Array<{ reason: string; count: number }>;
  topLostReasons: Array<{ reason: string; count: number }>;
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isOnOrAfter(iso: string, boundary: Date): boolean {
  return new Date(iso).getTime() >= boundary.getTime();
}

function emptyMetrics(): DailyActivityMetrics {
  return {
    callsMade: 0,
    emailsSent: 0,
    whatsAppMessages: 0,
    demosScheduled: 0,
    demosCompleted: 0,
    newLeads: 0,
    wonDeals: 0,
    revenueOpportunityAdded: 0,
  };
}

function countEventType(eventType: string, label: string): keyof DailyActivityMetrics | null {
  const key = `${eventType} ${label}`.toLowerCase();
  if (key.includes("call")) return "callsMade";
  if (key.includes("email")) return "emailsSent";
  if (key.includes("whatsapp")) return "whatsAppMessages";
  if (key.includes("demo scheduled")) return "demosScheduled";
  if (key.includes("demo completed") || key.includes("demo completed")) return "demosCompleted";
  if (eventType === "demo_scheduled") return "demosScheduled";
  return null;
}

function computePeriodMetrics(
  rows: DemoRequestRow[],
  events: TimelineEventLite[],
  since: Date
): DailyActivityMetrics {
  const m = emptyMetrics();

  for (const row of rows) {
    if (isOnOrAfter(row.created_at, since)) {
      m.newLeads += 1;
      m.revenueOpportunityAdded += computeAnnualRevenueTzs(row.student_count);
    }
    if (row.status === "Won" && isOnOrAfter(row.updated_at, since)) {
      m.wonDeals += 1;
    }
  }

  for (const event of events) {
    if (!isOnOrAfter(event.created_at, since)) continue;
    const field = countEventType(event.event_type, event.event_type);
    if (field) m[field] += 1;
    if (event.event_type.includes("call")) m.callsMade += 1;
    else if (event.event_type.includes("email")) m.emailsSent += 1;
    else if (event.event_type.includes("whatsapp")) m.whatsAppMessages += 1;
    else if (event.event_type === "demo_scheduled") m.demosScheduled += 1;
    else if (event.event_type === "status_changed") {
      // counted via row status transitions approximated by won events
    }
  }

  for (const row of rows) {
    if (row.status === "Demo Completed" && isOnOrAfter(row.updated_at, since)) {
      m.demosCompleted += 1;
    }
  }

  return m;
}

export function computeDailyActivity(
  rows: DemoRequestRow[],
  events: TimelineEventLite[]
): DailyActivityPeriods {
  return {
    today: computePeriodMetrics(rows, events, startOfDay()),
    thisWeek: computePeriodMetrics(rows, events, startOfWeek()),
    thisMonth: computePeriodMetrics(rows, events, startOfMonth()),
  };
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function reasonCounts(
  rows: DemoRequestRow[],
  field: "won_reason" | "lost_reason"
): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const reason = row[field];
    if (!reason) continue;
    map.set(reason, (map.get(reason) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function computeConversionAnalytics(
  rows: DemoRequestRow[]
): ConversionAnalytics {
  const total = rows.length;
  const contacted = rows.filter((r) =>
    ["Contacted", "Demo Scheduled", "Demo Completed", "Won"].includes(r.status)
  ).length;
  const demoStage = rows.filter((r) =>
    ["Demo Scheduled", "Demo Completed", "Won"].includes(r.status)
  ).length;
  const won = rows.filter((r) => r.status === "Won").length;

  const wonRows = rows.filter((r) => r.status === "Won");
  const closeDays =
    wonRows.length > 0
      ? Math.round(
          wonRows.reduce(
            (sum, r) => sum + computeConversionDays(r.created_at, r.updated_at),
            0
          ) / wonRows.length
        )
      : 0;

  const openPipeline = rows.filter(
    (r) => r.status !== "Won" && r.status !== "Lost"
  );
  const revenuePipelineValue = openPipeline.reduce(
    (sum, r) => sum + computeAnnualRevenueTzs(r.student_count),
    0
  );
  const potentialAnnualRevenue = rows.reduce(
    (sum, r) => sum + computeAnnualRevenueTzs(r.student_count),
    0
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = rows.filter((r) => new Date(r.created_at) >= thirtyDaysAgo);
  const prior = rows.filter((r) => new Date(r.created_at) < thirtyDaysAgo);

  const recentConversion =
    recent.length > 0
      ? pct(
          recent.filter((r) => r.status === "Won").length,
          recent.length
        )
      : 0;
  const priorConversion =
    prior.length > 0
      ? pct(prior.filter((r) => r.status === "Won").length, prior.length)
      : 0;

  const recentContacted = pct(
    recent.filter((r) =>
      ["Contacted", "Demo Scheduled", "Demo Completed", "Won"].includes(r.status)
    ).length,
    recent.length
  );
  const priorContacted = pct(
    prior.filter((r) =>
      ["Contacted", "Demo Scheduled", "Demo Completed", "Won"].includes(r.status)
    ).length,
    prior.length
  );

  return {
    leadToContacted: pct(contacted, total),
    contactedToDemo: pct(demoStage, contacted || 1),
    demoToWon: pct(won, demoStage || 1),
    overallConversion: pct(won, total),
    averageDaysToClose: closeDays,
    revenuePipelineValue,
    potentialAnnualRevenue,
    leadToContactedTrend: recentContacted - priorContacted,
    overallConversionTrend: recentConversion - priorConversion,
    topWonReasons: reasonCounts(rows, "won_reason"),
    topLostReasons: reasonCounts(rows, "lost_reason"),
  };
}
