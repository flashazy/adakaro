"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  ClipboardList,
  Layers,
  Receipt,
  TableProperties,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type {
  CollectionHealth,
  CollectedMonthTrend,
  FinanceInsight,
  FinanceSummary,
  OutstandingRiskLevel,
  TrendTone,
} from "@/lib/finance/finance-dashboard-summaries";
import {
  COLLECTION_RATE_TARGET_PERCENT,
  computeCollectedMonthTrend,
  getCollectionFocusMessage,
  getCollectionHealth,
  getCollectionRateFriendlyStatus,
  getCollectionTargetBarColor,
  getOutstandingRiskLevel,
} from "@/lib/finance/finance-dashboard-summaries";
const QUICK_ACTION_CLASS =
  "inline-flex min-h-[44px] min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800 transition-all duration-200 hover:scale-[1.01] hover:border-school-primary/45 hover:bg-[rgb(var(--school-primary-rgb)/0.08)] hover:shadow-md hover:ring-2 hover:ring-school-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-school-primary/50 dark:hover:ring-school-primary/20 dark:focus-visible:ring-offset-zinc-900";

const HEALTH_STYLES: Record<
  CollectionHealth["level"],
  {
    wrap: string;
    dot: string;
    label: string;
    detail: string;
    icon?: boolean;
  }
> = {
  needs_attention: {
    wrap:
      "border-amber-300/90 bg-amber-50 shadow-md ring-1 ring-amber-200/70 border-l-4 border-l-amber-500 dark:border-amber-800/60 dark:bg-amber-950/35 dark:ring-amber-900/50 dark:border-l-amber-500",
    dot: "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/60",
    label: "text-amber-950 dark:text-amber-100",
    detail: "text-amber-900 font-medium dark:text-amber-200",
    icon: true,
  },
  improving: {
    wrap: "border-sky-200/80 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20",
    dot: "bg-sky-500",
    label: "text-sky-900 dark:text-sky-200",
    detail: "text-sky-800/90 dark:text-sky-300/90",
  },
  healthy: {
    wrap: "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
    label: "text-emerald-900 dark:text-emerald-200",
    detail: "text-emerald-800/90 dark:text-emerald-300/90",
  },
};

const TREND_HINT_CLASS: Record<TrendTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-amber-700 dark:text-amber-400",
  neutral: "text-slate-500 dark:text-zinc-400",
};

const RISK_BADGE_CLASS: Record<OutstandingRiskLevel, string> = {
  HIGH: "bg-amber-100 text-amber-900 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-500/30",
  MEDIUM:
    "bg-yellow-50 text-yellow-900 ring-yellow-600/20 dark:bg-yellow-950/40 dark:text-yellow-200 dark:ring-yellow-500/25",
  LOW: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/25",
};

type SummaryCardVariant = "neutral" | "collected" | "outstanding";

const SUMMARY_CARD_VARIANTS: Record<
  SummaryCardVariant,
  { wrap: string; value: string }
> = {
  neutral: {
    wrap: "border-slate-200/90 bg-white dark:border-zinc-700/80 dark:bg-zinc-900",
    value: "text-slate-900 dark:text-white",
  },
  collected: {
    wrap: "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/25",
    value: "text-emerald-800 dark:text-emerald-300",
  },
  outstanding: {
    wrap: "border-amber-200/80 bg-amber-50/60 ring-1 ring-amber-100/80 dark:border-amber-900/45 dark:bg-amber-950/30 dark:ring-amber-900/40",
    value: "text-amber-900 dark:text-amber-200",
  },
};

