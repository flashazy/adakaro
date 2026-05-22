import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Banknote,
  Layers,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, type SchoolCurrencyCode } from "@/lib/currency";
import type { FeeRulesPageInsights } from "@/lib/report-card-fee/page-insights";
import {
  countClassesWithEnabledRules,
  type FinanceRulesStatus,
} from "@/lib/report-card-fee/fee-rules-ui";
import type { FeeRulesClassRow } from "./fee-rules-client";

const STATUS_BADGE: Record<
  FinanceRulesStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50",
  },
  setup_needed: {
    label: "Needs setup",
    className:
      "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50",
  },
  no_rules: {
    label: "Needs setup",
    className:
      "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50",
  },
};

export function FinanceRulesStatusBadge({
  status,
}: {
  status: FinanceRulesStatus;
}) {
  const { label, className } = STATUS_BADGE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        className
      )}
    >
      {label}
    </span>
  );
}

type InsightEmphasis = "highest" | "high" | "normal" | "calm";

function InsightMetricCard({
  title,
  value,
  icon: Icon,
  accent,
  emphasis,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  accent: "slate" | "amber" | "rose" | "indigo";
  emphasis: InsightEmphasis;
}) {
  const accentClass =
    accent === "rose" && emphasis === "highest"
      ? "border-red-300/90 bg-red-50/90 shadow-sm ring-1 ring-red-100/60 dark:border-red-800/55 dark:bg-red-950/35 dark:ring-red-900/40"
      : accent === "amber" && emphasis === "high"
        ? "border-amber-300/85 bg-amber-50/70 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30"
        : accent === "indigo"
          ? "border-indigo-200/45 bg-indigo-50/20 dark:border-indigo-900/25 dark:bg-indigo-950/12"
          : "border-slate-200/70 bg-slate-50/40 dark:border-zinc-700/70 dark:bg-zinc-900/50";

  const iconClass =
    accent === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : accent === "rose"
        ? "text-red-700 dark:text-red-300"
        : accent === "indigo"
          ? "text-indigo-600/80 dark:text-indigo-400/80"
          : "text-slate-500 dark:text-zinc-500";

  const valueClass =
    emphasis === "highest"
      ? "text-red-950 dark:text-red-100"
      : emphasis === "high"
        ? "text-amber-950 dark:text-amber-100"
        : "text-slate-900 dark:text-white";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-2.5 py-2 shadow-sm",
        accentClass
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
          {title}
        </p>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-xl",
          valueClass
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function FeeRulesCommandCenter({
  classes,
  currency,
  insights,
}: {
  classes: FeeRulesClassRow[];
  currency: SchoolCurrencyCode;
  insights: FeeRulesPageInsights;
}) {
  const enabledCount = countClassesWithEnabledRules(classes);
  const hasZeroFeeClasses = classes.some((r) => r.feeAssigned <= 0);
  const showInsights = insights.insightsAvailable;

  const collectionFormatted = formatCurrency(
    insights.collectionOpportunity,
    currency
  );

  const hasCollectionOpportunity =
    insights.collectionOpportunity > 0 && insights.almostReadyCount > 0;

  const unlockLabel =
    insights.almostReadyCount === 1
      ? "1 more report access"
      : `${insights.almostReadyCount} more report access`;

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/20 px-3 py-2 shadow-sm dark:border-zinc-700/90 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/15 sm:px-3.5"
        role="note"
      >
        <div className="flex gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Shield className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              Parent Access Protection
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-zinc-400 sm:text-[13px]">
              Controls parent report visibility only. Teachers and school staff
              are not affected.
            </p>
          </div>
        </div>
      </div>

      {showInsights ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <InsightMetricCard
            title="Not Ready"
            value={String(insights.notReadyCount)}
            icon={Users}
            accent="rose"
            emphasis="highest"
          />
          <InsightMetricCard
            title="Almost Ready"
            value={String(insights.almostReadyCount)}
            icon={TrendingUp}
            accent="amber"
            emphasis="high"
          />
          <InsightMetricCard
            title="Collection Opportunity"
            value={collectionFormatted}
            icon={Banknote}
            accent="indigo"
            emphasis="normal"
          />
          <InsightMetricCard
            title="Rules Active"
            value={String(insights.classesProtected)}
            icon={Layers}
            accent="slate"
            emphasis="calm"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
          hasCollectionOpportunity
            ? "border-indigo-200/70 bg-indigo-50/35 dark:border-indigo-900/40 dark:bg-indigo-950/20"
            : "border-slate-200/90 bg-slate-50/70 dark:border-zinc-700 dark:bg-zinc-800/40"
        )}
      >
        <Sparkles
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            hasCollectionOpportunity
              ? "text-indigo-600/90 dark:text-indigo-400/90"
              : "text-slate-500 dark:text-zinc-500"
          )}
          aria-hidden
        />
        <p className="min-w-0 leading-snug text-slate-700 dark:text-zinc-300">
          {hasCollectionOpportunity ? (
            <>
              Collect{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {collectionFormatted}
              </span>{" "}
              to unlock {unlockLabel}.
            </>
          ) : (
            <span className="text-slate-600 dark:text-zinc-400">
              No payments close to unlocking access right now.
            </span>
          )}
        </p>
      </div>

      {enabledCount === 0 ? (
        <p
          className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-sm leading-snug text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
          role="status"
        >
          No rules are active yet. Parents can get report cards without fee
          limits.
        </p>
      ) : null}

      {hasZeroFeeClasses ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-amber-200/90 bg-amber-50/70 px-3 py-2 text-sm leading-snug text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100/90"
          role="status"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <span>Some classes still need a class fee before rules can work.</span>
        </p>
      ) : null}
    </div>
  );
}
