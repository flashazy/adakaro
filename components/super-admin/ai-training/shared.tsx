"use client";

import { cn } from "@/lib/utils";
import type { HealthStatus, QualityLevel } from "@/lib/ai-training/types";
import {
  healthStatusLabel,
  qualityLabel,
} from "@/lib/ai-training/scoring";

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const qualityStyles: Record<QualityLevel, string> = {
  excellent: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  good: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  needs_improvement: "bg-amber-50 text-amber-800 ring-amber-200",
};

const healthStyles: Record<HealthStatus, string> = {
  excellent: "from-emerald-500 to-teal-600",
  good: "from-indigo-500 to-violet-600",
  needs_training: "from-amber-500 to-orange-600",
};

export function QualityBadge({
  level,
  score,
}: {
  level: QualityLevel;
  score?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        qualityStyles[level]
      )}
    >
      {qualityLabel(level)}
      {score != null ? ` · ${score}%` : null}
    </span>
  );
}

export function AIHealthScoreCard({
  score,
  status,
  breakdown,
}: {
  score: number;
  status: HealthStatus;
  breakdown?: {
    coveragePercent: number;
    knowledgeEntries: number;
    unansweredQuestions: number;
  };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          healthStyles[status]
        )}
      />
      <p className="text-sm font-medium text-slate-500">AI Health Score</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-4xl font-extrabold tabular-nums tracking-tight text-slate-950">
          {score}%
        </p>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold text-white",
            status === "excellent"
              ? "bg-emerald-600"
              : status === "good"
                ? "bg-indigo-600"
                : "bg-amber-600"
          )}
        >
          {healthStatusLabel(status)}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", healthStyles[status])}
          style={{ width: `${score}%` }}
        />
      </div>
      {breakdown ? (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          <div className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Coverage
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
              {breakdown.coveragePercent}%
            </p>
          </div>
          <div className="border-x border-slate-100 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Entries
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
              {breakdown.knowledgeEntries}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Unanswered
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
              {breakdown.unansweredQuestions}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
  );
}

function TrendChartPlaceholder({ barClass = "bg-indigo-500/80" }: { barClass?: string }) {
  const heights = [28, 45, 35, 60, 40, 55, 32, 48, 38, 52, 42, 58, 36, 50];
  return (
    <div
      className="pointer-events-none mt-5 flex h-36 items-end gap-1.5 opacity-[0.12]"
      aria-hidden
    >
      {heights.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn("w-full rounded-t-md", barClass)}
            style={{ height: `${h}%` }}
          />
          <span className="text-[9px] text-slate-300">—</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBarPlaceholder() {
  const widths = [72, 55, 88, 42, 65];
  const labels = ["—", "—", "—", "—", "—"];
  return (
    <ul className="pointer-events-none mt-4 space-y-3 opacity-[0.12]" aria-hidden>
      {widths.map((w, i) => (
        <li key={i}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-400">{labels[i]}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500/80"
              style={{ width: `${w}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HorizontalBarChart({
  title,
  subtitle,
  items,
  valueKey,
  labelKey,
  suffix = "",
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  suffix?: string;
  emptyMessage?: string;
}) {
  const isEmpty = items.length === 0;
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey] ?? 0)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      {isEmpty && emptyMessage ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{emptyMessage}</p>
          <HorizontalBarPlaceholder />
        </>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const value = Number(item[valueKey] ?? 0);
            const label = String(item[labelKey]);
            return (
              <li key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate font-medium text-slate-700">{label}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {value}
                    {suffix}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500/80"
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TrendChart({
  title,
  data,
  barClass = "bg-indigo-500/80",
  emptyMessage,
}: {
  title: string;
  data: Array<{ date: string; count: number }>;
  barClass?: string;
  emptyMessage?: string;
}) {
  const isEmpty = data.length === 0 || data.every((d) => d.count === 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      {isEmpty && emptyMessage ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{emptyMessage}</p>
          <TrendChartPlaceholder barClass={barClass} />
        </>
      ) : (
        <div className="mt-5 flex h-36 items-end gap-1.5">
          {data.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn("w-full rounded-t-md transition-all", barClass)}
                style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
                title={`${point.date}: ${point.count}`}
              />
              <span className="text-[9px] text-slate-400">{point.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
