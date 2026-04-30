"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UpgradeRequestSummary } from "@/lib/dashboard/dashboard-block";

interface BlockedDashboardProps {
  schoolId: string;
  studentCount: number;
  freeLimit: number;
  initialPendingRequest: UpgradeRequestSummary | null;
  lastRejected: UpgradeRequestSummary | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Full-page block shown to school admins when their school is on the free
 * plan and exceeds the 20-student cap. Renders inline (not a redirect) so
 * the user can still see the dashboard header and sign out.
 */
export function BlockedDashboard({
  schoolId,
  studentCount,
  freeLimit,
  initialPendingRequest,
  lastRejected,
}: BlockedDashboardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<UpgradeRequestSummary | null>(
    initialPendingRequest
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPending = pending != null;
  const wasRejected = lastRejected != null && !hasPending;

  async function handleRequestUpgrade() {
    if (hasPending || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/schools/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        // Default to the cheapest paid tier; the new model treats every
        // paid plan as "unlimited", so the specific tier doesn't matter
        // for unblocking access.
        body: JSON.stringify({
          schoolId,
          requestedPlan: "basic",
          currentPlan: "free",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setError(body.error || "Could not submit request. Please try again.");
        return;
      }
      setPending({
        id: "optimistic",
        status: "pending",
        requestedPlan: "basic",
        createdAt: new Date().toISOString(),
      });
      // Refresh the layout so the server-side gate re-evaluates and the
      // banner switches over to the "Pending review" state from real data.
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Network error — could not reach the server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-16 pt-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </div>

      <h1 className="mt-5 text-2xl font-semibold text-slate-900 dark:text-white">
        Dashboard locked
      </h1>

      <p className="mt-3 text-base text-slate-600 dark:text-zinc-300">
        Your school has exceeded the free tier limit of {freeLimit} students.
        Please request an upgrade to continue using the system.
      </p>

      <div className="mt-6 w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Current students
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {studentCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Free tier limit
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {freeLimit}
            </dd>
          </div>
        </dl>
      </div>

      {hasPending ? (
        <div
          className="mt-6 w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold">Upgrade request pending review</p>
          <p className="mt-1">
            Submitted{" "}
            <span className="font-medium">{formatDate(pending!.createdAt)}</span>
            . A platform admin will approve or reject your request shortly. Your
            dashboard will unlock automatically once it&apos;s approved.
          </p>
        </div>
      ) : wasRejected ? (
        <div
          className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="status"
        >
          <p className="font-semibold">Previous request was rejected</p>
          <p className="mt-1">
            Rejected{" "}
            <span className="font-medium">
              {formatDate(lastRejected!.createdAt)}
            </span>
            . You can submit a new request below.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleRequestUpgrade}
        disabled={hasPending || submitting}
        className="mt-6 inline-flex min-h-[48px] min-w-[200px] items-center justify-center gap-2 rounded-lg bg-school-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : hasPending ? (
          "Request pending review"
        ) : (
          "Request Upgrade"
        )}
      </button>

      <p className="mt-4 max-w-md text-xs text-slate-500 dark:text-zinc-400">
        Need help? Contact your platform administrator. Existing student records,
        teachers, and reports are safe — only dashboard access is paused until
        the upgrade is approved.
      </p>
    </div>
  );
}
