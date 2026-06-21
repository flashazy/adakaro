"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SuperAdminExportLink,
  SuperAdminNavLink,
} from "@/components/super-admin/super-admin-loading-action";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { schoolInitials } from "@/lib/super-admin/contacts-utils";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type LogRow = Database["public"]["Tables"]["admin_activity_logs"]["Row"];

interface ActivityLogsSummary {
  activeSchools: number;
  activeUsers: number;
  todayActivity: number;
  mostRecentAt: string | null;
}

interface ActivityLogsResponse {
  logs: LogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  schoolNames: Record<string, string>;
  availableActions: string[];
  summary: ActivityLogsSummary;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100] as const;

const ACTION_LABELS: Record<string, string> = {
  activate_school: "School Activated",
  apply_class_promotions: "Apply Class Promotions",
  approve_student: "Student Approved",
  archive_school: "School Archived",
  archive_student: "Student Archived",
  bulk_approve_students: "Bulk Student Approval",
  bulk_create_classes: "Bulk Create Classes",
  create_class: "Class Created",
  create_fee_structure: "Fee Structure Created",
  create_school: "School Created",
  create_student: "Student Created",
  delete_class: "Class Deleted",
  delete_fee_structure: "Fee Structure Deleted",
  delete_school_permanently: "School Deleted Permanently",
  delete_student: "Student Deleted",
  edit_school: "School Updated",
  import_students_bulk: "Bulk Student Import",
  invite_school_admin: "School Admin Invited",
  record_payment: "Payment Recorded",
  reject_student: "Student Rejected",
  resend_school_invitation: "Invitation Resent",
  restore_school: "School Restored",
  review_upgrade_request: "Upgrade Request Reviewed",
  school_member_removed: "Member Removed",
  school_member_role_change: "Role Changed",
  suspend_school: "School Suspended",
  update_class: "Class Updated",
  update_fee_structure: "Fee Structure Updated",
  update_plan: "Plan Updated",
  update_student: "Student Updated",
};

const EMPTY_SUMMARY: ActivityLogsSummary = {
  activeSchools: 0,
  activeUsers: 0,
  todayActivity: 0,
  mostRecentAt: null,
};

function formatLogTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

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
  if (diffDay < 7) {
    return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  }

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) {
    return diffWeek === 1 ? "1 week ago" : `${diffWeek} weeks ago`;
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return diffMonth === 1 ? "1 month ago" : `${diffMonth} months ago`;
  }

  const diffYear = Math.floor(diffDay / 365);
  return diffYear === 1 ? "1 year ago" : `${diffYear} years ago`;
}

function RelativeTimeHelper({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(formatRelativeTime(iso));
  }, [iso]);

  if (!label) return null;

  return (
    <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-zinc-500">
      {label}
    </span>
  );
}

function formatActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  const parts = action.split("_").filter(Boolean);
  if (parts.length === 0) return action;

  const verb = parts[0];
  const rest = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  if (verb === "create") return `${rest.join(" ")} Created`;
  if (verb === "update" || verb === "edit") return `${rest.join(" ")} Updated`;
  if (verb === "delete" || verb === "remove") return `${rest.join(" ")} Deleted`;
  if (verb === "approve") return `${rest.join(" ")} Approved`;
  if (verb === "reject") return `${rest.join(" ")} Rejected`;
  if (verb === "bulk") return `Bulk ${rest.join(" ")}`;

  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function ActionFilterSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
    >
      <option value="">Any action</option>
      {options.map((actionValue) => (
        <option key={actionValue} value={actionValue}>
          {formatActionLabel(actionValue)}
        </option>
      ))}
    </select>
  );
}

const ACTION_BADGE_CATEGORY = {
  create:
    "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/50",
  update:
    "bg-blue-100 text-blue-800 ring-blue-200/80 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-800/50",
  bulk:
    "bg-purple-100 text-purple-800 ring-purple-200/80 dark:bg-purple-950/50 dark:text-purple-200 dark:ring-purple-800/50",
  system:
    "bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/50",
  delete:
    "bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800/50",
} as const;

function getActionBadgeClass(action: string): string {
  if (
    action.startsWith("delete_") ||
    action.includes("removed") ||
    action === "suspend_school"
  ) {
    return ACTION_BADGE_CATEGORY.delete;
  }
  if (action.startsWith("create_") || action === "create_school") {
    return ACTION_BADGE_CATEGORY.create;
  }
  if (
    action.startsWith("update_") ||
    action.startsWith("edit_") ||
    action === "activate_school" ||
    action === "record_payment"
  ) {
    return ACTION_BADGE_CATEGORY.update;
  }
  if (action.startsWith("bulk_") || action.includes("bulk")) {
    return ACTION_BADGE_CATEGORY.bulk;
  }
  if (action.includes("role")) {
    return ACTION_BADGE_CATEGORY.system;
  }
  return "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/50";
}