function SummaryCard({
  label,
  value,
  variant = "neutral",
  hint,
  hintTone = "neutral",
}: {
  label: string;
  value: string;
  variant?: SummaryCardVariant;
  hint?: string;
  hintTone?: TrendTone;
}) {
  const styles = SUMMARY_CARD_VARIANTS[variant];
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${styles.wrap}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-bold tabular-nums sm:text-xl ${styles.value}`}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={`mt-1.5 text-[11px] font-medium leading-snug ${TREND_HINT_CLASS[hintTone]}`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CollectionRateCard({ ratePercent }: { ratePercent: number }) {
  const rateDisplay = `${ratePercent.toFixed(1)}%`;
  const clamped = Math.min(100, Math.max(0, ratePercent));
  const statusText = getCollectionRateFriendlyStatus(ratePercent);
  const barColor = getCollectionTargetBarColor(ratePercent);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Collection Rate
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900 dark:text-white sm:text-xl">
        {rateDisplay}
      </p>
      <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
        Target: {COLLECTION_RATE_TARGET_PERCENT}%
      </p>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
        {rateDisplay} collected
      </p>
      <div
        className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={COLLECTION_RATE_TARGET_PERCENT}
        aria-label={`Collection rate ${rateDisplay}, target ${COLLECTION_RATE_TARGET_PERCENT}%`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-400/50 dark:bg-zinc-500"
          style={{ left: `${COLLECTION_RATE_TARGET_PERCENT}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
        {statusText}
      </p>
    </div>
  );
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function InsightMetric({
  label,
  value,
  subtext,
  badge,
}: {
  label: string;
  value: ReactNode;
  subtext?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-5 py-4 dark:border-zinc-700/60 dark:bg-zinc-900/40 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          {label}
        </p>
        {badge}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-2xl">
        {value}
      </p>
      {subtext ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

function RiskLevelBadge({ level }: { level: OutstandingRiskLevel }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${RISK_BADGE_CLASS[level]}`}
    >
      {level}
    </span>
  );
}

interface FinanceCommandCenterProps {
  summary: FinanceSummary;
  insight: FinanceInsight;
  currencyCode: string;
  paymentsForTrend?: { payment_date: string; amount: number }[];
}

export function FinanceCommandCenter({
  summary,
  insight,
  currencyCode,
  paymentsForTrend = [],
}: FinanceCommandCenterProps) {
  const money = (n: number) => formatCurrency(n, currencyCode);
  const health = getCollectionHealth(summary.collectionRatePercent);
  const healthStyle = HEALTH_STYLES[health.level];
  const collectedTrend: CollectedMonthTrend | null = computeCollectedMonthTrend(
    paymentsForTrend
  );
  const riskLevel = getOutstandingRiskLevel(
    summary.outstanding,
    summary.totalExpected
  );
  const focusMessage = getCollectionFocusMessage(insight);

  const outstandingHint =
    summary.outstanding > 0 ? "↓ Collection needed" : "All balances clear";

  const quickActions = [
    {
      label: "Record Payment",
      onClick: () => scrollToSection("finance-record-payment"),
      icon: Receipt,
    },
    {
      label: "Fee Setup",
      href: "/dashboard/fee-types",
      icon: Layers,
    },
    {
      label: "Fee Structure",
      href: "/dashboard/fee-structures",
      icon: TableProperties,
    },
    {
      label: "Report Rules",
      href: "/dashboard/fee-rules",
      icon: ClipboardList,
    },
  ] as const;

  return (
    <section
      id="finance-command-center"
      aria-labelledby="finance-command-center-heading"
      className="space-y-5"
    >
      <div className="sr-only">
        <h2 id="finance-command-center-heading">Finance overview</h2>
      </div>

      {/* Quick actions — sticky on desktop only */}
      <div className="lg:sticky lg:top-0 lg:z-20 lg:-mx-1 lg:rounded-2xl lg:border lg:border-transparent lg:bg-white/95 lg:px-1 lg:py-2 lg:backdrop-blur-sm lg:dark:bg-zinc-950/95">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900 sm:p-5 lg:border-slate-200/60 lg:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Quick Finance Actions
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              if ("href" in action) {
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={QUICK_ACTION_CLASS}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 text-school-primary"
                      aria-hidden
                    />
                    {action.label}
                  </Link>
                );
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={QUICK_ACTION_CLASS}
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-school-primary"
                    aria-hidden
                  />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <SummaryCard
          label="Total Expected Fees"
          value={money(summary.totalExpected)}
          variant="neutral"
        />
        <SummaryCard
          label="Collected"
          value={money(summary.collected)}
          variant="collected"
          hint={collectedTrend?.hint}
          hintTone={collectedTrend?.tone ?? "neutral"}
        />
        <SummaryCard
          label="Outstanding"
          value={money(summary.outstanding)}
          variant="outstanding"
          hint={outstandingHint}
          hintTone={summary.outstanding > 0 ? "negative" : "positive"}
        />
        <CollectionRateCard ratePercent={summary.collectionRatePercent} />
      </div>

      {/* Collection health */}
      <div
        className={`flex flex-col gap-2.5 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${healthStyle.wrap}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          {healthStyle.icon ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              aria-hidden
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : (
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthStyle.dot}`}
              aria-hidden
            />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              Collection Health
            </p>
            <p className={`text-base font-bold ${healthStyle.label}`}>
              {health.label}
            </p>
          </div>
        </div>
        <div className={`text-sm ${healthStyle.detail}`}>
          <p>{health.detail}</p>
          {health.subdetail ? (
            <p className="mt-0.5 text-xs opacity-90">{health.subdetail}</p>
          ) : null}
        </div>
      </div>

      {/* Finance insight */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--school-primary-rgb)/0.12)] text-school-primary">
            <ArrowDownCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Finance Insight
            </h3>
            {!insight.hasData ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                Finance insight will appear when fee and payment data is
                available.
              </p>
            ) : insight.studentsWithOutstanding === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-5 dark:border-emerald-900/40 dark:bg-emerald-950/25 sm:px-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Excellent work
                    </p>
                    <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-300/90">
                      All student balances are cleared.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {focusMessage ? (
                  <p className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-800/40 dark:text-zinc-300">
                    {focusMessage}
                  </p>
                ) : null}
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  <InsightMetric
                    label="Students needing follow-up"
                    value={insight.studentsWithOutstanding}
                  />
                  <InsightMetric
                    label="Outstanding balance"
                    value={money(insight.totalOutstanding)}
                    badge={
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                          Risk level
                        </span>
                        <RiskLevelBadge level={riskLevel} />
                      </div>
                    }
                  />
                  {insight.largestOutstandingClass ? (
                    <InsightMetric
                      label="Highest balance class"
                      value={insight.largestOutstandingClass}
                      subtext="Focus collection efforts there first."
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
