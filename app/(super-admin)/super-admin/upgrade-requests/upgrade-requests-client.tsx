"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  showAdminErrorToast,
  showAdminSuccessToast,
} from "@/components/dashboard/dashboard-feedback-provider";
import { binaryPlanLabel } from "@/lib/plans";

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const STATUS_PILL: Record<UpgradeRequestRow["status"], string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
};

export function UpgradeRequestsClient({ initialRows }: UpgradeRequestsClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState<UpgradeRequestRow[]>(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  async function review(requestId: string, approve: boolean) {
    setBusyId(requestId);
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
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <Section
        title={`Pending (${pending.length})`}
        empty="No pending upgrade requests."
        rows={pending}
        busyId={busyId}
        showActions
        onReview={review}
      />
      <Section
        title={`Resolved (${resolved.length})`}
        empty="No previously reviewed requests yet."
        rows={resolved}
        busyId={busyId}
        showActions={false}
        onReview={review}
      />
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  busyId,
  showActions,
  onReview,
}: {
  title: string;
  empty: string;
  rows: UpgradeRequestRow[];
  busyId: string | null;
  showActions: boolean;
  onReview: (id: string, approve: boolean) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {title}
      </h2>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {empty}
        </div>
      ) : (
        <>
          {/* Mobile cards (<768px) */}
          <div className="mt-3 space-y-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 break-words text-base font-semibold text-slate-900 dark:text-white">
                    {row.schoolName}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_PILL[row.status]}`}
                  >
                    {row.status}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
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
                      {formatDate(row.createdAt)}
                    </dd>
                  </div>
                </dl>

                {showActions ? (
                  <ActionButtons
                    requestId={row.id}
                    busy={busyId === row.id}
                    onReview={onReview}
                    fullWidth
                  />
                ) : null}
              </article>
            ))}
          </div>

          {/* Desktop table (≥768px) */}
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-zinc-800 dark:bg-zinc-900">
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
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                    >
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {row.schoolName}
                      </span>
                    </Td>
                    <Td>{row.studentCount}</Td>
                    <Td>
                      {binaryPlanLabel(row.currentPlan)} →{" "}
                      {binaryPlanLabel(row.requestedPlan)}
                    </Td>
                    <Td>{row.requesterDisplay}</Td>
                    <Td>{formatDate(row.createdAt)}</Td>
                    <Td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_PILL[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </Td>
                    {showActions ? (
                      <td className="px-4 py-3 text-right">
                        <ActionButtons
                          requestId={row.id}
                          busy={busyId === row.id}
                          onReview={onReview}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
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
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 text-sm text-slate-700 dark:text-zinc-200">
      {children}
    </td>
  );
}

function ActionButtons({
  requestId,
  busy,
  onReview,
  fullWidth = false,
}: {
  requestId: string;
  busy: boolean;
  onReview: (id: string, approve: boolean) => void;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`mt-4 flex gap-2 md:mt-0 md:justify-end ${fullWidth ? "" : ""}`}
    >
      <button
        type="button"
        onClick={() => onReview(requestId, true)}
        disabled={busy}
        className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "flex-1" : ""}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        Approve
      </button>
      <button
        type="button"
        onClick={() => onReview(requestId, false)}
        disabled={busy}
        className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30 ${fullWidth ? "flex-1" : ""}`}
      >
        Reject
      </button>
    </div>
  );
}
