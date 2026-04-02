"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  clearAllAlerts,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/watchdog/alerts.store";
import { WatchdogAlertsPanel } from "@/components/super-admin/WatchdogAlertsPanel";

export default function SuperAdminWatchdogPage() {
  const alerts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const stats = useMemo(() => {
    const total = alerts.length;
    const critical = alerts.filter((a) => a.severity === "high").length;
    return { total, critical };
  }, [alerts]);

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Watchdog monitoring
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Non-intrusive observer — events from{" "}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-zinc-800">
                trackEvent()
              </code>{" "}
              only
            </p>
          </div>
          <Link
            href="/super-admin"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to Super Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Total alerts
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {stats.total}
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              stats.critical > 0
                ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Critical (high severity)
            </p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                stats.critical > 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {stats.critical}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Alerts
          </h2>
          {stats.total > 0 ? (
            <button
              type="button"
              onClick={() => clearAllAlerts()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Clear all
            </button>
          ) : null}
        </div>

        <WatchdogAlertsPanel />
      </main>
    </>
  );
}
