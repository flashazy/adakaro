import {
  formatCompactFinanceAmount,
  type FinanceInsight,
  type FinanceSummary,
} from "@/lib/finance/finance-dashboard-summaries";

interface FinanceReportsSummaryStripProps {
  summary: FinanceSummary;
  insight: FinanceInsight;
  currencyCode: string;
}

/** Compact executive line above Financial Reports. */
export function FinanceReportsSummaryStrip({
  summary,
  insight,
  currencyCode,
}: FinanceReportsSummaryStripProps) {
  const outstandingCompact = formatCompactFinanceAmount(
    summary.outstanding,
    currencyCode
  );
  const rate = summary.collectionRatePercent.toFixed(1);

  const followUp =
    insight.hasData && insight.studentsWithOutstanding > 0
      ? `${insight.studentsWithOutstanding} student${insight.studentsWithOutstanding !== 1 ? "s" : ""} need follow-up`
      : insight.hasData
        ? "All students cleared"
        : "No fee data yet";

  return (
    <div className="mb-4 rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 dark:border-zinc-700/80 dark:bg-zinc-900/40 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Finance Summary
      </p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-sm text-slate-700 dark:text-zinc-300">
        <span className="font-semibold text-slate-900 dark:text-white">
          {followUp}
        </span>
        <span className="text-slate-400 dark:text-zinc-600" aria-hidden>
          •
        </span>
        <span className="text-slate-600 dark:text-zinc-400">
          <span className="text-base font-bold tabular-nums text-amber-900 dark:text-amber-300">
            {outstandingCompact}
          </span>{" "}
          <span className="font-medium text-amber-800/90 dark:text-amber-400/90">
            outstanding
          </span>
        </span>
        <span className="text-slate-400 dark:text-zinc-600" aria-hidden>
          •
        </span>
        <span className="text-slate-600 dark:text-zinc-400">
          Collection{" "}
          <span className="text-base font-bold tabular-nums text-school-primary">
            {rate}%
          </span>
        </span>
      </p>
    </div>
  );
}
