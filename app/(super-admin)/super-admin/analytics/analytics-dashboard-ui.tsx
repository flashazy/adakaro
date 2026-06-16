"use client";

import {
  SuperAdminLoadingButton,
  SuperAdminNavLink,
} from "@/components/super-admin/super-admin-loading-action";
import {
  buildExecutiveSummaryView,
  formatAnalyticsCurrency,
  formatExecutiveLastUpdated,
  formatGrowthPercent,
  formatPeriodDelta,
  platformHealthBadgeClass,
  trendDirection,
  type ExecutiveSummaryBadge,
  type ExecutiveSummaryLine,
} from "@/lib/analytics-format";
import type {
  ExecutiveInsights,
  GrowthPercent,
  PeriodComparison,
  PlatformHealth,
  PlatformSnapshot,
  SuperAdminAnalyticsPayload,
  TopSchoolRow,
} from "@/lib/analytics-types";
import { enterSuperAdminSchoolWorkspace } from "@/lib/super-admin/open-school-workspace.client";
import { Rocket, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

export function TrendArrow({
  direction,
}: {
  direction: "up" | "down" | "flat" | "unknown";
}) {
  if (direction === "up") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
        ▲
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="text-red-600 dark:text-red-400" aria-hidden>
        ▼
      </span>
    );
  }
  if (direction === "flat") {
    return (
      <span className="text-slate-400 dark:text-zinc-500" aria-hidden>
        —
      </span>
    );
  }
  return null;
}

function trendTextClass(direction: ReturnType<typeof trendDirection>): string {
  if (direction === "up") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "down") return "text-red-700 dark:text-red-400";
  return "text-slate-500 dark:text-zinc-400";
}

function executiveBadgeClass(
  kind: ExecutiveSummaryBadge["kind"],
  primary = false
): string {
  if (primary) {
    return "bg-emerald-100 text-emerald-900 ring-emerald-300/80 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-700/60";
  }

  switch (kind) {
    case "growth":
      return "border border-indigo-100/70 bg-indigo-50/50 text-indigo-700/85 ring-0 dark:border-indigo-900/40 dark:bg-indigo-950/25 dark:text-indigo-300/80";
    case "health":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/50";
    case "schools":
      return "border border-violet-100/70 bg-violet-50/50 text-violet-700/85 ring-0 dark:border-violet-900/40 dark:bg-violet-950/25 dark:text-violet-300/80";
    case "students":
      return "border border-sky-100/70 bg-sky-50/50 text-sky-700/85 ring-0 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-300/80";
  }
}

function InsightLineIcon({ icon }: { icon: ExecutiveSummaryLine["icon"] }) {
  const className = "h-4 w-4 text-indigo-500/75 dark:text-indigo-400/80";
  switch (icon) {
    case "rocket":
      return <Rocket className={className} strokeWidth={2} aria-hidden />;
    case "trending-up":
      return <TrendingUp className={className} strokeWidth={2} aria-hidden />;
    case "trending-down":
      return <TrendingDown className={className} strokeWidth={2} aria-hidden />;
    case "shield":
      return <ShieldCheck className={className} strokeWidth={2} aria-hidden />;
  }
}