function isHighRiskAction(action: string): boolean {
  return (
    action.startsWith("delete_") ||
    action.startsWith("remove_") ||
    action.includes("role_change") ||
    action.startsWith("school_suspend_") ||
    action.includes("billing_change") ||
    action === "suspend_school" ||
    action === "school_member_removed"
  );
}

function formatRoleLabel(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function AuditKpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        getActionBadgeClass(action)
      )}
    >
      {formatActionLabel(action)}
    </span>
  );
}

const ACTION_TYPE_LEGEND = [
  { label: "Create", className: ACTION_BADGE_CATEGORY.create },
  { label: "Update", className: ACTION_BADGE_CATEGORY.update },
  { label: "Bulk", className: ACTION_BADGE_CATEGORY.bulk },
  { label: "System", className: ACTION_BADGE_CATEGORY.system },
  { label: "Delete", className: ACTION_BADGE_CATEGORY.delete },
] as const;

function ActivityTypeLegend() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Activity type legend"
    >
      <div className="flex flex-wrap items-center gap-2">
        {ACTION_TYPE_LEGEND.map((item) => (
          <span
            key={item.label}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
              item.className
            )}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SchoolCell({ label }: { label: string }) {
  if (label === "—") {
    return <span className="text-slate-500 dark:text-zinc-400">—</span>;
  }

  const letter =
    schoolInitials(label).charAt(0) ||
    label.trim().charAt(0).toUpperCase() ||
    "?";

  return (
    <div className="flex min-w-0 max-w-[14rem] items-center gap-2.5">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold uppercase text-indigo-700 ring-1 ring-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-800/50"
        aria-hidden
      >
        {letter}
      </div>
      <span className="truncate text-slate-700 dark:text-zinc-300" title={label}>
        {label}
      </span>
    </div>
  );
}

function DetailsGhostButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        saBtnSecondarySm,
        "border-slate-200/80 bg-transparent text-slate-600 shadow-none hover:bg-slate-100 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
      )}
    >
      {isOpen ? "Hide Details" : "View Details"}
    </button>
  );
}

function UserCell({ email, role }: { email: string | null; role: string }) {
  return (
    <div className="min-w-0 max-w-[12rem]">
      <p className="truncate font-medium text-slate-800 dark:text-zinc-200">
        {email || "—"}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        {formatRoleLabel(role)}
      </p>
    </div>
  );
}

function TimestampCell({ iso }: { iso: string }) {
  return (
    <div className="whitespace-nowrap">
      <span className="text-slate-700 dark:text-zinc-300">
        {formatLogTimestamp(iso)}
      </span>
      <RelativeTimeHelper iso={iso} />
    </div>
  );
}

function AuditInsightStrip({
  total,
  activeSchools,
  mostRecentAt,
}: {
  total: number;
  activeSchools: number;
  mostRecentAt: string | null;
}) {
  const [recentLabel, setRecentLabel] = useState<string | null>(null);

  useEffect(() => {
    if (mostRecentAt) {
      setRecentLabel(formatRelativeTime(mostRecentAt));
    } else {
      setRecentLabel(null);
    }
  }, [mostRecentAt]);

  if (total === 0) return null;

  return (
    <div
      className="rounded-lg bg-slate-100/80 px-3 py-2 text-sm text-slate-700 dark:bg-zinc-800/50 dark:text-zinc-300"
      role="status"
    >
      {total.toLocaleString("en-US")} audit record{total === 1 ? "" : "s"}{" "}
      across {activeSchools.toLocaleString("en-US")} school
      {activeSchools === 1 ? "" : "s"}.
      {recentLabel ? (
        <>
          {" "}
          Most recent activity occurred {recentLabel}.
        </>
      ) : null}
    </div>
  );
}

function AuditEmptyState() {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
        No matching activity found
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Try adjusting filters or date range.
      </p>
    </div>
  );
}

