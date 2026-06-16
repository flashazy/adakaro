"use client";

import { useCallback, useEffect, useState } from "react";
import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";

interface HealthStats {
  open: number;
  critical: number;
  resolvedToday: number;
  lastChecked: string;
}

import { HealthCenterPanel } from "@/components/super-admin/HealthCenterPanel";

export default function SuperAdminHealthCenterPage() {
  const [stats, setStats] = useState<HealthStats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/health/alerts?status=open", {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { stats?: HealthStats };
      if (body.stats) setStats(body.stats);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Adakaro Health Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Persistent monitoring for critical school workflows and platform
              health.
            </p>
          </div>
          <SuperAdminNavLink
            href="/super-admin"
            loadingLabel="Loading…"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to Super Admin
          </SuperAdminNavLink>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open alerts" value={stats?.open ?? "—"} />
          <StatCard
            label="Critical alerts"
            value={stats?.critical ?? "—"}
            highlight={(stats?.critical ?? 0) > 0}
          />
          <StatCard label="Resolved today" value={stats?.resolvedToday ?? "—"} />
          <StatCard
            label="Last checked"
            value={
              stats?.lastChecked
                ? new Date(stats.lastChecked).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"
            }
            small
          />
        </div>

        <HealthCenterPanel />
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  small = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        highlight
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tabular-nums text-slate-900 dark:text-white ${
          small ? "text-base" : "text-3xl"
        } ${highlight ? "text-red-700 dark:text-red-300" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
