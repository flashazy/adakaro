"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertStatus = "open" | "resolved" | "ignored";
type AlertSeverity = "low" | "medium" | "high" | "critical";
type FilterKey = "all" | "critical" | "open" | "resolved" | "ignored";

interface HealthAlertItem {
  id: string;
  schoolId: string | null;
  schoolName: string | null;
  feature: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

interface HealthStats {
  open: number;
  critical: number;
  resolvedToday: number;
  lastChecked: string;
}

function severityBadge(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red-700 text-white";
    case "high":
      return "bg-red-600 text-white";
    case "medium":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function HealthCenterPanel() {
  const [filter, setFilter] = useState<FilterKey>("open");
  const [alerts, setAlerts] = useState<HealthAlertItem[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [checkRunning, setCheckRunning] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    ok: boolean;
    ranAt: string;
    checks: { id: string; label: string; ok: boolean; detail: string }[];
  } | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "critical") {
        params.set("severity", "critical");
        params.set("status", "open");
      } else if (filter !== "all") {
        params.set("status", filter);
      }
      const res = await fetch(
        `/api/super-admin/health/alerts?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        alerts?: HealthAlertItem[];
        stats?: HealthStats;
      };
      if (Array.isArray(body.alerts)) setAlerts(body.alerts);
      if (body.stats) setStats(body.stats);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const displayed = useMemo(() => {
    if (filter === "critical") {
      return alerts.filter(
        (a) => a.status === "open" && a.severity === "critical"
      );
    }
    return alerts;
  }, [alerts, filter]);

  const setStatus = async (id: string, status: AlertStatus) => {
    setActionId(id);
    try {
      const res = await fetch("/api/super-admin/health/alerts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) await fetchAlerts();
    } finally {
      setActionId(null);
    }
  };

  const runChecks = async () => {
    setCheckRunning(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/super-admin/health/checks", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok: boolean;
        ranAt: string;
        checks: { id: string; label: string; ok: boolean; detail: string }[];
      };
      setCheckResult(body);
      await fetchAlerts();
    } finally {
      setCheckRunning(false);
    }
  };

  const filterButtons: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "ignored", label: "Ignored" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-school-primary bg-school-primary/10 text-school-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void runChecks()}
          disabled={checkRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {checkRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Running checks…
            </>
          ) : (
            "Run health checks"
          )}
        </button>
      </div>

      {checkResult ? (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            checkResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
          )}
        >
          <p className="font-semibold">
            Health checks {checkResult.ok ? "passed" : "found issues"} —{" "}
            {formatTime(checkResult.ranAt)}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {checkResult.checks.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.ok ? "✓" : "✗"}</span>{" "}
                {c.label}: {c.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Loading alerts…</p>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            No active alerts — monitored systems are healthy.
          </p>
          {stats?.lastChecked ? (
            <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/80">
              Last checked {formatTime(stats.lastChecked)}
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {displayed.map((alert) => (
            <li
              key={alert.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
                        severityBadge(alert.severity)
                      )}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      {alert.feature}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        alert.status === "open"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                      )}
                    >
                      {alert.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                    {alert.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                    {alert.schoolName ? (
                      <span>School: {alert.schoolName} · </span>
                    ) : null}
                    Last seen {formatTime(alert.lastSeenAt)}
                  </p>
                </div>
                {alert.status === "open" ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      disabled={actionId === alert.id}
                      onClick={() => void setStatus(alert.id, "resolved")}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={actionId === alert.id}
                      onClick={() => void setStatus(alert.id, "ignored")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Ignore
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
