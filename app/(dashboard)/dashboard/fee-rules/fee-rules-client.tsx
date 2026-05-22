"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  previewClassFeeEligibilityAction,
  saveReportCardFeeRuleAction,
  type FeeRuleActionState,
} from "./actions";
import { formatCurrency, type SchoolCurrencyCode } from "@/lib/currency";
import type { ReportCardFeeRuleType } from "@/lib/report-card-fee/types";

export type FeeRulesClassRow = {
  classId: string;
  className: string;
  feeAssigned: number;
  rule: {
    id: string;
    ruleType: ReportCardFeeRuleType;
    requiredPercentage: number | null;
    requiredAmount: number | null;
    isEnabled: boolean;
    allowAdminOverride: boolean;
    messageToParent: string;
  } | null;
};

function requirementLabel(row: FeeRulesClassRow, currency: SchoolCurrencyCode): string {
  if (!row.rule) return "—";
  if (row.rule.ruleType === "percentage") {
    return `${row.rule.requiredPercentage ?? 0}%`;
  }
  return formatCurrency(row.rule.requiredAmount ?? 0, currency);
}

export function FeeRulesClient({
  classes,
  currency,
}: {
  classes: FeeRulesClassRow[];
  currency: SchoolCurrencyCode;
}) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [preview, startPreview] = useTransition();

  const runPreview = (classId: string) => {
    setPreviewingId(classId);
    startPreview(async () => {
      const res = await previewClassFeeEligibilityAction(classId);
      setPreviewingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Eligible: ${res.eligibleCount} · Blocked: ${res.blockedCount} (of ${res.totalStudents} students)`,
        { duration: 6000 }
      );
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3">Class</th>
            <th className="px-4 py-3">Fee assigned</th>
            <th className="px-4 py-3">Rule type</th>
            <th className="px-4 py-3">Requirement</th>
            <th className="px-4 py-3">Parent access</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
          {classes.map((row) => (
            <FeeRuleRowEditor
              key={row.classId}
              row={row}
              currency={currency}
              requirement={requirementLabel(row, currency)}
              onPreview={() => runPreview(row.classId)}
              previewLoading={preview && previewingId === row.classId}
            />
          ))}
        </tbody>
      </table>
      {classes.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No classes found. Add classes before configuring fee rules.
        </p>
      ) : null}
    </div>
  );
}

function FeeRuleRowEditor({
  row,
  currency,
  requirement,
  onPreview,
  previewLoading,
}: {
  row: FeeRulesClassRow;
  currency: SchoolCurrencyCode;
  requirement: string;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<ReportCardFeeRuleType>(
    row.rule?.ruleType ?? "percentage"
  );
  const [state, formAction, pending] = useActionState<
    FeeRuleActionState | null,
    FormData
  >(saveReportCardFeeRuleAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message, { id: `fee-rule-${row.classId}` });
      setOpen(false);
    } else {
      toast.error(state.error, { id: `fee-rule-err-${row.classId}` });
    }
  }, [state, row.classId]);

  const parentAccess = row.rule?.isEnabled ? "Enabled" : "Disabled";

  return (
    <>
      <tr className="text-slate-800 dark:text-zinc-200">
        <td className="px-4 py-3 font-medium">{row.className}</td>
        <td className="px-4 py-3 tabular-nums">
          {formatCurrency(row.feeAssigned, currency)}
        </td>
        <td className="px-4 py-3 capitalize">
          {row.rule?.ruleType?.replace("_", " ") ?? "—"}
        </td>
        <td className="px-4 py-3">{requirement}</td>
        <td className="px-4 py-3">
          <span
            className={
              row.rule?.isEnabled
                ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
            }
          >
            {parentAccess}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={previewLoading}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {previewLoading ? (
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
              ) : (
                "Preview"
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="rounded-lg bg-school-primary px-2.5 py-1 text-xs font-semibold text-white hover:brightness-105"
            >
              {open ? "Close" : "Edit"}
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} className="bg-slate-50/80 px-4 py-4 dark:bg-zinc-800/40">
            <form action={formAction} className="mx-auto max-w-2xl space-y-4">
              <input type="hidden" name="class_id" value={row.classId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_enabled"
                    defaultChecked={row.rule?.isEnabled ?? false}
                    className="rounded border-slate-300"
                  />
                  Enable parent access rule
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="allow_admin_override"
                    defaultChecked={row.rule?.allowAdminOverride ?? true}
                    className="rounded border-slate-300"
                  />
                  Allow admin override on send
                </label>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  Rule type
                </span>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="rule_type"
                      value="percentage"
                      checked={ruleType === "percentage"}
                      onChange={() => setRuleType("percentage")}
                    />
                    Percentage
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="rule_type"
                      value="fixed_amount"
                      checked={ruleType === "fixed_amount"}
                      onChange={() => setRuleType("fixed_amount")}
                    />
                    Fixed amount
                  </label>
                </div>
              </div>
              {ruleType === "percentage" ? (
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">
                    Required percentage (0–100)
                  </span>
                  <input
                    type="number"
                    name="required_percentage"
                    min={0}
                    max={100}
                    step={0.01}
                    defaultValue={row.rule?.requiredPercentage ?? 70}
                    className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">
                    Required amount ({currency})
                  </span>
                  <input
                    type="number"
                    name="required_amount"
                    min={0}
                    step={1}
                    defaultValue={row.rule?.requiredAmount ?? 0}
                    className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  Message to parents (optional)
                </span>
                <textarea
                  name="message_to_parent"
                  rows={2}
                  defaultValue={
                    row.rule?.messageToParent ??
                    "Report card becomes available after completing required school fee payment."
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save rule
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
