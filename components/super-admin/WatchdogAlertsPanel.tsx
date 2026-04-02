"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  clearAlert,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/watchdog/alerts.store";
import type { WatchdogAlert, WatchdogSeverity } from "@/watchdog/types";

function severityStyles(severity: WatchdogSeverity): string {
  switch (severity) {
    case "high":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200";
  }
}

function severityBadgeClass(severity: WatchdogSeverity): string {
  switch (severity) {
    case "high":
      return "bg-red-600 text-white";
    case "medium":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(ts);
  }
}

export function WatchdogAlertsPanel() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const sorted = useMemo(
    () => [...list].sort((a, b) => b.timestamp - a.timestamp),
    [list]
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          No alerts — all monitored signals are within expected behavior.
        </p>
        <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/80">
          Alerts appear when <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/40">trackEvent()</code>{" "}
          reports a rule mismatch.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((alert: WatchdogAlert) => (
        <li
          key={alert.id}
          className={`rounded-xl border p-4 shadow-sm ${severityStyles(alert.severity)}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(alert.severity)}`}
                >
                  {alert.severity}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {alert.feature}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium leading-snug">
                {alert.description}
              </p>
              <p className="mt-2 text-xs opacity-75">
                Role:{" "}
                <span className="font-medium">{alert.affected_role}</span>
                {" · "}
                {formatTime(alert.timestamp)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => clearAlert(alert.id)}
              className="shrink-0 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
