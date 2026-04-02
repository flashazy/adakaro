"use client";

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
} from "recharts";
import type {
  MonthlyTrendRow,
  SuperAdminAnalyticsPayload,
  TopSchoolRow,
} from "@/lib/analytics";
import { DEFAULT_SCHOOL_CURRENCY, formatCurrency } from "@/lib/currency";

const PIE_ACTIVE = "#10b981";
const PIE_SUSPENDED = "#f97316";
const CHART_SCHOOLS = "#6366f1";
const CHART_STUDENTS = "#0ea5e9";
const CHART_REVENUE = "#a855f7";

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
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
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
        <ChartSkeleton
          title="School status"
          subtitle="Active vs suspended"
        />
        <ChartSkeleton
          title="New schools per month"
          subtitle="Last 12 months"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-1">
        <ChartSkeleton
          title="New students per month"
          subtitle="Last 12 months"
        />
        <ChartSkeleton
          title="Revenue per month"
          subtitle="Completed payments — last 12 months"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Top schools by students
          </h3>
          <div className="mt-4 h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Top schools by revenue
          </h3>
          <div className="mt-4 h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80" />
        </div>
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
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
          {label}
        </p>
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
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
          {label}
        </p>
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
}: {
  title: string;
  rows: TopSchoolRow[];
  emphasize: "students" | "revenue";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        Top 5 across the platform
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
                <td
                  colSpan={3}
                  className="py-6 text-center text-slate-500 dark:text-zinc-500"
                >
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
                      emphasize === "students" ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""
                    }`}
                  >
                    {row.studentCount}
                  </td>
                  <td
                    className={`py-2 tabular-nums text-slate-700 dark:text-zinc-300 ${
                      emphasize === "revenue" ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""
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

export function AnalyticsDashboardClient() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperAdminAnalyticsPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/analytics", {
        credentials: "same-origin",
      });
      const body = (await res.json()) as SuperAdminAnalyticsPayload & {
        error?: string;
      };
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
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

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

  const { summary, monthlyTrends, topSchoolsByStudents, topSchoolsByRevenue } =
    data;

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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Platform growth, school health, and revenue trends (last 12 months
            for charts).
          </p>
        </div>
        <Link
          href="/super-admin"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Total schools
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {summary.totalSchools}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Total students
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {summary.totalStudents}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Total revenue
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(summary.totalRevenue, DEFAULT_SCHOOL_CURRENCY)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Sum of completed payment amounts
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
            {summary.suspendedSchools} suspended
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            School status
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Active vs suspended
          </p>
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
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-zinc-500">
                No schools yet
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            New schools per month
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Last 12 months
          </p>
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
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CountTooltip />} />
                <Line
                  type="monotone"
                  dataKey="newSchools"
                  name="New schools"
                  stroke={CHART_SCHOOLS}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            New students per month
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Last 12 months
          </p>
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
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Revenue per month
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Completed payments — last 12 months
          </p>
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
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopSchoolsTable
          title="Top schools by students"
          rows={topSchoolsByStudents}
          emphasize="students"
        />
        <TopSchoolsTable
          title="Top schools by revenue"
          rows={topSchoolsByRevenue}
          emphasize="revenue"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Note on revenue</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
          Schools may use different currencies. Totals and monthly revenue sum raw
          amounts; use figures as directional unless you normalize by currency.
        </p>
      </div>
    </div>
  );
}
