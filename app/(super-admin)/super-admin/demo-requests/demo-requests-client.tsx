"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { showAdminErrorToast } from "@/components/dashboard/dashboard-feedback-provider";
import {
  SaKpiCard,
  saSection,
  saStatusBadge,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  DEMO_REQUEST_SCHOOL_TYPES,
  DEMO_REQUEST_STATUSES,
  formatRevenueTzs,
  isNextActionOverdue,
  computeLeadScore,
  getLeadScoreTier,
  computeLeadPriority,
  formatLastActivitySummary,
  pipelineStageBadgeClass,
  type ConversionAnalytics,
  type DailyActivityMetrics,
  type DailyActivityPeriods,
  type DemoLeadExecutiveInsights,
  type DemoLeadPipelineStats,
  type DemoRequestRow,
  type DemoRequestStats,
  type SalesPipelineStage,
} from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";
import { Eye, Megaphone, Phone, Search, TrendingDown, TrendingUp } from "lucide-react";
import { DemoRequestDetailDrawer } from "./demo-request-detail-drawer";
import {
  CallSchoolModal,
  EmailSchoolModal,
  formatContactActivityDisplay,
  type ContactModalContext,
} from "./demo-request-drawer-modals";
import {
  FollowUpAlertBadges,
  LeadPriorityBadge,
  LeadReminderBadges,
  LeadScoreBadge,
  LeadValueBadge,
  RevenueOpportunityBadge,
  ScheduledDemoBadge,
} from "./demo-request-badges";
import { DemoRequestPipelineHeader } from "./demo-request-pipeline-header";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusTone(status: DemoRequestRow["status"]): string {
  return pipelineStageBadgeClass(status);
}

const emptyInsights: DemoLeadExecutiveInsights = {
  topSchoolType: "—",
  averageStudentsPerLead: null,
  conversionRate: 0,
  largestLead: null,
  mostActiveRegion: "—",
  highestValueLead: null,
  averageResponseTimeHours: null,
  revenueOpportunityTzs: 0,
  schoolsWaitingFollowUp: 0,
  upcomingDemos: 0,
  dealsAtRisk: 0,
};

const emptyDailyActivity: DailyActivityPeriods = {
  today: emptyActivityMetrics(),
  thisWeek: emptyActivityMetrics(),
  thisMonth: emptyActivityMetrics(),
};

const emptyConversion: ConversionAnalytics = {
  leadToContacted: 0,
  contactedToDemo: 0,
  demoToWon: 0,
  overallConversion: 0,
  averageDaysToClose: 0,
  revenuePipelineValue: 0,
  potentialAnnualRevenue: 0,
  leadToContactedTrend: 0,
  overallConversionTrend: 0,
  topWonReasons: [],
  topLostReasons: [],
};

