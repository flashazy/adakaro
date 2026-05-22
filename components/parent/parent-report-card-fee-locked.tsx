import { formatCurrency, type SchoolCurrencyCode } from "@/lib/currency";
import type { ParentReportEligibilityResult } from "@/lib/report-card-fee/types";

export function ParentReportCardFeeLocked({
  eligibility,
  currency = "TZS",
}: {
  eligibility: ParentReportEligibilityResult;
  currency?: SchoolCurrencyCode;
}) {
  const message =
    eligibility.parentMessage ??
    "Your child's report card will become available after completing required school fee payment.";

  const requiredLabel =
    eligibility.ruleType === "percentage" && eligibility.requiredPercent != null
      ? `${eligibility.requiredPercent}% of class fees`
      : eligibility.requiredAmount != null
        ? formatCurrency(eligibility.requiredAmount, currency)
        : "—";

  const remaining =
    eligibility.remainingAmount != null && eligibility.remainingAmount > 0
      ? formatCurrency(eligibility.remainingAmount, currency)
      : null;

  return (
    <div
      className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      role="status"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
        <span className="text-xl" aria-hidden>
          🔒
        </span>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
        Report Card Temporarily Unavailable
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
        {message}
      </p>
      <dl className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-800/50">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-zinc-400">Paid</dt>
          <dd className="font-medium tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(eligibility.paidAmount, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-zinc-400">Required</dt>
          <dd className="font-medium tabular-nums text-slate-900 dark:text-white">
            {requiredLabel}
          </dd>
        </div>
        {remaining ? (
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 dark:border-zinc-700">
            <dt className="text-slate-500 dark:text-zinc-400">Remaining</dt>
            <dd className="font-semibold tabular-nums text-amber-800 dark:text-amber-200">
              {remaining}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
        Contact the finance office if you have questions about your balance.
      </p>
    </div>
  );
}
