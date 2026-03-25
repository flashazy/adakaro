"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";
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
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface DailyPoint {
  date: string;
  amount: number;
}

interface MonthlyPoint {
  month: string;
  amount: number;
}

interface Props {
  dailyPayments: DailyPoint[];
  monthlyIncome: MonthlyPoint[];
  feesCollected: number;
  outstandingBalance: number;
  currencyCode: string;
}

function formatAxisShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PIE_COLORS = ["#10b981", "#f59e0b"];

function CustomTooltip({
  active,
  payload,
  label,
  currencyCode,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
  currencyCode: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name ? `${entry.name}: ` : ""}
          {formatCurrency(entry.value, currencyCode)}
        </p>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Payment Trends
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Daily collections over the last 30 days
        </p>
        <div
          className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80"
          aria-hidden
        />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Collection Rate
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Fees collected vs outstanding
        </p>
        <div
          className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80"
          aria-hidden
        />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Monthly Income
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Payment totals per month
        </p>
        <div
          className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function DashboardCharts({
  dailyPayments,
  monthlyIncome,
  feesCollected,
  outstandingBalance,
  currencyCode,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ChartsSkeleton />;
  }

  const pieData = [
    { name: "Collected", value: feesCollected },
    { name: "Outstanding", value: Math.max(0, outstandingBalance) },
  ];

  const totalFees = feesCollected + Math.max(0, outstandingBalance);
  const collectedPct = totalFees > 0 ? Math.round((feesCollected / totalFees) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Payment trends — last 30 days */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Payment Trends
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Daily collections over the last 30 days
        </p>
        <div className="mt-4 h-64">
          {dailyPayments.some((d) => d.amount > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPayments}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatAxisShort}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  content={<CustomTooltip currencyCode={currencyCode} />}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Collected"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                No payment data for the last 30 days
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pie chart — collected vs outstanding */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Collection Rate
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Fees collected vs outstanding
        </p>
        <div className="mt-4 h-56">
          {totalFees > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip currencyCode={currencyCode} />}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(value: string) => (
                    <span className="text-xs text-slate-600 dark:text-zinc-400">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                No fee data available
              </p>
            </div>
          )}
        </div>
        {totalFees > 0 && (
          <div className="mt-2 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {collectedPct}%
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              collection rate
            </p>
          </div>
        )}
      </div>

      {/* Bar chart — monthly income */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Monthly Income
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Payment totals per month
        </p>
        <div className="mt-4 h-56">
          {monthlyIncome.some((m) => m.amount > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyIncome}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tickFormatter={formatAxisShort}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  content={<CustomTooltip currencyCode={currencyCode} />}
                />
                <Bar
                  dataKey="amount"
                  name="Income"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                No payment data available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