function emptyActivityMetrics(): DailyActivityMetrics {
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

type ActivityPeriod = "today" | "thisWeek" | "thisMonth";

const emptyPipeline: DemoLeadPipelineStats = {
  newLeadsToday: 0,
  newLeadsThisWeek: 0,
  pendingFollowUps: 0,
  scheduledDemos: 0,
  overdueLeads: 0,
};

export function DemoRequestsClient({
  initialRows,
  initialStats,
  initialPipelineStats = emptyPipeline,
  initialInsights = emptyInsights,
  initialDailyActivity = emptyDailyActivity,
  initialConversionAnalytics = emptyConversion,
}: {
  initialRows: DemoRequestRow[];
  initialStats: DemoRequestStats;
  initialPipelineStats?: DemoLeadPipelineStats;
  initialInsights?: DemoLeadExecutiveInsights;
  initialDailyActivity?: DailyActivityPeriods;
  initialConversionAnalytics?: ConversionAnalytics;
}) {
  const searchParams = useSearchParams();
  const leadParam = searchParams.get("lead");

  const [allRows, setAllRows] = useState(initialRows);
  const [rows, setRows] = useState(initialRows);
  const [stats, setStats] = useState(initialStats);
  const [pipelineStats, setPipelineStats] = useState(initialPipelineStats);
  const [insights, setInsights] = useState(initialInsights);
  const [dailyActivity, setDailyActivity] = useState(initialDailyActivity);
  const [conversionAnalytics, setConversionAnalytics] = useState(
    initialConversionAnalytics
  );
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("today");
  const [statusFilter, setStatusFilter] = useState("");
  const [schoolTypeFilter, setSchoolTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DemoRequestRow | null>(null);
  const [listContactModal, setListContactModal] = useState<{
    row: DemoRequestRow;
    kind: "call" | "email";
  } | null>(null);

  const hasActiveFilters = Boolean(
    statusFilter || schoolTypeFilter || search.trim()
  );
  const isTrulyEmpty = initialRows.length === 0 && !hasActiveFilters;

  useEffect(() => {
    if (!leadParam) return;
    const match = rows.find((r) => r.id === leadParam);
    if (match) setSelected(match);
  }, [leadParam, rows]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (schoolTypeFilter) params.set("schoolType", schoolTypeFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `/api/super-admin/demo-requests?${params.toString()}`,
        { credentials: "same-origin" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        rows?: DemoRequestRow[];
        allRows?: DemoRequestRow[];
        stats?: DemoRequestStats;
        pipelineStats?: DemoLeadPipelineStats;
        insights?: DemoLeadExecutiveInsights;
        dailyActivity?: DailyActivityPeriods;
        conversionAnalytics?: ConversionAnalytics;
        error?: string;
      };
      if (!res.ok) {
        showAdminErrorToast(body.error || "Could not refresh demo requests.");
        return;
      }
      setRows(body.rows ?? []);
      if (body.allRows) setAllRows(body.allRows);
      if (body.stats) setStats(body.stats);
      if (body.pipelineStats) setPipelineStats(body.pipelineStats);
      if (body.insights) setInsights(body.insights);
      if (body.dailyActivity) setDailyActivity(body.dailyActivity);
      if (body.conversionAnalytics) {
        setConversionAnalytics(body.conversionAnalytics);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, schoolTypeFilter, search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchRows();
    }, 250);
    return () => window.clearTimeout(t);
  }, [fetchRows]);

  const pipelineRows = useMemo(
    () => (allRows.length > 0 ? allRows : rows),
    [allRows, rows]
  );

  function handlePipelineStageClick(stage: SalesPipelineStage | "") {
    setStatusFilter(stage);
  }

  function handleSaved(updated: DemoRequestRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setAllRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    void fetchRows();
  }

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setAllRows((prev) => prev.filter((r) => r.id !== id));
    void fetchRows();
  }

  async function markListContact(action: "called" | "email_sent"): Promise<boolean> {
    if (!listContactModal) return false;
    try {
      const res = await fetch(
        `/api/super-admin/demo-requests/${listContactModal.row.id}/quick-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
          credentials: "same-origin",
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        row?: DemoRequestRow;
      };
      if (!res.ok || !body.row) {
        showAdminErrorToast(body.error || "Could not log contact.");
        return false;
      }
      handleSaved(body.row);
      return true;
    } catch {
      showAdminErrorToast("Could not log contact.");
      return false;
    }
  }

  function listContactContext(row: DemoRequestRow): ContactModalContext {
    const score = computeLeadScore(row);
    return {
      score,
      scoreTier: getLeadScoreTier(score),
      priority: computeLeadPriority(row.student_count, row.school_type),
      status: row.status,
      lastActivity: formatContactActivityDisplay(
        formatLastActivitySummary([], row)
      ),
    };
  }

  const activityMetrics = dailyActivity[activityPeriod];

  const kpiScrollClass =
    "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
          Sales Command Center
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Demo Requests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Convert inbound schools into paying Adakaro customers.
        </p>
      </header>

      <div className={kpiScrollClass}>
        <SaKpiCard label="Total Requests" value={stats.total} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="New" value={stats.new} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Contacted" value={stats.contacted} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Demo Scheduled" value={stats.demoScheduled} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Won" value={stats.won} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
      </div>

      <div className={cn(kpiScrollClass, "md:grid-cols-5")}>
        <SaKpiCard label="New Today" value={pipelineStats.newLeadsToday} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="New This Week" value={pipelineStats.newLeadsThisWeek} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Pending Follow Ups" value={pipelineStats.pendingFollowUps} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Scheduled Demos" value={pipelineStats.scheduledDemos} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
        <SaKpiCard label="Overdue Leads" value={pipelineStats.overdueLeads} className="min-w-[9rem] shrink-0 snap-start md:min-w-0" />
      </div>

      <section className={cn(saSection, "space-y-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Today&apos;s Activity
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Sales team output across calls, emails, and demos.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                ["today", "Today"],
                ["thisWeek", "This Week"],
                ["thisMonth", "This Month"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityPeriod(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  activityPeriod === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActivityMetricCard label="Calls Made" value={activityMetrics.callsMade} />
          <ActivityMetricCard label="Emails Sent" value={activityMetrics.emailsSent} />
          <ActivityMetricCard label="WhatsApp Messages" value={activityMetrics.whatsAppMessages} />
          <ActivityMetricCard label="Demos Scheduled" value={activityMetrics.demosScheduled} />
          <ActivityMetricCard label="Demos Completed" value={activityMetrics.demosCompleted} />
          <ActivityMetricCard label="New Leads" value={activityMetrics.newLeads} />
          <ActivityMetricCard label="Won Deals" value={activityMetrics.wonDeals} />
          <ActivityMetricCard
            label="Revenue Added"
            value={formatRevenueTzs(activityMetrics.revenueOpportunityAdded)}
            small
          />
        </div>
      </section>

      <section className={cn(saSection, "space-y-4")}>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Conversion Analytics
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Pipeline efficiency and win/loss patterns.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ConversionStatCard
            label="Lead → Contacted"
            value={`${conversionAnalytics.leadToContacted}%`}
            trend={conversionAnalytics.leadToContactedTrend}
          />
          <ConversionStatCard
            label="Contacted → Demo"
            value={`${conversionAnalytics.contactedToDemo}%`}
          />
          <ConversionStatCard
            label="Demo → Won"
            value={`${conversionAnalytics.demoToWon}%`}
          />
          <ConversionStatCard
            label="Overall Conversion"
            value={`${conversionAnalytics.overallConversion}%`}
            trend={conversionAnalytics.overallConversionTrend}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            label="Avg Days To Close"
            value={conversionAnalytics.averageDaysToClose || "—"}
          />
          <InsightCard
            label="Revenue Pipeline"
            value={formatRevenueTzs(conversionAnalytics.revenuePipelineValue)}
            small
          />
          <InsightCard
            label="Potential Annual Revenue"
            value={formatRevenueTzs(conversionAnalytics.potentialAnnualRevenue)}
            small
          />
        </div>
        {(conversionAnalytics.topWonReasons.length > 0 ||
          conversionAnalytics.topLostReasons.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {conversionAnalytics.topWonReasons.length > 0 ? (
              <ReasonAnalyticsCard
                title="Top Won Reasons"
                reasons={conversionAnalytics.topWonReasons}
                tone="green"
              />
            ) : null}
            {conversionAnalytics.topLostReasons.length > 0 ? (
              <ReasonAnalyticsCard
                title="Top Lost Reasons"
                reasons={conversionAnalytics.topLostReasons}
                tone="red"
              />
            ) : null}
          </div>
        )}
      </section>

      <section className={cn(saSection, "space-y-4")}>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Executive Insights
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <InsightCard label="Top School Type" value={insights.topSchoolType} />
            <InsightCard label="Most Active Region" value={insights.mostActiveRegion} />
            <InsightCard
              label="Highest Value Lead"
              value={
                insights.highestValueLead
                  ? `${insights.highestValueLead.schoolName} (${formatRevenueTzs(insights.highestValueLead.annualRevenueTzs)})`
                  : "—"
              }
              small
            />
            <InsightCard
              label="Avg Response Time"
              value={
                insights.averageResponseTimeHours != null
                  ? `${insights.averageResponseTimeHours}h`
                  : "—"
              }
            />
            <InsightCard label="Conversion Rate" value={`${insights.conversionRate}%`} />
            <InsightCard
              label="Revenue Opportunity"
              value={formatRevenueTzs(insights.revenueOpportunityTzs)}
              small
            />
            <InsightCard
              label="Avg Students / Lead"
              value={insights.averageStudentsPerLead ?? "—"}
            />
            <InsightCard
              label="Schools Waiting Follow-Up"
              value={insights.schoolsWaitingFollowUp}
            />
            <InsightCard label="Upcoming Demos" value={insights.upcomingDemos} />
            <InsightCard label="Deals at Risk" value={insights.dealsAtRisk} />
            <InsightCard
              label="Largest Lead"
              value={
                insights.largestLead
                  ? `${insights.largestLead.schoolName} (${insights.largestLead.studentCount})`
                  : "—"
              }
              small
            />
          </div>
        </div>
      </section>

      <section className={saSection}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Sales Pipeline</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Click a stage to filter leads instantly.
          </p>
          <div className="mt-3">
            <DemoRequestPipelineHeader
              rows={pipelineRows}
              activeStatus={statusFilter}
              onStageClick={handlePipelineStageClick}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 lg:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <Search className="h-4 w-4" aria-hidden />
            {filtersOpen ? "Hide filters" : "Show filters"}
          </button>

          <div
            className={cn(
              "grid flex-1 gap-3 sm:grid-cols-3",
              !filtersOpen && "hidden lg:grid"
            )}
          >
            <div>
              <label htmlFor="demo-filter-status" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                id="demo-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {DEMO_REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="demo-filter-type" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                School Type
              </label>
              <select
                id="demo-filter-type"
                value={schoolTypeFilter}
                onChange={(e) => setSchoolTypeFilter(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {DEMO_REQUEST_SCHOOL_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="demo-filter-search" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Search
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="demo-filter-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="School, name, phone, email…"
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
          </div>
          {loading ? <p className="text-xs text-slate-500">Refreshing…</p> : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          {rows.length === 0 ? (
            isTrulyEmpty ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                  <Megaphone className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-5 text-lg font-semibold text-slate-900">
                  No demo requests yet
                </p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                  Launch campaigns, share Adakaro, and incoming schools will
                  appear here.
                </p>
                <Link
                  href="/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Open Contact Page
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-900">No demo requests match your filters</p>
                <p className="mt-1 text-sm text-slate-500">Try adjusting your search or filter criteria.</p>
              </div>
            )
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                  <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{row.school_name}</p>
                        <p className="text-sm text-slate-500">{row.full_name}</p>
                      </div>
                      <LeadScoreBadge row={row} showScore={false} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <LeadPriorityBadge studentCount={row.student_count} schoolType={row.school_type} />
                      <LeadValueBadge studentCount={row.student_count} />
                      <RevenueOpportunityBadge studentCount={row.student_count} compact />
                    </div>
                    <FollowUpAlertBadges row={row} className="mt-2" />
                    <LeadReminderBadges row={row} className="mt-2" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={cn(saStatusBadge, statusTone(row.status))}>{row.status}</span>
                      <ScheduledDemoBadge demoDate={row.demo_date} status={row.status} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setSelected(row)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700">
                        <Eye className="h-3.5 w-3.5" aria-hidden /> View
                      </button>
                      {row.phone ? (
                        <button
                          type="button"
                          onClick={() =>
                            setListContactModal({ row, kind: "call" })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden /> Call
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <table className="hidden min-w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-semibold">School</th>
                    <th className="py-2 pr-4 font-semibold">Score</th>
                    <th className="py-2 pr-4 font-semibold">Revenue</th>
                    <th className="py-2 pr-4 font-semibold">Priority</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Owner</th>
                    <th className="py-2 pr-4 font-semibold">Alerts</th>
                    <th className="py-2 pr-4 font-semibold">Next Action</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{row.school_name}</p>
                        <p className="text-xs text-slate-500">{row.full_name}</p>
                        <ScheduledDemoBadge demoDate={row.demo_date} status={row.status} className="mt-1" />
                      </td>
                      <td className="py-3 pr-4"><LeadScoreBadge row={row} /></td>
                      <td className="py-3 pr-4"><RevenueOpportunityBadge studentCount={row.student_count} compact /></td>
                      <td className="py-3 pr-4"><LeadPriorityBadge studentCount={row.student_count} schoolType={row.school_type} /></td>
                      <td className="py-3 pr-4">
                        <span className={cn(saStatusBadge, statusTone(row.status))}>{row.status}</span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-600">
                        {row.assigned_to_name ?? "Unassigned"}
                      </td>
                      <td className="py-3 pr-4">
                        <LeadReminderBadges row={row} />
                        <FollowUpAlertBadges row={row} className="mt-1" />
                      </td>
                      <td className="py-3 pr-4">
                        {row.next_action ? (
                          <span className={cn("text-sm", isNextActionOverdue(row.next_action_date) ? "font-medium text-red-600" : "text-slate-600")}>
                            {row.next_action}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-slate-600">{formatDate(row.created_at)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setSelected(row)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Eye className="h-3.5 w-3.5" aria-hidden /> View
                          </button>
                          {row.phone ? (
                            <button
                              type="button"
                              onClick={() =>
                                setListContactModal({ row, kind: "call" })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Phone className="h-3.5 w-3.5" aria-hidden /> Call
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      {selected ? (
        <DemoRequestDetailDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}

      {listContactModal?.kind === "call" ? (
        <CallSchoolModal
          lead={{
            school_name: listContactModal.row.school_name,
            full_name: listContactModal.row.full_name,
            phone: listContactModal.row.phone,
          }}
          context={listContactContext(listContactModal.row)}
          onClose={() => setListContactModal(null)}
          onMarkCalled={() => markListContact("called")}
        />
      ) : null}

      {listContactModal?.kind === "email" && listContactModal.row.email ? (
        <EmailSchoolModal
          lead={{
            school_name: listContactModal.row.school_name,
            full_name: listContactModal.row.full_name,
            email: listContactModal.row.email,
          }}
          context={listContactContext(listContactModal.row)}
          onClose={() => setListContactModal(null)}
          onMarkEmailed={() => markListContact("email_sent")}
        />
      ) : null}
    </div>
  );
}

function InsightCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 font-semibold text-slate-900", small ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}

function ActivityMetricCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="min-w-[9rem] shrink-0 snap-start rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 font-semibold text-slate-900", small ? "text-sm" : "text-xl")}>
        {value}
      </p>
    </div>
  );
}

function ConversionStatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number;
}) {
  const showTrend = trend !== undefined && trend !== 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {showTrend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trend > 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {Math.abs(trend)}%
          </span>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: value }}
        />
      </div>
    </div>
  );
}

function ReasonAnalyticsCard({
  title,
  reasons,
  tone,
}: {
  title: string;
  reasons: Array<{ reason: string; count: number }>;
  tone: "green" | "red";
}) {
  const max = reasons[0]?.count ?? 1;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2">
        {reasons.map((item) => (
          <li key={item.reason}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">{item.reason}</span>
              <span className="font-semibold tabular-nums text-slate-900">{item.count}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "green" ? "bg-emerald-500" : "bg-red-400"
                )}
                style={{ width: `${Math.round((item.count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
