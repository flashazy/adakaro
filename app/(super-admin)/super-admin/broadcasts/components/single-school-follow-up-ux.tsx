"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { binaryPlanLabel } from "@/lib/plans";
import { schoolLifecycleStatusLabel } from "@/lib/super-admin/school-lifecycle";
import type { SchoolIntelligenceContextPayload } from "@/lib/super-admin/smart-intelligence-navigation";
import type { SmartIntelligenceSource } from "@/lib/super-admin/smart-intelligence-navigation";
import {
  formatFollowUpDateTime,
  getExpectedOutcomes,
  getFollowUpSendButtonLabel,
  getFollowUpSendLoadingLabel,
  getFollowUpTypeLabel,
  getRiskSeverityLabel,
  getRiskTypeLabel,
  getSmartMessageSources,
  riskSeverityBadgeClass,
  scoreSummaryBarClass,
  type PreviousFollowUpItem,
  type RiskSeverityLabel,
  type SchoolScoreSummary,
} from "@/lib/super-admin/school-follow-up-presentation";
import { cn } from "@/lib/utils";
import { AlertTriangle, Building2, Check, History } from "lucide-react";

function ScoreSummaryStrip({
  summary,
  loading = false,
}: {
  summary: SchoolScoreSummary | null;
  loading?: boolean;
}) {
  if (loading && !summary) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
        <p className="text-xs text-amber-800/70 dark:text-amber-200/70">
          Loading score summary…
        </p>
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
          {summary.label}:{" "}
          <span className="tabular-nums">
            {summary.value}/{summary.max}
          </span>
        </p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-900/40"
        role="progressbar"
        aria-valuenow={summary.barPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${summary.label}: ${summary.value} out of ${summary.max}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            scoreSummaryBarClass(summary.tone)
          )}
          style={{ width: `${summary.barPercent}%` }}
        />
      </div>
    </div>
  );
}

export function SmartMessageSourceLine({
  source,
}: {
  source: SmartIntelligenceSource;
}) {
  const sources = getSmartMessageSources(source);

  return (
    <div className="mb-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
        Generated from
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {sources.map((label) => (
          <li
            key={label}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400"
          >
            <Check
              className="h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400"
              aria-hidden
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SchoolFollowUpContextCard({
  schoolName,
  context,
  source,
  riskLevel,
  riskScore,
  loading = false,
}: {
  schoolName: string;
  context: SchoolIntelligenceContextPayload["school"] | null;
  source: SmartIntelligenceSource;
  riskLevel?: string;
  riskScore?: number;
  loading?: boolean;
}) {
  const displayName = context?.name || schoolName || "Selected school";
  const plan = context ? binaryPlanLabel(context.plan) : null;
  const status = context
    ? schoolLifecycleStatusLabel(
        context.status as Parameters<typeof schoolLifecycleStatusLabel>[0]
      )
    : null;
  const students =
    context?.studentCount !== undefined
      ? context.studentCount.toLocaleString()
      : null;
  const riskType = getRiskTypeLabel(source, riskLevel);
  const severity = getRiskSeverityLabel(riskLevel, riskScore);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Building2 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
            School context
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {loading && !displayName ? "Loading school…" : displayName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200">
                {plan} Plan
              </span>
            ) : null}
            {status ? (
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                {status}
              </span>
            ) : null}
            {students !== null ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                {students} Students
              </span>
            ) : null}
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              {riskType}
            </span>
            {severity ? (
              <SeverityBadge severity={severity} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RiskSeverityLabel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        riskSeverityBadgeClass(severity)
      )}
    >
      {severity}
    </span>
  );
}

export function AttentionSignalsCard({
  signals,
  scoreSummary = null,
  scoreSummaryLoading = false,
  loading = false,
}: {
  signals: string[];
  scoreSummary?: SchoolScoreSummary | null;
  scoreSummaryLoading?: boolean;
  loading?: boolean;
}) {
  const hasSignals = signals.length > 0;

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
          Why this school needs attention
        </p>
      </div>
      <ScoreSummaryStrip summary={scoreSummary} loading={scoreSummaryLoading} />
      {loading ? (
        <p className="mt-2 text-sm text-amber-800/80 dark:text-amber-200/80">
          Loading attention signals…
        </p>
      ) : hasSignals ? (
        <ul className="mt-2.5 space-y-1.5">
          {signals.map((signal) => (
            <li
              key={signal}
              className="flex items-start gap-2 text-sm text-amber-950/90 dark:text-amber-100/90"
            >
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              {signal}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/80">
          No significant risk signals detected.
        </p>
      )}
    </div>
  );
}

export function RecipientBreakdownCard({
  counts,
}: {
  counts: { admins: number; teachers: number; parents: number; total: number };
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/25">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        Recipients
      </p>
      <dl className="mt-2 grid gap-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600 dark:text-zinc-400">School Admins</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {counts.admins}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600 dark:text-zinc-400">Teachers</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {counts.teachers}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600 dark:text-zinc-400">Parents</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {counts.parents}
          </dd>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-indigo-100 pt-2 dark:border-indigo-900/40">
          <dt className="font-medium text-slate-700 dark:text-zinc-300">
            Total Recipients
          </dt>
          <dd className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
            {counts.total}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ExpectedOutcomePanel({
  source,
}: {
  source: SmartIntelligenceSource;
}) {
  const outcomes = getExpectedOutcomes(source);

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
        Expected Outcome
      </p>
      <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/80">
        If this school responds positively:
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {outcomes.map((outcome) => (
          <li
            key={outcome}
            className="flex items-start gap-2 text-sm text-emerald-950/90 dark:text-emerald-100/90"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            {outcome}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreviousFollowUpsPanel({
  items,
  loading = false,
}: {
  items: PreviousFollowUpItem[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 dark:border-zinc-700 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" aria-hidden />
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Previous Follow-Ups
        </p>
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Loading history…</p>
      ) : items.length === 0 ? (
        <div className="mt-2.5 space-y-1">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            No previous follow-ups recorded.
          </p>
          <p className="text-sm text-slate-500 dark:text-zinc-500">
            This will be the first outreach to this school.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-zinc-700">
          {items.map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-xs font-medium tabular-nums text-slate-500 dark:text-zinc-400">
                {formatFollowUpDateTime(item.sentAt)}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {item.typeLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Sent by {item.sentBy ?? "Super Admin"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SendFollowUpConfirmModal({
  open,
  schoolName,
  source,
  sending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  schoolName: string;
  source: SmartIntelligenceSource;
  sending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onCancel]);

  if (!open || !mounted) return null;

  const typeLabel = getFollowUpTypeLabel(source);
  const confirmLabel = getFollowUpSendButtonLabel(source);
  const loadingLabel = getFollowUpSendLoadingLabel(source);

  const node = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!sending) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Send Follow-Up?
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recipient
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {schoolName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {typeLabel}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
          This message will be delivered immediately to school administrators.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={onConfirm}
            className={cn(
              "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            )}
          >
            {sending ? loadingLabel : "Send Now"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
