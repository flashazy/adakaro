"use client";

import { cn } from "@/lib/utils";
import { Megaphone } from "lucide-react";
import type { ReactNode } from "react";

export const BROADCAST_TITLE_MAX = 120;
export const BROADCAST_MESSAGE_MAX = 1000;

export function BroadcastKpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="flex h-full min-h-[7.5rem] flex-col rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:border-indigo-500/20 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="min-h-[2rem] shrink-0 text-xs font-medium leading-snug text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 flex min-h-[2rem] shrink-0 items-center text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-auto min-h-[2rem] pt-2 text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
        {helper ?? "\u00a0"}
      </p>
    </div>
  );
}

export function PrioritySelector({
  isUrgent,
  onChange,
}: {
  isUrgent: boolean;
  onChange: (urgent: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
        Message priority
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left transition-colors",
            !isUrgent
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-500/70 dark:bg-blue-950/35 dark:ring-blue-800/50"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
          )}
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            Normal Message
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Standard dashboard notice
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left transition-colors",
            isUrgent
              ? "border-red-500 bg-red-50 ring-1 ring-red-200 dark:border-red-500/70 dark:bg-red-950/35 dark:ring-red-900/50"
              : "border-slate-200 bg-white hover:bg-red-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/10"
          )}
        >
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Urgent Message
          </p>
          <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-300/80">
            Highlighted across dashboards
          </p>
        </button>
      </div>
      {isUrgent ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200"
          role="status"
        >
          This message will be highlighted across all school dashboards.
        </div>
      ) : null}
    </div>
  );
}

export function BroadcastPreviewPanel({
  title,
  message,
  isUrgent,
  recipientName = null,
  showDeliveryMeta = false,
}: {
  title: string;
  message: string;
  isUrgent: boolean;
  recipientName?: string | null;
  showDeliveryMeta?: boolean;
}) {
  const hasTitle = title.trim().length > 0;
  const hasMessage = message.trim().length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        <span aria-hidden>📢 </span>
        Message Preview
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        How school admins will see this on their dashboard
      </p>

      {showDeliveryMeta && recipientName ? (
        <dl className="mt-4 grid gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Recipient
            </dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {recipientName}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Priority
            </dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {isUrgent ? "Urgent" : "Normal"}
            </dd>
          </div>
        </dl>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-xl border shadow-sm",
          showDeliveryMeta && recipientName ? "mt-4" : "mt-5",
          isUrgent
            ? "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
            : "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/60"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b px-4 py-2.5",
            isUrgent
              ? "border-red-100 bg-red-100/60 dark:border-red-900/40 dark:bg-red-950/50"
              : "border-slate-100 bg-slate-50 dark:border-zinc-700/80 dark:bg-zinc-800/80"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Dashboard notice
          </p>
          {isUrgent ? (
            <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/80 dark:text-red-200">
              Urgent
            </span>
          ) : (
            <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-700 dark:text-zinc-200">
              Normal
            </span>
          )}
        </div>
        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              Title
            </p>
            <p
              className={cn(
                "mt-1.5 text-sm font-semibold leading-snug",
                hasTitle
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400/90 italic dark:text-zinc-500"
              )}
            >
              {hasTitle ? title.trim() : "Broadcast title will appear here"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              Body
            </p>
            <p
              className={cn(
                "mt-1.5 min-h-[4.5rem] whitespace-pre-wrap text-sm leading-relaxed",
                hasMessage
                  ? "text-slate-700 dark:text-zinc-300"
                  : "text-slate-400/90 italic dark:text-zinc-500"
              )}
            >
              {hasMessage
                ? message.trim()
                : "Your message preview will update as you type."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BroadcastEmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
        aria-hidden
      >
        <Megaphone className="h-8 w-8" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-950 dark:text-zinc-50">
        No Broadcast Messages Yet
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-zinc-400">
        Broadcasts sent by Super Admin will appear here for future reference.
      </p>
      <ul className="mt-5 space-y-1.5 text-left text-xs text-slate-400 dark:text-zinc-500">
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-slate-300 dark:text-zinc-600">
            •
          </span>
          Broadcast delivery history
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-slate-300 dark:text-zinc-600">
            •
          </span>
          Message priority tracking
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-slate-300 dark:text-zinc-600">
            •
          </span>
          Sent timestamps and audit trail
        </li>
      </ul>
    </div>
  );
}

export function FieldLabelRow({
  htmlFor,
  label,
  counter,
}: {
  htmlFor: string;
  label: string;
  counter: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-zinc-500">
        {counter}
      </span>
    </div>
  );
}

export function PriorityBadge({ urgent }: { urgent: boolean }) {
  if (urgent) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800/50">
        Urgent
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/50">
      Normal
    </span>
  );
}

export function StatusBadge() {
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/50">
      Delivered
    </span>
  );
}

export function BroadcastSectionCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {subtitle}
        </p>
      ) : null}
      <div className="flex-1">{children}</div>
      {footer ? (
        <p className="mt-4 text-right text-[11px] text-slate-400 dark:text-zinc-500">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

export function formatBroadcastDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatRelativeBroadcastTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  }

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) {
    return diffWeek === 1 ? "1 week ago" : `${diffWeek} weeks ago`;
  }

  return formatBroadcastDate(iso);
}
