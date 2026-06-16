'use client';

import {
  SuperAdminLoadingButton,
  SuperAdminNavLink,
} from "@/components/super-admin/super-admin-loading-action";
import { formatAnalyticsCurrency } from "@/lib/analytics-format";
import {
  buildCumulativeGrowthInsight,
  buildRevenueBySchoolInsight,
  buildRevenueChartInsight,
  buildSchoolChartInsight,
  buildSchoolStatusInsight,
  buildStudentDistributionInsight,
  buildStudentPeriodInsight,
  formatAnalyticsUpdatedAt,
} from "@/lib/analytics-chart-insights";
import type {
  AnalyticsPreset,
  MonthlyTrendRow,
  SuperAdminAnalyticsPayload,
} from "@/lib/analytics-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticsEmptyState,
  AnalyticsSkeleton,
  ChartCard,
  CountTooltip,
  DataConfidenceFooter,
  EmailReportsCard,
  ExecutiveInsightsBar,
  ExecutiveSummaryCard,
  KpiCard,
  PlatformHealthCard,
  PlatformSnapshotCard,
  RevenueTooltip,
  TopSchoolsTable,
} from "./analytics-dashboard-ui";

const PIE_ACTIVE = "#10b981";
const PIE_SUSPENDED = "#f97316";
const CHART_SCHOOLS = "#6366f1";
const CHART_STUDENTS = "#0ea5e9";
const CHART_REVENUE = "#a855f7";
const DIST_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#94a3b8",
];

function utcStartOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}

function utcEndOfDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addUtcMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function parsePresetToRange(
  preset: AnalyticsPreset | string,
  customFrom?: string | null,
  customTo?: string | null
): { fromIso: string; toIso: string; preset: AnalyticsPreset | string } {
  const now = new Date();
  const end = utcEndOfDay(now);
  let start: Date;

  switch (preset) {
    case "last30d":
      start = utcStartOfDay(addUtcDays(end, -29));
      break;
    case "last3m":
      start = utcStartOfDay(addUtcMonths(end, -3));
      break;
    case "last6m":
      start = utcStartOfDay(addUtcMonths(end, -6));
      break;
    case "last12m":
      start = utcStartOfDay(addUtcMonths(end, -12));
      break;
    case "custom": {
      if (!customFrom?.trim() || !customTo?.trim()) {
        return parsePresetToRange("last12m");
      }
      const a = new Date(`${customFrom.trim()}T00:00:00.000Z`);
      const b = new Date(`${customTo.trim()}T23:59:59.999Z`);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
        return parsePresetToRange("last12m");
      }
      return {
        fromIso: a.toISOString(),
        toIso: b.toISOString(),
        preset: "custom",
      };
    }
    default:
      return parsePresetToRange("last12m");
  }

  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    preset,
  };
}

type ChartView =
  | "overview"
  | "revenueBySchool"
  | "studentDistribution"
  | "growthArea";

interface ReportPrefs {
  id: string | null;
  enabled: boolean;
  frequency: "weekly" | "monthly" | null;
  day_of_week: number | null;
  day_of_month: number | null;
  recipients: string[];
  export_to_email_enabled: boolean;
}

function formatAxisShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function hasAnalyticsData(data: SuperAdminAnalyticsPayload): boolean {
  return (
    data.summary.totalSchoolsPlatform > 0 ||
    data.summary.totalStudentsPlatform > 0 ||
    data.summary.totalRevenue > 0 ||
    data.monthlyTrends.some(
      (t) => t.newSchools > 0 || t.newStudents > 0 || t.revenue > 0
    )
  );
}