function EmphasizedInsightText({ text }: { text: string }) {
  const parts = text.split(/(\d[\d,]*(?:\.\d+)?%?)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\d[\d,]*(?:\.\d+)?%?$/.test(part) ? (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-slate-900 dark:text-white"
          >
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

export function ExecutiveSummaryCard({
  payload,
  generatedAtIso,
}: {
  payload: SuperAdminAnalyticsPayload;
  generatedAtIso?: string | null;
}) {
  const view = useMemo(() => buildExecutiveSummaryView(payload), [payload]);
  const lastUpdated = generatedAtIso
    ? formatExecutiveLastUpdated(generatedAtIso)
    : null;

  const sortedBadges = useMemo(
    () =>
      [...view.badges].sort((a, b) => {
        if (a.kind === "health") return -1;
        if (b.kind === "health") return 1;
        return 0;
      }),
    [view.badges]
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-indigo-100/50 transition-[box-shadow,border-color] duration-200 hover:border-indigo-300/80 hover:shadow-[0_4px_18px_rgba(79,70,229,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-indigo-900/40 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-violet-950/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:ring-indigo-500/10 dark:hover:border-indigo-700/50 dark:hover:shadow-[0_4px_18px_rgba(99,102,241,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.08),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500/20 dark:bg-indigo-500"
              aria-hidden
            >
              <Sparkles className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Executive Summary
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                AI-generated overview of platform performance
              </p>
            </div>
          </div>

          <div className="mt-6 border-l-2 border-indigo-200/70 pl-4 dark:border-indigo-700/40 sm:pl-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/90 dark:text-zinc-500/90">
              Key Insights
            </p>

            <ul className="mt-4 space-y-4">
              {view.lines.map((line) => (
                <li
                  key={line.text}
                  className="flex gap-3 text-base leading-relaxed text-slate-700 dark:text-zinc-200 sm:text-[1.05rem]"
                >
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100/80 dark:bg-indigo-950/40 dark:ring-indigo-800/40">
                    <InsightLineIcon icon={line.icon} />
                  </span>
                  <span className="pt-0.5">
                    <EmphasizedInsightText text={line.text} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[14rem] lg:justify-end lg:pt-1">
          {sortedBadges.map((badge) => {
            const isPrimary = badge.kind === "health";
            return (
              <span
                key={badge.label}
                className={`inline-flex items-center rounded-full ${executiveBadgeClass(badge.kind, isPrimary)} ${
                  isPrimary
                    ? "gap-1.5 px-3 py-1.5 text-sm font-semibold ring-1 ring-inset"
                    : "px-2.5 py-1 text-[11px] font-medium ring-0"
                }`}
              >
                {isPrimary ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] dark:bg-emerald-400"
                    aria-hidden
                  />
                ) : null}
                {badge.label}
              </span>
            );
          })}
        </div>
      </div>

      {lastUpdated ? (
        <div className="relative mt-8 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/85 dark:text-zinc-400/90">
            Last Updated
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
            <time dateTime={generatedAtIso ?? undefined}>
              {lastUpdated.date}
              {lastUpdated.time ? ` • ${lastUpdated.time}` : ""}
            </time>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ExecutiveFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-14 z-40 -mx-4 border-b border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800/90 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  growthPercent,
  periodDelta,
  deltaKind = "count",
  footer,
  emphasis = "secondary",
}: {
  label: string;
  value: string;
  growthPercent?: number | null;
  periodDelta?: number;
  deltaKind?: "count" | "currency" | "percent";
  footer?: string;
  emphasis?: "primary" | "secondary";
}) {
  const direction = trendDirection(growthPercent ?? null);
  const deltaDirection =
    periodDelta === undefined
      ? "unknown"
      : periodDelta > 0
        ? "up"
        : periodDelta < 0
          ? "down"
          : "flat";

  const isPrimary = emphasis === "primary";

  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-900 ${
        isPrimary
          ? "border-indigo-200/90 ring-1 ring-indigo-100/80 dark:border-indigo-800/60 dark:ring-indigo-900/40"
          : "border-slate-200 dark:border-zinc-800"
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          isPrimary
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-slate-500 dark:text-zinc-400"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-bold tabular-nums text-slate-900 dark:text-white ${
          isPrimary ? "text-4xl tracking-tight" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {growthPercent !== undefined ? (
        <p
          className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${trendTextClass(direction)}`}
        >
          <TrendArrow direction={direction} />
          <span>{formatGrowthPercent(growthPercent)} vs previous period</span>
        </p>
      ) : null}
      {periodDelta !== undefined ? (
        <p
          className={`mt-1 flex items-center gap-1.5 text-xs ${trendTextClass(deltaDirection)}`}
        >
          <TrendArrow direction={deltaDirection} />
          <span>{formatPeriodDelta(periodDelta, deltaKind)}</span>
        </p>
      ) : null}
      {footer ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">{footer}</p>
      ) : null}
    </div>
  );
}

export function PlatformHealthInfoTooltip() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400"
        aria-label="How platform health is calculated"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-slate-600 shadow-lg group-hover:block group-focus-within:block dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <span className="block font-semibold text-slate-900 dark:text-white">
          Platform Health combines:
        </span>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5">
          <li>Active schools</li>
          <li>Revenue activity</li>
          <li>User growth</li>
          <li>Setup completion</li>
        </ul>
        <span className="mt-1.5 block text-slate-500 dark:text-zinc-400">
          Score updates automatically.
        </span>
      </span>
    </span>
  );
}

export function PlatformHealthCard({ health }: { health: PlatformHealth }) {
  return (
    <div className="rounded-xl border border-indigo-200/90 bg-white p-5 shadow-sm ring-1 ring-indigo-100/80 dark:border-indigo-800/60 dark:bg-zinc-900 dark:ring-indigo-900/40">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Platform Health
        </p>
        <PlatformHealthInfoTooltip />
      </div>
      <div className="mt-2">
        <p className="text-5xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {health.score}
        </p>
        <span
          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${platformHealthBadgeClass(health.status)}`}
        >
          {health.status}
        </span>
      </div>
    </div>
  );
}

function InsightChip({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
        {title}
      </p>
      <div className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white">
        {children}
      </div>
    </div>
  );
}

export function ExecutiveInsightsBar({
  insights,
}: {
  insights: ExecutiveInsights;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <InsightChip title="Fastest Growth">
        {insights.fastestGrowingSchool ? (
          <>
            {insights.fastestGrowingSchool.name}
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
              (+{insights.fastestGrowingSchool.growthPercent}%)
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-zinc-500">—</span>
        )}
      </InsightChip>
      <InsightChip title="Highest Revenue">
        {insights.highestRevenueSchool ? (
          <>
            {insights.highestRevenueSchool.name}
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">
              {formatAnalyticsCurrency(insights.highestRevenueSchool.revenue)}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-zinc-500">—</span>
        )}
      </InsightChip>
      <InsightChip title="Largest School">
        {insights.largestSchool ? (
          <>
            {insights.largestSchool.name}
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">
              {insights.largestSchool.studentCount.toLocaleString("en-US")} students
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-zinc-500">—</span>
        )}
      </InsightChip>
      <InsightChip title="Newest School">
        {insights.newestSchool ? (
          <>
            {insights.newestSchool.name}
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">
              Joined{" "}
              {insights.newestSchool.daysSinceJoined === 0
                ? "today"
                : `${insights.newestSchool.daysSinceJoined} day${insights.newestSchool.daysSinceJoined === 1 ? "" : "s"} ago`}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-zinc-500">—</span>
        )}
      </InsightChip>
      <InsightChip title="Highest Growth Rate">
        {insights.highestGrowthRateSchool ? (
          <>
            {insights.highestGrowthRateSchool.name}
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
              (+{insights.highestGrowthRateSchool.growthPercent}%)
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-zinc-500">—</span>
        )}
      </InsightChip>
    </div>
  );
}

export function PlatformSnapshotCard({
  snapshot,
}: {
  snapshot: PlatformSnapshot;
}) {
  const rows = [
    ["Schools", snapshot.schools.toLocaleString("en-US")],
    ["Students", snapshot.students.toLocaleString("en-US")],
    ["Teachers", snapshot.teachers.toLocaleString("en-US")],
    ["Parents", snapshot.parents.toLocaleString("en-US")],
    ["Admins", snapshot.admins.toLocaleString("en-US")],
    ["Revenue", formatAnalyticsCurrency(snapshot.revenue)],
  ] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        Platform Snapshot
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        Live platform totals
      </p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/60"
          >
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              {label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AnalyticsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-16 text-center dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100 text-3xl dark:bg-indigo-950/60"
        aria-hidden
      >
        📊
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        No analytics data available yet
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-zinc-400">
        Data will appear once schools begin using Adakaro.
      </p>
    </div>
  );
}

export function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
    </div>
  );
}

export function ChartSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        {subtitle}
      </p>
      <div
        className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/80"
        aria-hidden
      />
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-28 animate-pulse rounded-2xl bg-indigo-100/60 dark:bg-indigo-950/30" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 min-w-[10rem] flex-1 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton title="School status" subtitle="…" />
        <ChartSkeleton title="Trends" subtitle="…" />
      </div>
    </div>
  );
}

function GrowthCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-slate-400 dark:text-zinc-500">—</span>;
  }
  const direction = trendDirection(value);
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${trendTextClass(direction)}`}
    >
      <TrendArrow direction={direction} />
      {formatGrowthPercent(value)}
    </span>
  );
}

function SchoolWorkspaceLink({
  schoolId,
  name,
  badges,
}: {
  schoolId: string;
  name: string;
  badges?: ReactNode;
}) {
  const [opening, setOpening] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function openWorkspace() {
    if (opening) return;
    setOpening(true);
    setUnavailable(false);
    const result = await enterSuperAdminSchoolWorkspace(schoolId);
    if (!result.ok) {
      setUnavailable(true);
      setOpening(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <SuperAdminLoadingButton
        type="button"
        loading={opening}
        loadingLabel="Opening…"
        onClick={() => void openWorkspace()}
        title={
          unavailable
            ? "School workspace unavailable."
            : `Open ${name} workspace`
        }
        className="max-w-full truncate bg-transparent p-0 text-left font-medium text-indigo-600 hover:underline disabled:cursor-not-allowed dark:text-indigo-400"
      >
        {name}
      </SuperAdminLoadingButton>
      {badges}
    </div>
  );
}

function LeaderboardBadge({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "growth";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === "growth"
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
    >
      {children}
    </span>
  );
}

function schoolBadges(
  row: TopSchoolRow,
  emphasize: "students" | "revenue",
  insights?: ExecutiveInsights
): ReactNode {
  const badges: ReactNode[] = [];

  if (
    emphasize === "revenue" &&
    insights?.highestRevenueSchool?.schoolId === row.schoolId
  ) {
    badges.push(
      <LeaderboardBadge key="revenue">🏆 Highest Revenue</LeaderboardBadge>
    );
  }

  if (
    emphasize === "students" &&
    insights?.largestSchool?.schoolId === row.schoolId
  ) {
    badges.push(
      <LeaderboardBadge key="largest">🏆 Largest School</LeaderboardBadge>
    );
  }

  if (insights?.fastestGrowingSchool?.schoolId === row.schoolId) {
    badges.push(
      <LeaderboardBadge key="growth" tone="growth">
        🚀 Fastest Growth
      </LeaderboardBadge>
    );
  }

  if (!badges.length) return null;
  return <>{badges}</>;
}

export function TopSchoolsTable({
  title,
  rows,
  emphasize,
  subtitle,
  insights,
}: {
  title: string;
  rows: TopSchoolRow[];
  emphasize: "students" | "revenue";
  subtitle?: string;
  insights?: ExecutiveInsights;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        {subtitle ?? "Top 5 across the platform"}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="py-2 pr-3">Rank</th>
              <th className="py-2 pr-3">School</th>
              <th className="py-2 pr-3">Students</th>
              <th className="py-2 pr-3">Revenue</th>
              <th className="py-2">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-slate-500 dark:text-zinc-500"
                >
                  No data yet
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.schoolId}
                  className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-zinc-800/50 ${
                    index === 0
                      ? "bg-indigo-50/60 dark:bg-indigo-950/20"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-3 font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                    #{index + 1}
                  </td>
                  <td className="max-w-[14rem] py-2 pr-3 text-slate-900 dark:text-white">
                    <SchoolWorkspaceLink
                      schoolId={row.schoolId}
                      name={row.name}
                      badges={schoolBadges(row, emphasize, insights)}
                    />
                  </td>
                  <td
                    className={`py-2 pr-3 tabular-nums text-slate-700 dark:text-zinc-300 ${
                      emphasize === "students"
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : ""
                    }`}
                  >
                    {row.studentCount.toLocaleString("en-US")}
                  </td>
                  <td
                    className={`py-2 pr-3 tabular-nums text-slate-700 dark:text-zinc-300 ${
                      emphasize === "revenue"
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : ""
                    }`}
                  >
                    {formatAnalyticsCurrency(row.totalRevenue)}
                  </td>
                  <td className="py-2">
                    {emphasize === "students" ? (
                      <GrowthCell value={row.studentGrowthPercent} />
                    ) : (
                      <GrowthCell value={row.revenueGrowthPercent} />
                    )}
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

export function ChartInsightCallout({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 text-sm leading-snug text-slate-600 dark:border-zinc-700/80 dark:bg-zinc-800/40 dark:text-zinc-400">
      <span className="font-medium text-slate-700 dark:text-zinc-300">💡 Insight</span>
      <span className="ml-2">{text}</span>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  exportSlug,
  isEmpty,
  emptyMessage,
  insightFooter,
  children,
}: {
  title: string;
  subtitle: string;
  exportSlug: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  insightFooter?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);

  const exportChart = useCallback(
    async (format: "png" | "pdf") => {
      const el = containerRef.current;
      if (!el || exporting) return;
      setExporting(format);
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(el, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
        });

        if (format === "png") {
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `adakaro-${exportSlug}.png`;
          a.click();
          return;
        }

        const { jsPDF } = await import("jspdf");
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
          unit: "pt",
        });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(img, "PNG", (pageW - w) / 2, 24, w, h);
        pdf.save(`adakaro-${exportSlug}.pdf`);
      } catch {
        alert("Chart export failed. Please try again.");
      } finally {
        setExporting(null);
      }
    },
    [exportSlug, exporting]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SuperAdminLoadingButton
            type="button"
            disabled={!!exporting || isEmpty}
            loading={exporting === "png"}
            loadingLabel="Exporting…"
            onClick={() => void exportChart("png")}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            PNG
          </SuperAdminLoadingButton>
          <SuperAdminLoadingButton
            type="button"
            disabled={!!exporting || isEmpty}
            loading={exporting === "pdf"}
            loadingLabel="Exporting…"
            onClick={() => void exportChart("pdf")}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            PDF
          </SuperAdminLoadingButton>
        </div>
      </div>
      <div ref={containerRef} className="mt-4">
        {isEmpty ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
            {emptyMessage ?? "No data available for this chart."}
          </div>
        ) : (
          children
        )}
      </div>
      {insightFooter && !isEmpty ? (
        <ChartInsightCallout text={insightFooter} />
      ) : null}
    </div>
  );
}

interface EmailReportPrefs {
  enabled: boolean;
  frequency: "weekly" | "monthly" | null;
  day_of_week: number | null;
  day_of_month: number | null;
  recipients: string[];
  export_to_email_enabled: boolean;
}

export function EmailReportsCard({
  prefs,
  prefsLoading,
  prefsSaving,
  sendBusy,
  recipientInput,
  onRecipientInputChange,
  onToggleEnabled,
  onToggleExportFlag,
  onFrequencyChange,
  onDayOfWeekChange,
  onDayOfMonthChange,
  onRemoveRecipient,
  onAddRecipient,
  onSave,
  onSendNow,
}: {
  prefs: EmailReportPrefs;
  prefsLoading: boolean;
  prefsSaving: boolean;
  sendBusy: boolean;
  recipientInput: string;
  onRecipientInputChange: (value: string) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleExportFlag: (enabled: boolean) => void;
  onFrequencyChange: (frequency: "weekly" | "monthly") => void;
  onDayOfWeekChange: (day: number) => void;
  onDayOfMonthChange: (day: number) => void;
  onRemoveRecipient: (email: string) => void;
  onAddRecipient: () => void;
  onSave: () => void;
  onSendNow: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        Email Reports
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
        Schedule automatic executive reports and platform summaries for
        stakeholders.
      </p>
      {prefsLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading preferences…</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 md:col-span-2">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
            />
            Enable scheduled executive summaries
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            Frequency
            <select
              value={prefs.frequency ?? "weekly"}
              onChange={(e) =>
                onFrequencyChange(e.target.value as "weekly" | "monthly")
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Recipients
            </p>
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
                    onClick={() => onRemoveRecipient(r)}
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
                onChange={(e) => onRecipientInputChange(e.target.value)}
                placeholder="email@example.com"
                className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={onAddRecipient}
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
              onClick={onSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {prefsSaving ? "Saving…" : "Save schedule"}
            </button>
            <button
              type="button"
              disabled={sendBusy}
              onClick={onSendNow}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
            >
              {sendBusy ? "Sending…" : "Send summary now"}
            </button>
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {advancedOpen ? "Hide" : "Show"} Advanced Settings
            </button>
            {advancedOpen ? (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.export_to_email_enabled}
                    onChange={(e) => onToggleExportFlag(e.target.checked)}
                  />
                  Include scheduled export attachments (future automation)
                </label>
                <label className="block font-medium text-slate-600 dark:text-zinc-400">
                  Day of week (1 = Mon … 7 = Sun)
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={prefs.day_of_week ?? 1}
                    onChange={(e) => onDayOfWeekChange(Number(e.target.value))}
                    className="mt-1 block w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block font-medium text-slate-600 dark:text-zinc-400">
                  Day of month (monthly)
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={prefs.day_of_month ?? 1}
                    onChange={(e) => onDayOfMonthChange(Number(e.target.value))}
                    className="mt-1 block w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <p>
                  Automated delivery requires server cron configuration (
                  <code className="rounded bg-white px-1 dark:bg-zinc-900">
                    CRON_SECRET
                  </code>
                  , daily{" "}
                  <code className="rounded bg-white px-1 dark:bg-zinc-900">
                    GET /api/super-admin/reports/cron
                  </code>
                  ).
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataConfidenceFooter({
  updatedAtLabel,
  updatedAtIso,
}: {
  updatedAtLabel: string | null;
  updatedAtIso?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <h2 className="font-semibold text-slate-900 dark:text-white">
        Data Confidence
      </h2>
      <ul className="mt-3 space-y-1.5 text-slate-600 dark:text-zinc-400">
        <li>✓ Revenue calculated from recorded fee payments</li>
        <li>✓ Student counts updated in real time</li>
        <li>✓ School statistics generated automatically</li>
      </ul>
      {updatedAtLabel ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
          Last updated:{" "}
          {updatedAtIso ? (
            <time dateTime={updatedAtIso} className="tabular-nums">
              {updatedAtLabel}
            </time>
          ) : (
            <span className="tabular-nums">{updatedAtLabel}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}

type TooltipRow = {
  value?: string | number | readonly (string | number)[];
  name?: string;
  color?: string;
};

function normalizeTooltipPayload(payload: unknown): TooltipRow[] {
  if (!Array.isArray(payload)) return [];
  return payload as TooltipRow[];
}

function tooltipValue(value: TooltipRow["value"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (Array.isArray(value) && value.length > 0) {
    return Number(value[0]) || 0;
  }
  return 0;
}

export function RevenueTooltip({
  active,
  payload,
  label,
  prevValue,
}: {
  active?: boolean;
  payload?: unknown;
  label?: string | number;
  prevValue?: number;
}) {
  const rows = normalizeTooltipPayload(payload);
  if (!active || !rows.length) return null;
  const current = tooltipValue(rows[0]?.value);
  const popChange =
    prevValue !== undefined && prevValue > 0
      ? Math.round(((current - prevValue) / prevValue) * 1000) / 10
      : null;
  const labelText =
    label !== undefined && label !== null ? String(label) : undefined;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {labelText ? (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
          {labelText}
        </p>
      ) : null}
      {rows.map((entry, i) => (
        <p key={i} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatAnalyticsCurrency(tooltipValue(entry.value))}
        </p>
      ))}
      {popChange !== null ? (
        <p
          className={`mt-1 text-xs font-medium ${trendTextClass(trendDirection(popChange))}`}
        >
          <TrendArrow direction={trendDirection(popChange)} /> {formatGrowthPercent(popChange)}{" "}
          vs prior bucket
        </p>
      ) : null}
    </div>
  );
}

export function CountTooltip({
  active,
  payload,
  label,
  prevValue,
}: {
  active?: boolean;
  payload?: unknown;
  label?: string | number;
  prevValue?: number;
}) {
  const rows = normalizeTooltipPayload(payload);
  if (!active || !rows.length) return null;
  const current = tooltipValue(rows[0]?.value);
  const popChange =
    prevValue !== undefined && prevValue > 0
      ? Math.round(((current - prevValue) / prevValue) * 1000) / 10
      : null;
  const labelText =
    label !== undefined && label !== null ? String(label) : undefined;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {labelText ? (
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
          {labelText}
        </p>
      ) : null}
      {rows.map((entry, i) => (
        <p key={i} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {tooltipValue(entry.value).toLocaleString("en-US")}
        </p>
      ))}
      {popChange !== null ? (
        <p
          className={`mt-1 text-xs font-medium ${trendTextClass(trendDirection(popChange))}`}
        >
          <TrendArrow direction={trendDirection(popChange)} /> {formatGrowthPercent(popChange)}{" "}
          vs prior bucket
        </p>
      ) : null}
    </div>
  );
}

export type { GrowthPercent, PeriodComparison };
