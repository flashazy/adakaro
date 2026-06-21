"use client";

import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  showAdminErrorToast,
  showAdminSuccessToast,
} from "@/components/dashboard/dashboard-feedback-provider";
import { binaryPlanLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Clock, X } from "lucide-react";

export interface UpgradeRequestRow {
  id: string;
  schoolId: string;
  schoolName: string;
  currentPlan: string;
  requestedPlan: string;
  status: "pending" | "approved" | "rejected";
  requesterDisplay: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UpgradeRequestsClientProps {
  initialRows: UpgradeRequestRow[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
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

function formatStudentCountLine(count: number): string {
  return count === 1 ? "1 student" : `${count.toLocaleString("en-US")} students`;
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

function RelativeTimeHelper({
  iso,
  prefix = "",
}: {
  iso: string;
  prefix?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(formatRelativeTime(iso));
  }, [iso]);

  if (!label) return null;

  return (
    <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-zinc-500">
      {prefix}
      {label}
    </span>
  );
}

function formatExecutiveDate(iso: string): string {
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

function isRecentlyReviewed(row: UpgradeRequestRow): boolean {
  if (row.status === "pending") return false;
  const updated = new Date(row.updatedAt).getTime();
  if (Number.isNaN(updated)) return false;
  return Date.now() - updated <= SEVEN_DAYS_MS;
}

const STATUS_PILL: Record<UpgradeRequestRow["status"], string> = {
  pending:
    "bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/50",
  approved:
    "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/50",
  rejected:
    "bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800/50",
};

function UpgradeKpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
        {helper}
      </p>
    </div>
  );
}

function PendingPrimaryKpiCard({ pending }: { pending: number }) {
  const isClear = pending === 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border px-4 py-3.5",
        isClear
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-800/50 dark:bg-emerald-950/30"
          : "border-amber-200 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-xs font-semibold",
            isClear
              ? "text-emerald-800 dark:text-emerald-200"
              : "text-amber-800 dark:text-amber-200"
          )}
        >
          Pending Requests
        </p>
        {isClear ? (
          <Check
            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : (
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            strokeWidth={2.5}
            aria-hidden
          />
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-3xl font-bold tabular-nums tracking-tight",
          isClear
            ? "text-emerald-900 dark:text-emerald-100"
            : "text-amber-900 dark:text-amber-100"
        )}
      >
        {pending}
      </p>
      <p
        className={cn(
          "mt-1 text-[11px] leading-snug",
          isClear
            ? "text-emerald-700/80 dark:text-emerald-300/80"
            : "text-amber-700/80 dark:text-amber-300/80"
        )}
      >
        {isClear ? "Awaiting review" : "Requires action"}
      </p>
    </div>
  );
}

function ResponseStatusStrip({ pendingCount }: { pendingCount: number }) {
  const isClear = pendingCount === 0;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm",
        isClear
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-200"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950/25 dark:text-amber-200"
      )}
      role="status"
    >
      {isClear ? (
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      )}
      <span>
        {isClear
          ? "All upgrade requests reviewed"
          : `${pendingCount} upgrade request${pendingCount === 1 ? "" : "s"} awaiting review`}
      </span>
    </div>
  );
}

function UpgradeKpiRow({ rows }: { rows: UpgradeRequestRow[] }) {
  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return {
      pending,
      approved,
      rejected,
      total: rows.length,
    };
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PendingPrimaryKpiCard pending={stats.pending} />
        <UpgradeKpiCard
          label="Approved Requests"
          value={stats.approved}
          helper={
            stats.approved === 0
              ? "No approvals yet"
              : "Processed successfully"
          }
        />
        <UpgradeKpiCard
          label="Rejected Requests"
          value={stats.rejected}
          helper={
            stats.rejected === 0
              ? "No rejected requests"
              : `${stats.rejected} declined`
          }
        />
        <UpgradeKpiCard
          label="Total Requests"
          value={stats.total}
          helper="All-time requests"
        />
      </div>
      <ResponseStatusStrip pendingCount={stats.pending} />
    </div>
  );
}

function GlobalEmptyState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
        No upgrade requests have been submitted yet.
      </p>
    </div>
  );
}

function PendingEmptyState() {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50"
        aria-hidden
      >
        <Check
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.5}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          No Pending Upgrade Requests
        </p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-400">
          All submitted upgrade requests have been reviewed.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
          New requests will appear here automatically.
        </p>
        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          System status: Up to date
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: UpgradeRequestRow["status"] }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: STATUS_PILL.pending,
    },
    approved: {
      icon: Check,
      label: "Approved",
      className: STATUS_PILL.approved,
    },
    rejected: {
      icon: X,
      label: "Rejected",
      className: STATUS_PILL.rejected,
    },
  } as const;

  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}

function LatestBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/50">
      Latest
    </span>
  );
}

function SchoolCell({
  row,
  badges,
}: {
  row: UpgradeRequestRow;
  badges?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-slate-900 dark:text-white">
          {row.schoolName}
        </p>
        {badges}
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
        {formatStudentCountLine(row.studentCount)}
      </p>
    </div>
  );
}

function TimestampCell({
  iso,
  relativeIso,
  relativePrefix = "",
}: {
  iso: string;
  relativeIso?: string;
  relativePrefix?: string;
}) {
  return (
    <div>
      <span className="whitespace-nowrap text-slate-600 dark:text-zinc-300">
        {formatDate(iso)}
      </span>
      <RelativeTimeHelper
        iso={relativeIso ?? iso}
        prefix={relativePrefix}
      />
    </div>
  );
}

function RecentlyReviewedBadge() {
  return (
    <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200 dark:text-zinc-400 dark:ring-zinc-700">
      Recently Reviewed
    </span>
  );
}

function ResolvedContext({ rows }: { rows: UpgradeRequestRow[] }) {
  if (rows.length === 0) return null;

  const lastReviewedIso = rows.reduce<string | null>((latest, row) => {
    if (!latest) return row.updatedAt;
    return new Date(row.updatedAt).getTime() > new Date(latest).getTime()
      ? row.updatedAt
      : latest;
  }, null);

  return (
    <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-zinc-400">
      <p className="font-medium text-slate-600 dark:text-zinc-300">
        {rows.length} historical upgrade decision
        {rows.length === 1 ? "" : "s"}
      </p>
      {lastReviewedIso ? (
        <p>
          Last reviewed:{" "}
          <span className="font-medium text-slate-600 dark:text-zinc-300">
            {formatExecutiveDate(lastReviewedIso)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function UpgradeRequestsClient({
  initialRows,
}: UpgradeRequestsClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState<UpgradeRequestRow[]>(initialRows);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pending = useMemo(
    () => rows.filter((r) => r.status === "pending"),
    [rows]
  );
  const resolved = useMemo(
    () => rows.filter((r) => r.status !== "pending"),
    [rows]
  );
  const latestReviewedId = useMemo(() => {
    if (resolved.length === 0) return null;

    let latest = resolved[0];
    for (const row of resolved) {
      if (
        new Date(row.updatedAt).getTime() >
        new Date(latest.updatedAt).getTime()
      ) {
        latest = row;
      }
    }
    return latest.id;
  }, [resolved]);

  async function review(requestId: string, approve: boolean) {
    const key = `${requestId}:${approve ? "approve" : "reject"}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/super-admin/upgrade-requests/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ requestId, approve }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        showAdminErrorToast(body.error || "Review failed.");
        return;
      }
      showAdminSuccessToast(approve ? "Request approved." : "Request rejected.");
      setRows((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: approve ? "approved" : "rejected",
                updatedAt: new Date().toISOString(),
              }
            : r
        )
      );
      router.refresh();
    } catch (e) {
      showAdminErrorToast(
        e instanceof Error
          ? e.message
          : "Network error — could not reach the server."
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (rows.length === 0) {
    return <GlobalEmptyState />;
  }

  return (
    <div className="space-y-6">
      <UpgradeKpiRow rows={rows} />

      <Section
        title="Pending Requests"
        variant="pending"
        rows={pending}
        busyKey={busyKey}
        showActions
        onReview={review}
      />

      {resolved.length > 0 ? (
        <Section
          title="Upgrade History"
          variant="resolved"
          context={<ResolvedContext rows={resolved} />}
          rows={resolved}
          latestReviewedId={latestReviewedId}
          busyKey={busyKey}
          showActions={false}
          onReview={review}
        />
      ) : (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Upgrade History
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            No previously reviewed requests yet.
          </p>
        </section>
      )}
    </div>
  );
}

function Section({
  title,
  variant,
  context,
  rows,
  latestReviewedId = null,
  busyKey,
  showActions,
  onReview,
}: {
  title: string;
  variant: "pending" | "resolved";
  context?: React.ReactNode;
  rows: UpgradeRequestRow[];
  latestReviewedId?: string | null;
  busyKey: string | null;
  showActions: boolean;
  onReview: (id: string, approve: boolean) => void;
}) {
  const isHistory = variant === "resolved";

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {title}
      </h2>
      {context}

      {rows.length === 0 ? (
        variant === "pending" ? (
          <PendingEmptyState />
        ) : null
      ) : (
        <>
          {/* Mobile cards (<768px) */}
          <div className="mt-3 space-y-2.5 md:hidden">
            {rows.map((row) => {
              const isLatest = isHistory && row.id === latestReviewedId;

              return (
              <article
                key={row.id}
                className={cn(
                  "rounded-xl border border-slate-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900",
                  isLatest &&
                    "border-blue-100 bg-blue-50/25 dark:border-blue-900/40 dark:bg-blue-950/15"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SchoolCell
                      row={row}
                      badges={
                        <>
                          {isHistory && row.id === latestReviewedId ? (
                            <LatestBadge />
                          ) : null}
                          {isRecentlyReviewed(row) ? (
                            <RecentlyReviewedBadge />
                          ) : null}
                        </>
                      }
                    />
                  </div>
                  <StatusBadge status={row.status} />
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Students
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {row.studentCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Upgrade
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {binaryPlanLabel(row.currentPlan)} →{" "}
                      {binaryPlanLabel(row.requestedPlan)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Requested by
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {row.requesterDisplay}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Submitted
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      <TimestampCell
                        iso={row.createdAt}
                        relativeIso={isHistory ? row.updatedAt : row.createdAt}
                        relativePrefix={isHistory ? "Reviewed " : ""}
                      />
                    </dd>
                  </div>
                </dl>

                {showActions ? (
                  <ActionButtons
                    requestId={row.id}
                    busyKey={busyKey}
                    onReview={onReview}
                    fullWidth
                  />
                ) : null}
              </article>
              );
            })}
          </div>

          {/* Desktop table (≥768px) */}
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
              <thead className="bg-slate-50 dark:bg-zinc-800/40">
                <tr>
                  <Th>School</Th>
                  <Th>Students</Th>
                  <Th>Upgrade</Th>
                  <Th>Requested by</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  {showActions ? (
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                    >
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {rows.map((row) => {
                  const isLatest = isHistory && row.id === latestReviewedId;

                  return (
                  <tr
                    key={row.id}
                    className={cn(
                      "text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/30",
                      isLatest && "bg-blue-50/35 dark:bg-blue-950/15"
                    )}
                  >
                    <Td>
                      <SchoolCell
                        row={row}
                        badges={
                          <>
                            {isHistory && row.id === latestReviewedId ? (
                              <LatestBadge />
                            ) : null}
                            {isRecentlyReviewed(row) ? (
                              <RecentlyReviewedBadge />
                            ) : null}
                          </>
                        }
                      />
                    </Td>
                    <Td>{row.studentCount}</Td>
                    <Td>
                      {binaryPlanLabel(row.currentPlan)} →{" "}
                      {binaryPlanLabel(row.requestedPlan)}
                    </Td>
                    <Td>{row.requesterDisplay}</Td>
                    <Td>
                      <TimestampCell
                        iso={row.createdAt}
                        relativeIso={isHistory ? row.updatedAt : row.createdAt}
                        relativePrefix={isHistory ? "Reviewed " : ""}
                      />
                    </Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    {showActions ? (
                      <td className="px-4 py-2 text-right">
                        <ActionButtons
                          requestId={row.id}
                          busyKey={busyKey}
                          onReview={onReview}
                        />
                      </td>
                    ) : null}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

function ActionButtons({
  requestId,
  busyKey,
  onReview,
  fullWidth = false,
}: {
  requestId: string;
  busyKey: string | null;
  onReview: (id: string, approve: boolean) => void;
  fullWidth?: boolean;
}) {
  const approveBusy = busyKey === `${requestId}:approve`;
  const rejectBusy = busyKey === `${requestId}:reject`;
  const rowBusy = busyKey?.startsWith(`${requestId}:`) ?? false;

  return (
    <div
      className={`mt-3 flex gap-2 md:mt-0 md:justify-end ${fullWidth ? "" : ""}`}
    >
      <SuperAdminLoadingButton
        type="button"
        onClick={() => onReview(requestId, true)}
        disabled={rowBusy}
        loading={approveBusy}
        loadingLabel="Approving…"
        className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "flex-1" : ""}`}
      >
        Approve
      </SuperAdminLoadingButton>
      <SuperAdminLoadingButton
        type="button"
        onClick={() => onReview(requestId, false)}
        disabled={rowBusy}
        loading={rejectBusy}
        loadingLabel="Rejecting…"
        className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30 ${fullWidth ? "flex-1" : ""}`}
      >
        Reject
      </SuperAdminLoadingButton>
    </div>
  );
}
