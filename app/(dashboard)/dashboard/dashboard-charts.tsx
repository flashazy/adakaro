"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
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

/* -------------------------------------------------------------------------- */
/*                Collapsible analytics cards (persisted state)               */
/* -------------------------------------------------------------------------- */

/**
 * Section identifiers persisted in localStorage. Keep the strings stable —
 * they're the user-facing memory of which cards are folded up.
 */
type AnalyticsSectionId =
  | "paymentTrends"
  | "collectionRate"
  | "monthlyIncome";

const ANALYTICS_SECTIONS_STORAGE_KEY = "dashboard:analytics-sections";

type AnalyticsSectionsState = Partial<Record<AnalyticsSectionId, boolean>>;

function readAnalyticsSectionsState(): AnalyticsSectionsState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ANALYTICS_SECTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AnalyticsSectionsState;
    }
    return {};
  } catch {
    return {};
  }
}

function writeAnalyticsSectionsState(state: AnalyticsSectionsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ANALYTICS_SECTIONS_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    /* ignore — private mode / quota errors shouldn't break the dashboard */
  }
}

/**
 * Per-section collapsed state with localStorage persistence. Defaults to
 * collapsed so the dashboard opens compact and admins can drill in only
 * when they actually want to inspect the chart.
 */
function useCollapsedSection(
  id: AnalyticsSectionId
): [boolean, (next: boolean) => void] {
  // SSR / first paint: render collapsed so the layout matches the default UX
  // and we don't flash open charts before reading localStorage.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const persisted = readAnalyticsSectionsState();
    if (typeof persisted[id] === "boolean") {
      setCollapsed(persisted[id] === true);
    }
  }, [id]);

  const setAndPersist = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      const current = readAnalyticsSectionsState();
      current[id] = next;
      writeAnalyticsSectionsState(current);
    },
    [id]
  );

  return [collapsed, setAndPersist];
}

interface CollapsibleAnalyticsCardProps {
  id: AnalyticsSectionId;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

function CollapsibleAnalyticsCard({
  id,
  title,
  subtitle,
  className,
  children,
}: CollapsibleAnalyticsCardProps) {
  const [collapsed, setCollapsed] = useCollapsedSection(id);
  const sectionId = `analytics-section-${id}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls={sectionId}
        className="flex w-full items-start justify-between gap-3 rounded-xl px-6 py-4 text-left transition hover:bg-slate-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary dark:hover:bg-zinc-800/40"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        <span
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 dark:text-zinc-400"
          aria-hidden
        >
          {collapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </span>
      </button>
      {collapsed ? null : (
        <div id={sectionId} className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
}

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

function SkeletonHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <span
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 dark:text-zinc-500"
          aria-hidden
        >
          <ChevronDown className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SkeletonHeader
        title="Payment Trends"
        subtitle="Daily collections over the last 30 days"
        className="lg:col-span-2"
      />
      <SkeletonHeader
        title="Collection Rate"
        subtitle="Fees collected vs outstanding"
      />
      <SkeletonHeader
        title="Monthly Income"
        subtitle="Payment totals per month"
      />
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
      <CollapsibleAnalyticsCard
        id="paymentTrends"
        title="Payment Trends"
        subtitle="Daily collections over the last 30 days"
        className="lg:col-span-2"
      >
        <div className="h-64">
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
      </CollapsibleAnalyticsCard>

      {/* Pie chart — collected vs outstanding */}
      <CollapsibleAnalyticsCard
        id="collectionRate"
        title="Collection Rate"
        subtitle="Fees collected vs outstanding"
      >
        <div className="h-56">
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
      </CollapsibleAnalyticsCard>

      {/* Bar chart — monthly income */}
      <CollapsibleAnalyticsCard
        id="monthlyIncome"
        title="Monthly Income"
        subtitle="Payment totals per month"
      >
        <div className="h-56">
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
      </CollapsibleAnalyticsCard>
    </div>
  );
}
