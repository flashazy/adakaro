"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calculator,
  Eye,
  Loader2,
  Pencil,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  previewClassFeeEligibilityAction,
  saveReportCardFeeRuleAction,
  type FeeRuleActionState,
  type EligibilityInsightStudentRow,
  type FeeRulePreviewState,
} from "./actions";
import { formatCurrency, type SchoolCurrencyCode } from "@/lib/currency";
import type { ReportCardFeeRuleType } from "@/lib/report-card-fee/types";
import type { ClassFeeRulesConfig } from "@/lib/report-card-fee/types";
import type { ReportCardFeeScheduleType } from "@/lib/report-card-fee/schedule-types";
import {
  defaultAcademicYear,
  formatTermLabel,
  MONTH_LABELS,
} from "@/lib/report-card-fee/schedule-types";
import { scheduleTypeSummary } from "@/lib/report-card-fee/build-class-rules-config";
import {
  configScheduleLabel,
  configToDisplayRule,
  formatRuleTypeLabel,
  minimumPaymentNeeded,
  PARENT_MESSAGE_TEMPLATES,
  parentAccessBadgeText,
  requirementDisplay,
  requirementExplanation,
} from "@/lib/report-card-fee/fee-rules-ui";
import {
  MonthlyMilestonesEditor,
  ScheduleTypePicker,
  TermBasedEditor,
} from "./fee-rules-schedule-editor";
import type { FeeRulePreviewParams } from "./actions";

const PREVIEW_LOAD_ERROR = "Could not load preview. Please try again.";

export type FeeRulesClassRow = {
  classId: string;
  className: string;
  feeAssigned: number;
  config: ClassFeeRulesConfig;
};

const editorBlockClass =
  "rounded-xl border border-slate-200/90 bg-slate-50 p-5 dark:border-zinc-700/90 dark:bg-zinc-800/50 sm:p-6";

function EditorSectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={editorBlockClass}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
        {title}
      </h4>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ParentAccessBadge({
  config,
  currency,
  feeAssigned = 0,
}: {
  config: ClassFeeRulesConfig;
  currency: SchoolCurrencyCode;
  feeAssigned?: number;
}) {
  const { label, tone } = parentAccessBadgeText(
    configToDisplayRule(config),
    currency,
    feeAssigned
  );
  return (
    <span
      className={cn(
        "inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "active" &&
          "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/50",
        tone === "disabled" &&
          "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
        tone === "warning" &&
          "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50"
      )}
    >
      {label}
    </span>
  );
}

function PremiumToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-zinc-600/80 dark:bg-zinc-900/60">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
          checked ? "bg-school-primary" : "bg-slate-300 dark:bg-zinc-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

