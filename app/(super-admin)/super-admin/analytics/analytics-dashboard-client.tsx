'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import type {
  AnalyticsPreset,
  MonthlyTrendRow,
  SuperAdminAnalyticsPayload,
  TopSchoolRow,
} from "@/lib/analytics-types";
import { DEFAULT_SCHOOL_CURRENCY, formatCurrency } from "@/lib/currency";

const PIE_ACTIVE = "#10b981";
const PIE_SUSPENDED = "#f97316";
const CHART_SCHOOLS = "#6366f1";
const CHART_STUDENTS = "#0ea5e9";
const CHART_REVENUE = "#a855f7";
const DIST_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#94a3b8"];

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

type ChartView = "overview" | "revenueBySchool" | "studentDistribution" | "growthArea";

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

function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
    </div>
  );
}

function ChartSkeleton({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>
      <div
        className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80"
        aria-hidden
      />
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton title="School status" subtitle="…" />
        <ChartSkeleton title="Trends" subtitle="…" />
      </div>
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, DEFAULT_SCHOOL_CURRENCY)}
        </p>
      ))}
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function TopSchoolsTable({
  title,
  rows,
  emphasize,
  subtitle,
}: {
  title: string;
  rows: TopSchoolRow[];
  emphasize: "students" | "revenue";
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        {subtitle ?? "Top 5 across the platform"}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="py-2 pr-3">School</th>
              <th className="py-2 pr-3">Students</th>
              <th className="py-2">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-zinc-500">
                  No data yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.schoolId}>
                  <td className="max-w-[12rem] truncate py-2 pr-3 font-medium text-slate-900 dark:text-white">
                    <Link
                      href={`/super-admin/schools/${row.schoolId}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td
                    className={`py-2 pr-3 tabular-nums text-slate-700 dark:text-zinc-300 ${
                      emphasize === "students"
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : ""
                    }`}
                  >
                    {row.studentCount}
                  </td>
                  <td
                    className={`py-2 tabular-nums text-slate-700 dark:text-zinc-300 ${
                      emphasize === "revenue"
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : ""
                    }`}
                  >
                    {formatCurrency(row.totalRevenue, DEFAULT_SCHOOL_CURRENCY)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function growthLabel(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

export function AnalyticsDashboardClient() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
      const body = (await res.json()) as SuperAdminAnalyticsPayload & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Failed to load analytics.");
      }
      setData(body as SuperAdminAnalyticsPayload);
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
    setExporting(true);
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
      const filename = nameMatch?.[1] ?? `analytics.${format === "pdf" ? "pdf" : "csv"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
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
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Something went wrong."}</p>
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

  const { summary, monthlyTrends, topSchoolsByStudents, topSchoolsByRevenue } = data;
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Platform metrics and trends for the selected period.
          </p>
        </div>
        <Link
          href="/super-admin"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Dashboard
        </Link>
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
          <button
            type="button"
            disabled={exporting}
            onClick={() => void runExport("csv")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
          >
            {exporting ? "…" : "Export CSV"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void runExport("pdf")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
          >
            Export PDF
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Period: {rangeLabel} · Buckets: {data.meta.bucketGranularity}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            New schools
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {summary.totalSchools}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            vs prior: {growthLabel(summary.growthPercent.schools)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            New students
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {summary.totalStudents}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            vs prior: {growthLabel(summary.growthPercent.students)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Revenue (range)
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(summary.totalRevenue, DEFAULT_SCHOOL_CURRENCY)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            vs prior: {growthLabel(summary.growthPercent.revenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Active schools
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.activeSchools}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            {summary.suspendedSchools} suspended · {summary.totalSchoolsPlatform} total schools ·{" "}
            {summary.totalStudentsPlatform} students (platform)
          </p>
        </div>
      </div>

      {chartView === "overview" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">School status</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Active vs suspended (platform)</p>
              <div className="mt-4 h-64">
                {statusTotal > 0 ? (
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
                          const v = typeof row?.value === "number" ? row.value : 0;
                          const n = typeof row?.name === "string" ? row.name : "";
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                              <p className="font-medium text-slate-900 dark:text-white">{n}</p>
                              <p className="tabular-nums text-slate-600 dark:text-zinc-300">{v} schools</p>
                            </div>
                          );
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={28}
                        formatter={(value: string) => (
                          <span className="text-xs text-slate-600 dark:text-zinc-400">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-zinc-500">
                    No schools yet
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">New schools</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">In selected period</p>
              <div className="mt-4 h-64">
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
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} width={36} />
                    <Tooltip content={<CountTooltip />} />
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
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">New students</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">In selected period</p>
              <div className="mt-4 h-64 w-full min-w-0">
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
                    <Tooltip content={<CountTooltip />} />
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
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Completed payments in period</p>
              <div className="mt-4 h-64 w-full min-w-0">
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
                    <Tooltip content={<RevenueTooltip />} />
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
            </div>
          </div>
        </>
      ) : null}

      {chartView === "revenueBySchool" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top 10 schools by revenue</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">In selected date range</p>
          <div className="mt-4 h-80 w-full min-w-0">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={formatAxisShort} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0]?.value;
                      const n = typeof v === "number" ? v : Number(v);
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                          {formatCurrency(Number.isFinite(n) ? n : 0, DEFAULT_SCHOOL_CURRENCY)}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="revenue" fill={CHART_REVENUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No revenue in this range.</p>
            )}
          </div>
        </div>
      ) : null}

      {chartView === "studentDistribution" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Student distribution</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Top 5 schools + Other (platform-wide)</p>
          <div className="mt-4 h-80">
            {distData.length > 0 ? (
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
                      <Cell key={e.name} fill={e.fill ?? DIST_COLORS[i % DIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No students yet.</p>
            )}
          </div>
        </div>
      ) : null}

      {chartView === "growthArea" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Cumulative new schools</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Running total in selected period</p>
          <div className="mt-4 h-80 w-full min-w-0">
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
                <Tooltip content={<CountTooltip />} />
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
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <TopSchoolsTable
          title="Top schools by students"
          subtitle="Platform-wide totals"
          rows={topSchoolsByStudents}
          emphasize="students"
        />
        <TopSchoolsTable
          title="Top schools by revenue"
          subtitle="Platform-wide totals"
          rows={topSchoolsByRevenue}
          emphasize="revenue"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email reports</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Schedule weekly or monthly summary emails. Set{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-zinc-800">CRON_SECRET</code> and call{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-zinc-800">GET /api/super-admin/reports/cron</code>{" "}
          from Vercel Cron (daily).
        </p>
        {prefsLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading preferences…</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) => setPrefs((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Enable scheduled summaries
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={prefs.export_to_email_enabled}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, export_to_email_enabled: e.target.checked }))
                }
              />
              Flag: scheduled export to email (future automation)
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Frequency
              <select
                value={prefs.frequency ?? "weekly"}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    frequency: e.target.value as "weekly" | "monthly",
                  }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Day of week (1=Mon … 7=Sun)
              <input
                type="number"
                min={1}
                max={7}
                value={prefs.day_of_week ?? 1}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, day_of_week: Number(e.target.value) }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 md:col-span-2">
              Day of month (monthly)
              <input
                type="number"
                min={1}
                max={31}
                value={prefs.day_of_month ?? 1}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, day_of_month: Number(e.target.value) }))
                }
                className="mt-1 block w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="md:col-span-2">
              <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">Extra recipients</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {prefs.recipients.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                  >
                    {r}
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() =>
                        setPrefs((p) => ({
                          ...p,
                          recipients: p.recipients.filter((x) => x !== r),
                        }))
                      }
                      aria-label={`Remove ${r}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="email@example.com"
                  className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="button"
                disabled={prefsSaving}
                onClick={() => void savePrefs()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {prefsSaving ? "Saving…" : "Save schedule"}
              </button>
              <button
                type="button"
                disabled={sendBusy}
                onClick={() => void sendSummaryNow()}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              >
                {sendBusy ? "Sending…" : "Send summary now"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Note on revenue</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
          Schools may use different currencies. Sums are raw amounts; use as directional unless you normalize.
        </p>
      </div>
    </div>
  );
}
