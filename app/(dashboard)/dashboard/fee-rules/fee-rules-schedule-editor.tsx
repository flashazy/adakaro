"use client";

import { cn } from "@/lib/utils";
import type { SchoolCurrencyCode } from "@/lib/currency";
import type { ClassFeeRulesConfig } from "@/lib/report-card-fee/types";
import type { ReportCardFeeRuleType } from "@/lib/report-card-fee/types";
import type { ReportCardFeeScheduleType } from "@/lib/report-card-fee/schedule-types";
import {
  MONTH_LABELS,
  SCHEDULE_TYPE_OPTIONS,
  formatTermLabel,
} from "@/lib/report-card-fee/schedule-types";

export function ScheduleTypePicker({
  value,
  onChange,
}: {
  value: ReportCardFeeScheduleType;
  onChange: (v: ReportCardFeeScheduleType) => void;
}) {
  return (
    <div className="space-y-2">
      {SCHEDULE_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors",
            value === opt.id
              ? "border-school-primary bg-school-primary/5 ring-1 ring-school-primary/30"
              : "border-slate-200/90 bg-white hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
          )}
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {opt.label}
          </span>
          <span className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {opt.helper}
          </span>
        </button>
      ))}
    </div>
  );
}

export function RuleTypeMiniSegmented({
  value,
  onChange,
  idPrefix,
}: {
  value: ReportCardFeeRuleType;
  onChange: (v: ReportCardFeeRuleType) => void;
  idPrefix: string;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/80 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-900/80"
      role="group"
      aria-label="Requirement type"
    >
      {(["percentage", "fixed_amount"] as const).map((t) => (
        <button
          key={t}
          type="button"
          id={`${idPrefix}-${t}`}
          onClick={() => onChange(t)}
          className={cn(
            "min-h-[36px] rounded-md px-2 text-xs font-semibold",
            value === t
              ? "bg-school-primary text-white"
              : "text-slate-600 dark:text-zinc-400"
          )}
        >
          {t === "percentage" ? "%" : "Fixed"}
        </button>
      ))}
    </div>
  );
}

export function TermBasedEditor({
  classId,
  academicYear,
  termCount,
  terms,
  currency,
  onAcademicYearChange,
  onTermCountChange,
  onTermsChange,
}: {
  classId: string;
  academicYear: string;
  termCount: 2 | 3;
  terms: ClassFeeRulesConfig["terms"];
  currency: SchoolCurrencyCode;
  onAcademicYearChange: (y: string) => void;
  onTermCountChange: (n: 2 | 3) => void;
  onTermsChange: (t: ClassFeeRulesConfig["terms"]) => void;
}) {
  const visible = terms.slice(0, termCount);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50 p-5 dark:border-zinc-700/90 dark:bg-zinc-800/50 sm:p-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
        Term configuration
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`acy-${classId}`}
            className="text-xs font-medium text-slate-600 dark:text-zinc-400"
          >
            Academic year
          </label>
          <input
            id={`acy-${classId}`}
            type="text"
            inputMode="numeric"
            value={academicYear}
            onChange={(e) => onAcademicYearChange(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            School terms
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onTermCountChange(n)}
                className={cn(
                  "min-h-[44px] rounded-xl border text-sm font-semibold",
                  termCount === n
                    ? "border-school-primary bg-school-primary/10 text-school-primary"
                    : "border-slate-300 dark:border-zinc-600"
                )}
              >
                {n} terms
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {visible.map((row, idx) => (
          <div
            key={row.term}
            className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900/60"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatTermLabel(row.term)}
              </p>
              <label className="flex min-h-[44px] items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={row.isEnabled}
                  onChange={(e) => {
                    const copy = [...terms];
                    copy[idx] = { ...row, isEnabled: e.target.checked };
                    onTermsChange(copy);
                  }}
                />
                Enabled
              </label>
            </div>
            {row.isEnabled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <RuleTypeMiniSegmented
                  value={row.ruleType}
                  onChange={(ruleType) => {
                    const copy = [...terms];
                    copy[idx] = { ...row, ruleType };
                    onTermsChange(copy);
                  }}
                  idPrefix={`term-${classId}-${row.term}`}
                />
                {row.ruleType === "percentage" ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.requiredPercentage ?? ""}
                    onChange={(e) => {
                      const copy = [...terms];
                      copy[idx] = {
                        ...row,
                        requiredPercentage: Number(e.target.value) || 0,
                      };
                      onTermsChange(copy);
                    }}
                    placeholder="Required %"
                    className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={row.requiredAmount ?? ""}
                    onChange={(e) => {
                      const copy = [...terms];
                      copy[idx] = {
                        ...row,
                        requiredAmount: Number(e.target.value) || 0,
                      };
                      onTermsChange(copy);
                    }}
                    placeholder={`Amount (${currency})`}
                    className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MonthlyMilestonesEditor({
  classId,
  academicYear,
  months,
  onAcademicYearChange,
  onMonthsChange,
}: {
  classId: string;
  academicYear: string;
  months: ClassFeeRulesConfig["months"];
  onAcademicYearChange: (y: string) => void;
  onMonthsChange: (m: ClassFeeRulesConfig["months"]) => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50 p-5 dark:border-zinc-700/90 dark:bg-zinc-800/50 sm:p-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
        Monthly milestones
      </h4>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
        Only enabled months apply. If a month has no rule, the nearest earlier
        enabled milestone is used when sending report cards.
      </p>
      <div>
        <label
          htmlFor={`macy-${classId}`}
          className="text-xs font-medium text-slate-600 dark:text-zinc-400"
        >
          Academic year
        </label>
        <input
          id={`macy-${classId}`}
          type="text"
          inputMode="numeric"
          value={academicYear}
          onChange={(e) => onAcademicYearChange(e.target.value)}
          className="mt-1 w-full max-w-xs min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((row, idx) => (
          <div
            key={row.month}
            className={cn(
              "rounded-lg border px-3 py-2.5",
              row.isEnabled
                ? "border-school-primary/30 bg-school-primary/5 dark:bg-school-primary/10"
                : "border-slate-200/80 bg-white dark:border-zinc-600 dark:bg-zinc-900/50"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                {MONTH_LABELS[row.month - 1]}
              </span>
              <input
                type="checkbox"
                checked={row.isEnabled}
                onChange={(e) => {
                  const copy = [...months];
                  copy[idx] = { ...row, isEnabled: e.target.checked };
                  onMonthsChange(copy);
                }}
                aria-label={`Enable ${MONTH_LABELS[row.month - 1]}`}
              />
            </div>
            {row.isEnabled ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.requiredPercentage ?? ""}
                  onChange={(e) => {
                    const copy = [...months];
                    copy[idx] = {
                      ...row,
                      ruleType: "percentage",
                      requiredPercentage: Number(e.target.value) || 0,
                      requiredAmount: null,
                    };
                    onMonthsChange(copy);
                  }}
                  placeholder="%"
                  className="w-20 min-h-[36px] rounded-md border border-slate-300 px-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
                <span className="text-xs text-slate-500">required</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