export function ActivityLogsClient() {
  const [user, setUser] = useState("");
  const [school, setSchool] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] =
    useState<(typeof ROWS_PER_PAGE_OPTIONS)[number]>(20);
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
      params.set("limit", String(limit));
      if (user.trim()) params.set("user", user.trim());
      if (school.trim()) params.set("school", school.trim());
      if (action.trim()) params.set("action", action.trim());
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());

      const res = await fetch(`/api/super-admin/activity-logs?${params}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as ActivityLogsResponse & {
        error?: string;
      };
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
  }, [page, limit, user, school, action, from, to]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!data || data.totalPages <= 0) return;
    if (page > data.totalPages) {
      setPage(1);
    }
  }, [data, page]);

  useEffect(() => {
    if (!data?.availableActions?.length || !action) return;
    if (!data.availableActions.includes(action)) {
      setAction("");
      setPage(1);
    }
  }, [data?.availableActions, action]);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const exportCsvUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (user.trim()) params.set("user", user.trim());
    if (school.trim()) params.set("school", school.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    return `/api/super-admin/activity-logs?${params.toString()}`;
  }, [user, school, action, from, to]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const pageSize = data?.pageSize ?? limit;
  const total = data?.total ?? 0;
  const totalPages =
    data != null && total > 0
      ? data.totalPages
      : data != null && total === 0
        ? 0
        : 1;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const hasActiveFilters = Boolean(
    user.trim() || school.trim() || action.trim() || from.trim() || to.trim()
  );
  const actionFilterOptions = data?.availableActions ?? [];

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
          <SuperAdminNavLink
            href="/super-admin"
            loadingLabel="Loading…"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ← Dashboard
          </SuperAdminNavLink>
          <SuperAdminExportLink
            href={exportCsvUrl}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Export CSV
          </SuperAdminExportLink>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AuditKpiCard
            label="Total Logs"
            value={loading ? "…" : total.toLocaleString("en-US")}
            helper="Matching current filters"
          />
          <AuditKpiCard
            label="Active Schools"
            value={loading ? "…" : summary.activeSchools.toLocaleString("en-US")}
            helper="Unique schools in results"
          />
          <AuditKpiCard
            label="Active Users"
            value={loading ? "…" : summary.activeUsers.toLocaleString("en-US")}
            helper="Unique users in results"
          />
          <AuditKpiCard
            label="Today's Activity"
            value={loading ? "…" : summary.todayActivity.toLocaleString("en-US")}
            helper="Logs generated today"
          />
        </div>

        {!loading && total > 0 ? (
          <AuditInsightStrip
            total={total}
            activeSchools={summary.activeSchools}
            mostRecentAt={summary.mostRecentAt}
          />
        ) : null}
      </div>

      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Audit Filters
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Refine audit records by user, school, action, or date.
            </p>
          </div>
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
              <ActionFilterSelect
                value={action}
                options={actionFilterOptions}
                disabled={loading && actionFilterOptions.length === 0}
                onChange={(next) => {
                  setAction(next);
                  setPage(1);
                }}
              />
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
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {data && !loading ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-zinc-400">
            <span>
              {total === 0
                ? hasActiveFilters
                  ? "No matching activity"
                  : "No logs to show"
                : `Showing ${rangeStart}–${rangeEnd} of ${total} logs`}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
                Rows per page
                <select
                  value={limit}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (ROWS_PER_PAGE_OPTIONS.includes(v as never)) {
                      setLimit(v as (typeof ROWS_PER_PAGE_OPTIONS)[number]);
                      setPage(1);
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                >
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-slate-700 dark:text-zinc-300">
                Page {total === 0 ? 0 : page} of{" "}
                {total === 0 ? 0 : totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading || total === 0 || page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ActivityTypeLegend />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="max-h-[min(70vh,560px)] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-zinc-800">
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Time
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    User
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    School
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Action
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : !data?.logs.length ? (
                  <tr>
                    <td colSpan={5}>
                      <AuditEmptyState />
                    </td>
                  </tr>
                ) : (
                  data.logs.map((row) => {
                    const schoolLabel = row.school_id
                      ? data.schoolNames[row.school_id] ??
                        row.school_id.slice(0, 8) + "…"
                      : "—";
                    const isOpen = expanded.has(row.id);
                    const highRisk = isHighRiskAction(row.action);
                    const detailsStr = JSON.stringify(
                      row.action_details ?? {},
                      null,
                      2
                    );

                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "align-top hover:bg-slate-50 dark:hover:bg-zinc-800/30",
                          highRisk &&
                            "bg-amber-50/40 dark:bg-amber-950/10"
                        )}
                      >
                        <td className="px-3 py-2">
                          <TimestampCell iso={row.created_at} />
                        </td>
                        <td className="px-3 py-2">
                          <UserCell
                            email={row.user_email}
                            role={row.user_role}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <SchoolCell label={schoolLabel} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <ActionBadge action={row.action} />
                        </td>
                        <td className="px-3 py-2">
                          <DetailsGhostButton
                            isOpen={isOpen}
                            onClick={() => toggleRow(row.id)}
                          />
                          {isOpen ? (
                            <pre className="mt-2 max-h-48 max-w-xl overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
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
        </div>
      </div>
    </div>
  );
}
