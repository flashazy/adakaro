"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Database } from "@/types/supabase";

type LogRow = Database["public"]["Tables"]["admin_activity_logs"]["Row"];

interface ActivityLogsResponse {
  logs: LogRow[];
  total: number;
  page: number;
  pageSize: number;
  schoolNames: Record<string, string>;
}

const PAGE_SIZE = 50;

const ACTION_SUGGESTIONS = [
  "",
  "update_plan",
  "suspend_school",
  "activate_school",
  "edit_school",
  "create_school",
  "invite_school_admin",
  "import_students_bulk",
  "create_student",
  "update_student",
  "delete_student",
  "record_payment",
  "create_fee_structure",
  "update_fee_structure",
  "delete_fee_structure",
  "create_class",
  "update_class",
  "delete_class",
  "review_upgrade_request",
  "school_member_role_change",
  "school_member_removed",
  "resend_school_invitation",
];

export function ActivityLogsClient() {
  const [user, setUser] = useState("");
  const [school, setSchool] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivityLogsResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (user.trim()) params.set("user", user.trim());
      if (school.trim()) params.set("school", school.trim());
      if (action.trim()) params.set("action", action.trim());
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());

      const res = await fetch(`/api/super-admin/activity-logs?${params}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as ActivityLogsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Failed to load logs.");
      }
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, user, school, action, from, to]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (user.trim()) params.set("user", user.trim());
    if (school.trim()) params.set("school", school.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    window.location.href = `/api/super-admin/activity-logs?${params}`;
  }

  const totalPages =
    data && data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Activity logs
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Audit trail of admin actions across the platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/super-admin"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
            User email contains
            <input
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Search"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
            School (name or ID)
            <input
              value={school}
              onChange={(e) => {
                setSchool(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Filter"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
            Action
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {ACTION_SUGGESTIONS.map((a) => (
                <option key={a || "any"} value={a}>
                  {a || "Any"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
            From (date)
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
            To (date)
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void fetchLogs()}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-zinc-800">
          <thead className="bg-slate-50 dark:bg-zinc-950/50">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                Time
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                User
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                Role
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                School
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                Action
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : !data?.logs.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No logs match your filters.
                </td>
              </tr>
            ) : (
              data.logs.map((row) => {
                const schoolLabel = row.school_id
                  ? data.schoolNames[row.school_id] ?? row.school_id.slice(0, 8) + "…"
                  : "—";
                const isOpen = expanded.has(row.id);
                const detailsStr = JSON.stringify(row.action_details ?? {}, null, 2);
                return (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-zinc-300">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-slate-800 dark:text-zinc-200">
                      {row.user_email || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-zinc-300">
                      {row.user_role}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-slate-700 dark:text-zinc-300">
                      {schoolLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900 dark:text-white">
                      {row.action}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="text-left text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {isOpen ? "Hide JSON" : "Show JSON"}
                      </button>
                      {isOpen ? (
                        <pre className="mt-2 max-h-48 max-w-xl overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-800 dark:bg-zinc-950 dark:text-zinc-200">
                          {detailsStr}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-zinc-400">
          <span>
            Page {page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-600"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