function RuleTypeSegmented({
  value,
  onChange,
}: {
  value: ReportCardFeeRuleType;
  onChange: (v: ReportCardFeeRuleType) => void;
}) {
  const options: { id: ReportCardFeeRuleType; label: string }[] = [
    { id: "percentage", label: "Percentage" },
    { id: "fixed_amount", label: "Fixed amount" },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-inner dark:border-zinc-600/80 dark:bg-zinc-900/80"
      role="group"
      aria-label="Requirement type"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "min-h-[44px] rounded-lg px-3 text-sm font-semibold transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary",
            value === opt.id
              ? "bg-school-primary text-white shadow-md shadow-school-primary/25"
              : "text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          )}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CalculationPreviewCard({
  feeAssigned,
  ruleType,
  requiredPercentage,
  requiredAmount,
  currency,
}: {
  feeAssigned: number;
  ruleType: ReportCardFeeRuleType;
  requiredPercentage: number;
  requiredAmount: number;
  currency: SchoolCurrencyCode;
}) {
  const minPayment = minimumPaymentNeeded(
    feeAssigned,
    ruleType,
    requiredPercentage,
    requiredAmount
  );
  const requiredLabel =
    ruleType === "percentage"
      ? `${requiredPercentage}%`
      : formatCurrency(requiredAmount, currency);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white dark:border-zinc-600/90 dark:from-zinc-800/60 dark:to-zinc-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3 dark:border-zinc-700/80">
        <Calculator
          className="h-4 w-4 text-school-primary"
          aria-hidden
        />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
          Calculation preview
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:gap-5">
        <div>
          <dt className="text-xs text-slate-500 dark:text-zinc-500">
            Assigned fee
          </dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(feeAssigned, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-zinc-500">
            Required payment
          </dt>
          <dd className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
            {requiredLabel}
          </dd>
        </div>
        <div className="rounded-lg bg-school-primary/5 px-3 py-2 ring-1 ring-school-primary/15 sm:col-span-1">
          <dt className="text-xs font-medium text-school-primary/80 dark:text-school-primary">
            Minimum payment needed
          </dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-school-primary">
            {minPayment != null ? formatCurrency(minPayment, currency) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function FeeZeroNote({ feeAssigned }: { feeAssigned: number }) {
  if (feeAssigned > 0) return null;
  return (
    <p className="text-xs text-amber-800 dark:text-amber-200/90">
      No class fee assigned yet. Percentage rules need an assigned class fee to
      calculate eligibility.
    </p>
  );
}

function InsightMetricCard({
  title,
  count,
  subtitle,
  hint,
  theme,
}: {
  title: string;
  count: number;
  subtitle: string;
  hint?: string;
  theme: "eligible" | "almost" | "blocked";
}) {
  const themeClass =
    theme === "eligible"
      ? "border-emerald-200/90 bg-emerald-50 shadow-emerald-100/50 hover:shadow-emerald-200/60 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:shadow-none dark:hover:shadow-emerald-950/50"
      : theme === "almost"
        ? "border-amber-200/90 bg-amber-50 shadow-amber-100/50 hover:shadow-amber-200/60 dark:border-amber-900/50 dark:bg-amber-950/35 dark:shadow-none dark:hover:shadow-amber-950/50"
        : "border-red-200/90 bg-red-50 shadow-red-100/50 hover:shadow-red-200/60 dark:border-red-900/40 dark:bg-red-950/30 dark:shadow-none dark:hover:shadow-red-950/40";

  const titleClass =
    theme === "eligible"
      ? "text-emerald-800/90 dark:text-emerald-200/90"
      : theme === "almost"
        ? "text-amber-900/90 dark:text-amber-200/90"
        : "text-red-900/90 dark:text-red-200/90";

  const countClass =
    theme === "eligible"
      ? "text-emerald-900 dark:text-emerald-100"
      : theme === "almost"
        ? "text-amber-950 dark:text-amber-100"
        : "text-red-950 dark:text-red-100";

  return (
    <div
      className={cn(
        "flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 shadow-sm transition-shadow duration-200",
        themeClass
      )}
    >
      <div>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            titleClass
          )}
        >
          {title}
        </p>
        <p className={cn("mt-2 text-3xl font-bold tabular-nums", countClass)}>
          {count}
        </p>
      </div>
      <div className="mt-3 space-y-0.5">
        <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
          {subtitle}
        </p>
        {hint ? (
          <p className="text-[11px] text-slate-600 dark:text-zinc-400">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function InsightStudentSampleRow({
  row,
  currency,
  variant,
}: {
  row: EligibilityInsightStudentRow;
  currency: SchoolCurrencyCode;
  variant: "almost" | "blocked";
}) {
  const label = row.admissionNumber?.trim() || row.studentName.slice(0, 16);
  const paidLabel =
    row.ruleType === "percentage"
      ? `${row.paidPercent}%`
      : formatCurrency(row.paidAmount, currency);

  const borderClass =
    variant === "almost"
      ? "border-amber-200/90 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/25"
      : "border-red-200/80 bg-red-50/60 dark:border-red-900/35 dark:bg-red-950/25";

  return (
    <li
      className={cn(
        "rounded-xl border px-3 py-3 sm:px-4",
        borderClass
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            Paid {paidLabel}
            {variant === "almost" ? (
              <span className="font-medium text-amber-900 dark:text-amber-200">
                {" "}
                · Need {row.needMorePercent}% more
              </span>
            ) : null}
          </p>
          {row.appliedRuleLabel ? (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
              {row.appliedRuleLabel}
            </p>
          ) : null}
        </div>
        {variant === "almost" && row.remainingAmount > 0 ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-amber-950 dark:text-amber-100">
            {formatCurrency(row.remainingAmount, currency)} remaining
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PreviewInsightRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5",
        highlight
          ? "bg-school-primary/5 ring-1 ring-school-primary/15"
          : "bg-white/60 dark:bg-zinc-900/40"
      )}
    >
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          highlight
            ? "text-school-primary"
            : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EligibilityPreviewModal({
  open,
  onClose,
  data,
  currency,
  loading,
  previewRow,
  previewYear,
  previewTerm,
  previewMonth,
  onPreviewYearChange,
  onPreviewTermChange,
  onPreviewMonthChange,
  onRecalculate,
}: {
  open: boolean;
  onClose: () => void;
  data: FeeRulePreviewState | null;
  currency: SchoolCurrencyCode;
  loading: boolean;
  previewRow: FeeRulesClassRow | null;
  previewYear: string;
  previewTerm: string;
  previewMonth: number;
  onPreviewYearChange: (y: string) => void;
  onPreviewTermChange: (t: string) => void;
  onPreviewMonthChange: (m: number) => void;
  onRecalculate: () => void;
}) {
  const titleId = useId();

  if (!open) return null;

  const scheduleType = previewRow?.config.scheduleType ?? "simple";

  const previewMin =
    data?.ok && data.ruleEnabled && data.ruleType
      ? minimumPaymentNeeded(
          data.feeAssigned,
          data.ruleType,
          data.requiredPercentage ?? 0,
          data.requiredAmount ?? 0
        )
      : null;

  const requirementLabel =
    data?.ok && data.ruleEnabled && data.ruleType
      ? data.ruleType === "percentage"
        ? `${data.requiredPercentage ?? 0}%`
        : formatCurrency(data.requiredAmount ?? 0, currency)
      : "—";

  const ruleStatusLabel =
    data?.ok && !data.ruleEnabled
      ? "Disabled"
      : data?.ok && data.ruleType
        ? formatRuleTypeLabel(data.ruleType)
        : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Eligibility insight
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Parent report card access preview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:hover:bg-zinc-800"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {scheduleType !== "simple" && previewRow ? (
            <div className="mb-4 space-y-3 rounded-xl border border-slate-200/90 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preview context
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600">Academic year</label>
                  <input
                    type="text"
                    value={previewYear}
                    onChange={(e) => onPreviewYearChange(e.target.value)}
                    onBlur={onRecalculate}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>
                {scheduleType === "term_based" ? (
                  <div>
                    <label className="text-xs text-slate-600">Term</label>
                    <select
                      value={previewTerm}
                      onChange={(e) => {
                        onPreviewTermChange(e.target.value);
                        setTimeout(onRecalculate, 0);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      {Array.from(
                        { length: previewRow.config.termCount },
                        (_, i) => (
                          <option key={i + 1} value={formatTermLabel(i + 1)}>
                            {formatTermLabel(i + 1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-600">Month</label>
                    <select
                      value={previewMonth}
                      onChange={(e) => {
                        onPreviewMonthChange(Number(e.target.value));
                        setTimeout(onRecalculate, 0);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      {MONTH_LABELS.map((label, i) => (
                        <option key={label} value={i + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Calculating eligibility…
            </p>
          ) : data && !data.ok ? (
            <p className="text-sm text-red-600">{data.error}</p>
          ) : data?.ok ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <PreviewInsightRow label="Class" value={data.className} />
                  <PreviewInsightRow
                    label="Assigned fee"
                    value={formatCurrency(data.feeAssigned, currency)}
                  />
                  <PreviewInsightRow label="Rule status" value={ruleStatusLabel} />
                  <PreviewInsightRow
                    label="Schedule"
                    value={
                      data.scheduleType
                        ? scheduleTypeSummary(data.scheduleType)
                        : "—"
                    }
                  />
                  <PreviewInsightRow
                    label="Applied rule"
                    value={data.appliedRuleLabel ?? "—"}
                  />
                  <PreviewInsightRow
                    label="Requirement"
                    value={data.ruleEnabled ? requirementLabel : "—"}
                  />
                  <PreviewInsightRow
                    label="Minimum payment"
                    value={
                      previewMin != null
                        ? formatCurrency(previewMin, currency)
                        : "—"
                    }
                    highlight={Boolean(previewMin)}
                  />
                </dl>
              </div>

              {data.feeAssigned <= 0 ? (
                <p className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  No class fee assigned yet.
                </p>
              ) : null}

              {!data.ruleEnabled ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                  Parent access rule is disabled. All parents can receive
                  report cards.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <InsightMetricCard
                      title="Ready for Report"
                      count={data.eligibleCount}
                      subtitle="Ready for report access"
                      theme="eligible"
                    />
                    <InsightMetricCard
                      title="Almost Ready"
                      count={data.almostEligibleCount}
                      subtitle="Close to report access"
                      hint={`Need ≤${data.bufferPercent}% more payment`}
                      theme="almost"
                    />
                    <InsightMetricCard
                      title="Not Ready"
                      count={data.blockedCount}
                      subtitle="Payment requirement not reached"
                      theme="blocked"
                    />
                  </div>

                  {data.collectionOpportunityCount > 0 ? (
                    <div className="rounded-2xl border border-school-primary/25 bg-gradient-to-br from-school-primary/8 via-white to-amber-50/80 p-4 shadow-sm dark:border-school-primary/30 dark:from-school-primary/10 dark:via-zinc-900 dark:to-amber-950/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-school-primary">
                        Collection opportunity
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {data.collectionOpportunityCount} parent
                          {data.collectionOpportunityCount === 1 ? "" : "s"}
                        </span>{" "}
                        {data.collectionOpportunityCount === 1 ? "is" : "are"}{" "}
                        within qualification range.
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                        Estimated remaining collection:
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(
                          data.estimatedRemainingCollection,
                          currency
                        )}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                        If these balances are collected, more report cards may
                        unlock for parents.
                      </p>
                    </div>
                  ) : null}

                  {data.almostEligibleSample.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                        Sample Almost Ready
                      </p>
                      <ul className="mt-3 space-y-2">
                        {data.almostEligibleSample.map((s, i) => (
                          <InsightStudentSampleRow
                            key={`almost-${s.studentName}-${i}`}
                            row={s}
                            currency={currency}
                            variant="almost"
                          />
                        ))}
                      </ul>
                      {data.almostEligibleMoreCount > 0 ? (
                        <p className="mt-3 text-center text-xs font-medium text-slate-500">
                          +{data.almostEligibleMoreCount} more almost ready
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {data.blockedSample.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800/90 dark:text-red-200/90">
                        Sample Not Ready
                      </p>
                      <ul className="mt-3 space-y-2">
                        {data.blockedSample.map((s, i) => (
                          <InsightStudentSampleRow
                            key={`blocked-${s.studentName}-${i}`}
                            row={s}
                            currency={currency}
                            variant="blocked"
                          />
                        ))}
                      </ul>
                      {data.blockedMoreCount > 0 ? (
                        <p className="mt-3 text-center text-xs font-medium text-slate-500">
                          +{data.blockedMoreCount} more not ready
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function editorConfigKey(config: FeeRulesClassRow["config"]): string {
  const termKey = config.terms.map((t) => `${t.term}:${t.isEnabled}`).join(",");
  const monthKey = config.months
    .filter((m) => m.isEnabled)
    .map((m) => `${m.month}:${m.requiredPercentage}`)
    .join(",");
  return [
    config.scheduleType,
    config.academicYear,
    config.simple?.id ?? "no-simple",
    config.simple?.isEnabled ? "1" : "0",
    termKey,
    monthKey,
  ].join("|");
}

function FeeRuleEditorPanel({
  row,
  currency,
  onClose,
}: {
  row: FeeRulesClassRow;
  currency: SchoolCurrencyCode;
  onClose: () => void;
}) {
  const [scheduleType, setScheduleType] = useState<ReportCardFeeScheduleType>(
    row.config.scheduleType
  );
  const [academicYear, setAcademicYear] = useState(row.config.academicYear);
  const [termCount, setTermCount] = useState<2 | 3>(row.config.termCount);
  const [terms, setTerms] = useState(row.config.terms);
  const [months, setMonths] = useState(row.config.months);

  const [ruleType, setRuleType] = useState<ReportCardFeeRuleType>(
    row.config.simple?.ruleType ?? "percentage"
  );
  const [isEnabled, setIsEnabled] = useState(
    row.config.simple?.isEnabled ?? false
  );
  const [requiredPercentage, setRequiredPercentage] = useState(
    row.config.simple?.requiredPercentage ?? 70
  );
  const [requiredAmount, setRequiredAmount] = useState(
    row.config.simple?.requiredAmount ?? 0
  );
  const [messageToParent, setMessageToParent] = useState(
    row.config.simple?.messageToParent ?? PARENT_MESSAGE_TEMPLATES[0]
  );
  const [allowAdminOverride, setAllowAdminOverride] = useState(
    row.config.allowAdminOverride
  );

  const router = useRouter();

  const rulesJson =
    scheduleType === "term_based"
      ? JSON.stringify({
          terms: terms.slice(0, termCount).map((t) => ({
            term: t.term,
            isEnabled: t.isEnabled,
            ruleType: t.ruleType,
            requiredPercentage: t.requiredPercentage,
            requiredAmount: t.requiredAmount,
            messageToParent: t.messageToParent || null,
          })),
        })
      : scheduleType === "monthly_milestones"
        ? JSON.stringify({
            months: months.map((m) => ({
              month: m.month,
              isEnabled: m.isEnabled,
              ruleType: "percentage" as const,
              requiredPercentage: m.requiredPercentage,
              requiredAmount: null,
              messageToParent: m.messageToParent || null,
            })),
          })
        : "{}";

  const [state, formAction, pending] = useActionState<
    FeeRuleActionState | null,
    FormData
  >(saveReportCardFeeRuleAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message, { id: `fee-rule-${row.classId}` });
      router.refresh();
      onClose();
    } else {
      toast.error(state.error, { id: `fee-rule-err-${row.classId}` });
    }
  }, [state, row.classId, onClose, router]);

  const pctDisabled =
    scheduleType === "simple" &&
    ruleType === "percentage" &&
    row.feeAssigned <= 0;
  const saveDisabled =
    pending ||
    (pctDisabled && isEnabled && scheduleType === "simple");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-zinc-800 sm:px-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Parent Report Access Rule
        </h3>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Set the payment requirement parents must meet before report cards
          become visible.
        </p>
        <div
          className="mt-4 flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
          role="note"
        >
          <Shield className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <p>
            Teachers, coordinators, and admins can still view and generate report
            cards. This rule only controls parent access.
          </p>
        </div>
      </div>

      <form
        action={formAction}
        className="flex min-w-0 flex-col"
        onSubmit={() => {
          if (process.env.NODE_ENV === "development") {
            console.log("[fee-rules save] client payload", {
              classId: row.classId,
              scheduleType,
              academicYear,
              isEnabled,
              allowAdminOverride,
              rulesJson,
              ruleType,
              requiredPercentage,
              requiredAmount,
              simpleRuleId: row.config.simple?.id ?? null,
            });
          }
        }}
      >
        <input type="hidden" name="class_id" value={row.classId} />
        <input type="hidden" name="schedule_type" value={scheduleType} />
        <input type="hidden" name="academic_year" value={academicYear} />
        <input type="hidden" name="rules_json" value={rulesJson} />
        <input
          type="hidden"
          name="allow_admin_override"
          value={allowAdminOverride ? "true" : "false"}
        />
        {row.config.simple?.id ? (
          <input type="hidden" name="simple_rule_id" value={row.config.simple.id} />
        ) : null}
        {scheduleType === "simple" ? (
          <>
            <input
              type="hidden"
              name="is_enabled"
              value={isEnabled ? "true" : "false"}
            />
            <input type="hidden" name="rule_type" value={ruleType} />
          </>
        ) : null}

        <div className="min-w-0 space-y-4 px-4 py-5 sm:space-y-5 sm:px-6 sm:py-6">
          <EditorSectionBlock title="Schedule type">
            <ScheduleTypePicker value={scheduleType} onChange={setScheduleType} />
          </EditorSectionBlock>

          <EditorSectionBlock title="Access control">
            {scheduleType === "simple" ? (
              <PremiumToggleRow
                id={`access-toggle-${row.classId}`}
                title="Control parent report access"
                description="Parents below the requirement will not receive report cards until payment improves."
                checked={isEnabled}
                onChange={setIsEnabled}
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Enable individual {scheduleType === "term_based" ? "terms" : "months"} below. Disabled rows are ignored.
              </p>
            )}
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-zinc-600/80 dark:bg-zinc-900/60">
              <input
                type="checkbox"
                checked={allowAdminOverride}
                onChange={(e) => setAllowAdminOverride(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-zinc-300">
                Allow admin override when sending to parents
              </span>
            </label>
          </EditorSectionBlock>

          {scheduleType === "term_based" ? (
            <TermBasedEditor
              classId={row.classId}
              academicYear={academicYear}
              termCount={termCount}
              terms={terms}
              currency={currency}
              onAcademicYearChange={setAcademicYear}
              onTermCountChange={setTermCount}
              onTermsChange={setTerms}
            />
          ) : null}

          {scheduleType === "monthly_milestones" ? (
            <MonthlyMilestonesEditor
              classId={row.classId}
              academicYear={academicYear}
              months={months}
              onAcademicYearChange={setAcademicYear}
              onMonthsChange={setMonths}
            />
          ) : null}

          {scheduleType === "simple" ? (
            <>
              <EditorSectionBlock title="Requirement type">
                <RuleTypeSegmented value={ruleType} onChange={setRuleType} />
              </EditorSectionBlock>

              <EditorSectionBlock title="Requirement setup">
                {row.feeAssigned <= 0 ? (
                  <FeeZeroNote feeAssigned={row.feeAssigned} />
                ) : null}
                {ruleType === "percentage" ? (
                  <div className="space-y-2">
                    <label
                      htmlFor={`pct-${row.classId}`}
                      className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
                    >
                      Required percentage (0-100)
                    </label>
                    <input
                      id={`pct-${row.classId}`}
                      type="number"
                      name="required_percentage"
                      min={0}
                      max={100}
                      step={0.01}
                      value={requiredPercentage}
                      disabled={pctDisabled}
                      onChange={(e) =>
                        setRequiredPercentage(Number(e.target.value) || 0)
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950"
                    />
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                      {requirementExplanation(
                        row.feeAssigned,
                        ruleType,
                        requiredPercentage,
                        requiredAmount,
                        currency
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor={`amt-${row.classId}`}
                      className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
                    >
                      Required amount ({currency})
                    </label>
                    <input
                      id={`amt-${row.classId}`}
                      type="number"
                      name="required_amount"
                      min={0}
                      step={1}
                      value={requiredAmount}
                      onChange={(e) =>
                        setRequiredAmount(Number(e.target.value) || 0)
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    />
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                      {requirementExplanation(
                        row.feeAssigned,
                        ruleType,
                        requiredPercentage,
                        requiredAmount,
                        currency
                      )}
                    </p>
                  </div>
                )}
              </EditorSectionBlock>

              <EditorSectionBlock title="Calculation preview">
                <CalculationPreviewCard
                  feeAssigned={row.feeAssigned}
                  ruleType={ruleType}
                  requiredPercentage={requiredPercentage}
                  requiredAmount={requiredAmount}
                  currency={currency}
                />
              </EditorSectionBlock>

              <section className={editorBlockClass}>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                  Parent message
                </h4>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PARENT_MESSAGE_TEMPLATES.map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setMessageToParent(tpl)}
                        className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Template {i + 1}
                      </button>
                    ))}
                  </div>
                  <textarea
                    name="message_to_parent"
                    rows={3}
                    value={messageToParent}
                    onChange={(e) => setMessageToParent(e.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    aria-label="Message shown to parents when report card is blocked"
                  />
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    This message appears when parents cannot access report cards.
                  </p>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-school-primary px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900 sm:w-auto"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save rule
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ClassRowActions({
  open,
  onToggleEdit,
  onPreview,
  previewLoading,
}: {
  open: boolean;
  onToggleEdit: () => void;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
      <button
        type="button"
        onClick={onPreview}
        disabled={previewLoading}
        aria-label="Preview parent eligibility"
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:min-h-[40px] sm:w-auto sm:py-2"
      >
        {previewLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="whitespace-nowrap">Preview</span>
      </button>
      <button
        type="button"
        onClick={onToggleEdit}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 sm:min-h-0 sm:py-1.5",
          open
            ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            : "bg-school-primary text-white hover:brightness-105"
        )}
      >
        {open ? (
          <>
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Close
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
            Edit
          </>
        )}
      </button>
    </div>
  );
}

function FeeRuleClassCard({
  row,
  currency,
  onPreview,
  previewLoading,
}: {
  row: FeeRulesClassRow;
  currency: SchoolCurrencyCode;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        configToDisplayRule(row.config)?.isEnabled &&
          "ring-1 ring-emerald-200/60 dark:ring-emerald-900/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {row.className}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-zinc-400">
            Class fee: {formatCurrency(row.feeAssigned, currency)}
          </p>
          {row.feeAssigned <= 0 ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/90">
              Class fee not set yet.
            </p>
          ) : null}
        </div>
        <ParentAccessBadge
          config={row.config}
          currency={currency}
          feeAssigned={row.feeAssigned}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500 dark:text-zinc-500">Schedule</dt>
          <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
            {configScheduleLabel(row.config)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-zinc-500">
            Access rule
          </dt>
          <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
            {(() => {
              const d = configToDisplayRule(row.config);
              return d?.isEnabled
                ? requirementDisplay(
                    d.ruleType,
                    d.requiredPercentage ?? 0,
                    d.requiredAmount ?? 0,
                    currency
                  )
                : "—";
            })()}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <ClassRowActions
          open={open}
          onToggleEdit={() => setOpen((o) => !o)}
          onPreview={onPreview}
          previewLoading={previewLoading}
        />
      </div>

      {open ? (
        <div className="mt-4 min-w-0 border-t border-slate-100 pt-4 dark:border-zinc-800">
          <FeeRuleEditorPanel
            key={`${row.classId}-${editorConfigKey(row.config)}`}
            row={row}
            currency={currency}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </article>
  );
}

function FeeRuleTableRow({
  row,
  currency,
  onPreview,
  previewLoading,
}: {
  row: FeeRulesClassRow;
  currency: SchoolCurrencyCode;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={cn(
          "text-slate-800 transition-colors dark:text-zinc-200",
          "hover:bg-slate-50/70 dark:hover:bg-zinc-800/40",
          configToDisplayRule(row.config)?.isEnabled &&
            "border-l-2 border-l-emerald-500/70 bg-emerald-50/35 dark:border-l-emerald-600/60 dark:bg-emerald-950/15"
        )}
      >
        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
          {row.className}
        </td>
        <td className="px-4 py-4 tabular-nums">
          <span className="font-medium">
            {formatCurrency(row.feeAssigned, currency)}
          </span>
          {row.feeAssigned <= 0 ? (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200">
              Needs class fee
            </span>
          ) : null}
        </td>
        <td className="px-4 py-4 text-slate-600 dark:text-zinc-400">
          {configScheduleLabel(row.config)}
        </td>
        <td className="px-4 py-4 font-medium">
          {(() => {
            const d = configToDisplayRule(row.config);
            return d?.isEnabled
              ? requirementDisplay(
                  d.ruleType,
                  d.requiredPercentage ?? 0,
                  d.requiredAmount ?? 0,
                  currency
                )
              : "—";
          })()}
        </td>
        <td className="px-4 py-4">
          <ParentAccessBadge
            config={row.config}
            currency={currency}
            feeAssigned={row.feeAssigned}
          />
        </td>
        <td className="px-4 py-4">
          <ClassRowActions
            open={open}
            onToggleEdit={() => setOpen((o) => !o)}
            onPreview={onPreview}
            previewLoading={previewLoading}
          />
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} className="bg-slate-50/80 p-0 dark:bg-zinc-800/40">
            <div className="p-4 sm:p-5">
              <FeeRuleEditorPanel
                key={`${row.classId}-${editorConfigKey(row.config)}`}
                row={row}
                currency={currency}
                onClose={() => setOpen(false)}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function FeeRulesClient({
  classes,
  currency,
}: {
  classes: FeeRulesClassRow[];
  currency: SchoolCurrencyCode;
}) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<FeeRulesClassRow | null>(null);
  const [previewData, setPreviewData] = useState<FeeRulePreviewState | null>(
    null
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPreviewFetching, setIsPreviewFetching] = useState(false);
  const [previewYear, setPreviewYear] = useState(defaultAcademicYear());
  const [previewTerm, setPreviewTerm] = useState("Term 1");
  const [previewMonth, setPreviewMonth] = useState(
    new Date().getMonth() + 1
  );

  const buildPreviewParams = (row: FeeRulesClassRow): FeeRulePreviewParams => {
    if (row.config.scheduleType === "term_based") {
      return { academicYear: previewYear, term: previewTerm };
    }
    if (row.config.scheduleType === "monthly_milestones") {
      return { academicYear: previewYear, month: previewMonth };
    }
    return {};
  };

  const fetchPreview = async (row: FeeRulesClassRow) => {
    setIsPreviewFetching(true);
    try {
      const res = await previewClassFeeEligibilityAction(
        row.classId,
        buildPreviewParams(row)
      );
      setPreviewData(res);
      if (!res.ok) {
        toast.error(PREVIEW_LOAD_ERROR);
      }
    } catch {
      setPreviewData({ ok: false, error: PREVIEW_LOAD_ERROR });
      toast.error(PREVIEW_LOAD_ERROR);
    } finally {
      setIsPreviewFetching(false);
      setPreviewingId(null);
    }
  };

  const runPreview = async (row: FeeRulesClassRow) => {
    setPreviewingId(row.classId);
    setPreviewRow(row);
    setPreviewYear(row.config.academicYear || defaultAcademicYear());
    setPreviewTerm("Term 1");
    setPreviewMonth(new Date().getMonth() + 1);
    setPreviewOpen(true);
    setPreviewData(null);
    await fetchPreview(row);
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          No classes found. Add classes before configuring report card access
          rules.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="space-y-4 md:hidden">
        {classes.map((row) => (
          <FeeRuleClassCard
            key={row.classId}
            row={row}
            currency={currency}
            onPreview={() => runPreview(row)}
            previewLoading={
              isPreviewFetching && previewingId === row.classId
            }
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3.5">Class</th>
              <th className="px-4 py-3.5">Class fee</th>
              <th className="px-4 py-3.5">Schedule</th>
              <th className="px-4 py-3.5">Access rule</th>
              <th className="px-4 py-3.5">Report access</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {classes.map((row) => (
              <FeeRuleTableRow
                key={row.classId}
                row={row}
                currency={currency}
                onPreview={() => runPreview(row)}
                previewLoading={
                  isPreviewFetching && previewingId === row.classId
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <EligibilityPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewRow(null);
          setPreviewingId(null);
          setIsPreviewFetching(false);
        }}
        data={previewData}
        currency={currency}
        loading={isPreviewFetching}
        previewRow={previewRow}
        previewYear={previewYear}
        previewTerm={previewTerm}
        previewMonth={previewMonth}
        onPreviewYearChange={setPreviewYear}
        onPreviewTermChange={setPreviewTerm}
        onPreviewMonthChange={setPreviewMonth}
        onRecalculate={() => {
          if (previewRow) void fetchPreview(previewRow);
        }}
      />
    </>
  );
}