export function AnalyticsDashboardClient() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperAdminAnalyticsPayload | null>(null);

  const [preset, setPreset] = useState<AnalyticsPreset>("last12m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [chartView, setChartView] = useState<ChartView>("overview");

  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReportPrefs>({
    id: null,
    enabled: false,
    frequency: "weekly",
    day_of_week: 1,
    day_of_month: 1,
    recipients: [],
    export_to_email_enabled: false,
  });
  const [recipientInput, setRecipientInput] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const range = parsePresetToRange(
    preset,
    preset === "custom" ? customFrom : null,
    preset === "custom" ? customTo : null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("preset", preset);
      if (preset === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }

      const res = await fetch(`/api/super-admin/analytics?${params}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as SuperAdminAnalyticsPayload & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Failed to load analytics.");
      }
      setData(body as SuperAdminAnalyticsPayload);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  const loadPrefs = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await fetch("/api/super-admin/reports/preferences", {
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        preferences: ReportPrefs & { id?: string | null };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load preferences.");
      const p = body.preferences;
      setPrefs({
        id: p.id ?? null,
        enabled: p.enabled,
        frequency: p.frequency,
        day_of_week: p.day_of_week ?? 1,
        day_of_month: p.day_of_month ?? 1,
        recipients: Array.isArray(p.recipients) ? p.recipients : [],
        export_to_email_enabled: p.export_to_email_enabled,
      });
    } catch {
      /* keep defaults */
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

  useEffect(() => {
    if (!mounted) return;
    void loadPrefs();
  }, [mounted, loadPrefs]);

  async function savePrefs() {
    setPrefsSaving(true);
    try {
      const res = await fetch("/api/super-admin/reports/preferences", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: prefs.enabled,
          frequency: prefs.frequency,
          day_of_week: prefs.day_of_week,
          day_of_month: prefs.day_of_month,
          recipients: prefs.recipients,
          export_to_email_enabled: prefs.export_to_email_enabled,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Save failed.");
      await loadPrefs();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setPrefsSaving(false);
    }
  }

  async function sendSummaryNow() {
    setSendBusy(true);
    try {
      const extra = recipientInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/super-admin/reports/send-summary", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra.length ? { recipients: extra } : {}),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Send failed.");
      alert("Summary email sent.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSendBusy(false);
    }
  }

  async function runExport(format: "csv" | "pdf") {
    if (exportFormat) return;
    setExportFormat(format);
    try {
      const res = await fetch("/api/super-admin/analytics/export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          preset,
          from: preset === "custom" ? customFrom : undefined,
          to: preset === "custom" ? customTo : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Export failed.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const nameMatch = cd?.match(/filename="([^"]+)"/);
      const filename =
        nameMatch?.[1] ?? `analytics.${format === "pdf" ? "pdf" : "csv"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExportFormat(null);
    }
  }

  function addRecipient() {
    const e = recipientInput.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    setPrefs((p) => ({
      ...p,
      recipients: [...new Set([...p.recipients, e.toLowerCase()])],
    }));
    setRecipientInput("");
  }

  const trendPrevMaps = useMemo(() => {
    if (!data) {
      return {
        schools: new Map<string, number>(),
        students: new Map<string, number>(),
        revenue: new Map<string, number>(),
      };
    }
    const schools = new Map<string, number>();
    const students = new Map<string, number>();
    const revenue = new Map<string, number>();
    data.monthlyTrends.forEach((row, i) => {
      const prev = data.monthlyTrends[i - 1];
      schools.set(row.monthLabel, prev?.newSchools ?? 0);
      students.set(row.monthLabel, prev?.newStudents ?? 0);
      revenue.set(row.monthLabel, prev?.revenue ?? 0);
    });
    return { schools, students, revenue };
  }, [data]);

  if (!mounted || loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || "Something went wrong."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const showEmpty = !hasAnalyticsData(data);
  const {
    summary,
    monthlyTrends,
    topSchoolsByStudents,
    topSchoolsByRevenue,
    platformSnapshot,
    platformHealth,
    executiveInsights,
  } = data;

  const statusPie = [
    { name: "Active", value: summary.activeSchools, fill: PIE_ACTIVE },
    { name: "Suspended", value: summary.suspendedSchools, fill: PIE_SUSPENDED },
  ];
  const statusTotal = summary.activeSchools + summary.suspendedSchools;

  const schoolsChartData = monthlyTrends.map((m: MonthlyTrendRow) => ({
    label: m.monthLabel,
    newSchools: m.newSchools,
  }));
  const studentsChartData = monthlyTrends.map((m: MonthlyTrendRow) => ({
    label: m.monthLabel,
    newStudents: m.newStudents,
  }));
  const revenueChartData = monthlyTrends.map((m: MonthlyTrendRow) => ({
    label: m.monthLabel,
    revenue: m.revenue,
  }));

  const barData = data.revenueBySchoolTop10.map((r) => ({
    name: r.name.length > 18 ? `${r.name.slice(0, 18)}…` : r.name,
    revenue: r.revenue,
  }));

  const distData = data.studentDistributionPie.map((s, i) => ({
    ...s,
    fill: DIST_COLORS[i % DIST_COLORS.length],
  }));

  const growthData = data.cumulativeSchoolGrowth.map((g) => ({
    label: g.label,
    cumulative: g.cumulative,
  }));

  const rangeLabel = `${range.fromIso.slice(0, 10)} → ${range.toIso.slice(0, 10)}`;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Executive platform metrics and trends for the selected period.
          </p>
        </div>
        <SuperAdminNavLink
          href="/super-admin"
          loadingLabel="Loading…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Dashboard
        </SuperAdminNavLink>
      </div>

      <div className="sticky top-0 z-20 flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50/95 pb-4 pt-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
          Date range
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as AnalyticsPreset)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          >
            <option value="last30d">Last 30 days</option>
            <option value="last3m">Last 3 months</option>
            <option value="last6m">Last 6 months</option>
            <option value="last12m">Last 12 months</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {preset === "custom" ? (
          <>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Apply
            </button>
          </>
        ) : null}
        <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
          Chart focus
          <select
            value={chartView}
            onChange={(e) => setChartView(e.target.value as ChartView)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          >
            <option value="overview">Overview (trends)</option>
            <option value="revenueBySchool">Revenue by school (bar)</option>
            <option value="studentDistribution">Student distribution (pie)</option>
            <option value="growthArea">School growth (area)</option>
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <SuperAdminLoadingButton
            type="button"
            disabled={exportFormat != null}
            loading={exportFormat === "csv"}
            loadingLabel="Exporting…"
            onClick={() => void runExport("csv")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-80 dark:border-zinc-600 dark:text-zinc-200"
          >
            Export CSV
          </SuperAdminLoadingButton>
          <SuperAdminLoadingButton
            type="button"
            disabled={exportFormat != null}
            loading={exportFormat === "pdf"}
            loadingLabel="Exporting…"
            onClick={() => void runExport("pdf")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-80 dark:border-zinc-600 dark:text-zinc-200"
          >
            Export PDF
          </SuperAdminLoadingButton>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Period: {rangeLabel} · Buckets: {data.meta.bucketGranularity}
      </p>

      <ExecutiveSummaryCard
        payload={data}
        generatedAtIso={lastRefreshedAt}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="New schools"
          value={summary.totalSchools.toLocaleString("en-US")}
          growthPercent={summary.growthPercent.schools}
          periodDelta={summary.periodComparison.schoolsDelta}
        />
        <KpiCard
          label="New students"
          value={summary.totalStudents.toLocaleString("en-US")}
          growthPercent={summary.growthPercent.students}
          periodDelta={summary.periodComparison.studentsDelta}
        />
        <KpiCard
          label="Revenue"
          value={formatAnalyticsCurrency(summary.totalRevenue)}
          growthPercent={summary.growthPercent.revenue}
          periodDelta={summary.periodComparison.revenueDelta}
          deltaKind="currency"
        />
        <KpiCard
          label="Active schools"
          value={summary.activeSchools.toLocaleString("en-US")}
          growthPercent={summary.growthPercent.schools}
          footer={`${summary.activeRatePercent}% active · ${summary.suspendedSchools} suspended · ${summary.totalSchoolsPlatform} total schools`}
        />
        <PlatformHealthCard health={platformHealth} />
      </div>

      <ExecutiveInsightsBar insights={executiveInsights} />

      {showEmpty ? (
        <AnalyticsEmptyState />
      ) : (
        <>
          <PlatformSnapshotCard snapshot={platformSnapshot} />

          {chartView === "overview" ? (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="School status"
                  subtitle="Active vs suspended (platform)"
                  exportSlug="school-status"
                  isEmpty={statusTotal === 0}
                  emptyMessage="No schools yet"
                  insightFooter={buildSchoolStatusInsight(
                    summary.activeSchools,
                    summary.suspendedSchools
                  )}
                >
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {statusPie.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0];
                            const v =
                              typeof row?.value === "number" ? row.value : 0;
                            const n =
                              typeof row?.name === "string" ? row.name : "";
                            return (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {n}
                                </p>
                                <p className="tabular-nums text-slate-600 dark:text-zinc-300">
                                  {v} schools
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={28}
                          formatter={(value: string) => (
                            <span className="text-xs text-slate-600 dark:text-zinc-400">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard
                  title="New schools"
                  subtitle="In selected period"
                  exportSlug="new-schools-trend"
                  isEmpty={schoolsChartData.every((d) => d.newSchools === 0)}
                  insightFooter={buildSchoolChartInsight(monthlyTrends)}
                >
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={schoolsChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickLine={false}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <CountTooltip
                              active={active}
                              payload={payload}
                              label={label}
                              prevValue={
                                typeof label === "string"
                                  ? trendPrevMaps.schools.get(label)
                                  : typeof label === "number"
                                    ? undefined
                                    : undefined
                              }
                            />
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="newSchools"
                          name="New schools"
                          stroke={CHART_SCHOOLS}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-1">
                <ChartCard
                  title="New students"
                  subtitle="In selected period"
                  exportSlug="new-students-trend"
                  isEmpty={studentsChartData.every((d) => d.newStudents === 0)}
                  insightFooter={buildStudentPeriodInsight(summary.totalStudents)}
                >
                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={studentsChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickLine={false}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickFormatter={formatAxisShort}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          width={44}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <CountTooltip
                              active={active}
                              payload={payload}
                              label={label}
                              prevValue={
                                typeof label === "string"
                                  ? trendPrevMaps.students.get(label)
                                  : undefined
                              }
                            />
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="newStudents"
                          name="New students"
                          stroke={CHART_STUDENTS}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Revenue"
                  subtitle="Completed payments in period (TSh)"
                  exportSlug="revenue-trend"
                  isEmpty={revenueChartData.every((d) => d.revenue === 0)}
                  insightFooter={buildRevenueChartInsight(monthlyTrends)}
                >
                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickLine={false}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          tickFormatter={formatAxisShort}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          width={48}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <RevenueTooltip
                              active={active}
                              payload={payload}
                              label={label}
                              prevValue={
                                typeof label === "string"
                                  ? trendPrevMaps.revenue.get(label)
                                  : undefined
                              }
                            />
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke={CHART_REVENUE}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>
            </>
          ) : null}

          {chartView === "revenueBySchool" ? (
            <ChartCard
              title="Top 10 schools by revenue"
              subtitle="In selected date range (TSh)"
              exportSlug="revenue-by-school"
              isEmpty={barData.length === 0}
              emptyMessage="No revenue in this range."
              insightFooter={buildRevenueBySchoolInsight(
                data.revenueBySchoolTop10
              )}
            >
              <div className="h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={formatAxisShort} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const v = payload[0]?.value;
                        const n = typeof v === "number" ? v : Number(v);
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                            {formatAnalyticsCurrency(
                              Number.isFinite(n) ? n : 0
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="revenue" fill={CHART_REVENUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          {chartView === "studentDistribution" ? (
            <ChartCard
              title="Student distribution"
              subtitle="Top 5 schools + Other (platform-wide)"
              exportSlug="student-distribution"
              isEmpty={distData.length === 0}
              emptyMessage="No students yet."
              insightFooter={buildStudentDistributionInsight(
                data.studentDistributionPie
              )}
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {distData.map((e, i) => (
                        <Cell
                          key={e.name}
                          fill={e.fill ?? DIST_COLORS[i % DIST_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0];
                        const v =
                          typeof row?.value === "number" ? row.value : 0;
                        const n =
                          typeof row?.name === "string" ? row.name : "";
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {n}
                            </p>
                            <p className="tabular-nums text-slate-600 dark:text-zinc-300">
                              {v.toLocaleString("en-US")} students
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          {chartView === "growthArea" ? (
            <ChartCard
              title="Cumulative new schools"
              subtitle="Running total in selected period"
              exportSlug="cumulative-school-growth"
              isEmpty={growthData.every((d) => d.cumulative === 0)}
              insightFooter={buildCumulativeGrowthInsight(monthlyTrends)}
            >
              <div className="h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      angle={-35}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <CountTooltip
                          active={active}
                          payload={payload}
                          label={label}
                        />
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative schools"
                      stroke={CHART_SCHOOLS}
                      fill="#c7d2fe"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <TopSchoolsTable
              title="Top schools by students"
              subtitle="Platform-wide totals · growth vs prior period"
              rows={topSchoolsByStudents}
              emphasize="students"
              insights={executiveInsights}
            />
            <TopSchoolsTable
              title="Top schools by revenue"
              subtitle="Platform-wide totals · growth vs prior period"
              rows={topSchoolsByRevenue}
              emphasize="revenue"
              insights={executiveInsights}
            />
          </div>
        </>
      )}

      <EmailReportsCard
        prefs={prefs}
        prefsLoading={prefsLoading}
        prefsSaving={prefsSaving}
        sendBusy={sendBusy}
        recipientInput={recipientInput}
        onRecipientInputChange={setRecipientInput}
        onToggleEnabled={(enabled) =>
          setPrefs((p) => ({ ...p, enabled }))
        }
        onToggleExportFlag={(export_to_email_enabled) =>
          setPrefs((p) => ({ ...p, export_to_email_enabled }))
        }
        onFrequencyChange={(frequency) =>
          setPrefs((p) => ({ ...p, frequency }))
        }
        onDayOfWeekChange={(day_of_week) =>
          setPrefs((p) => ({ ...p, day_of_week }))
        }
        onDayOfMonthChange={(day_of_month) =>
          setPrefs((p) => ({ ...p, day_of_month }))
        }
        onRemoveRecipient={(email) =>
          setPrefs((p) => ({
            ...p,
            recipients: p.recipients.filter((x) => x !== email),
          }))
        }
        onAddRecipient={addRecipient}
        onSave={() => void savePrefs()}
        onSendNow={() => void sendSummaryNow()}
      />

      <DataConfidenceFooter
        updatedAtLabel={
          lastRefreshedAt ? formatAnalyticsUpdatedAt(lastRefreshedAt) : null
        }
        updatedAtIso={lastRefreshedAt}
      />
    </div>
  );
}
