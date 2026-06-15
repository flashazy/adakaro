"use client";

import Link from "next/link";
import { formatDate, formatExecutiveDashboardDate } from "@/lib/format-date";
import { binaryPlanLabel } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SchoolsLifecycleDashboard } from "@/components/super-admin/schools-lifecycle-dashboard";
import {
  saBtnPrimary,
  saBtnPrimarySm,
  saBtnSecondarySm,
  saTableRowHover,
  SaExecutiveHeader,
  SaKpiCard,
  SaKpiCardHighlighted,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { highlightedKpiTrend } from "@/lib/super-admin/dashboard-presentation";
import { computeBusinessSnapshot } from "@/lib/super-admin/dashboard-insights";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import { cn } from "@/lib/utils";

export interface PendingUpgradeRow {
  id: string;
  school_id: string;
  school_name: string;
  requester_display: string;
  current_plan: string;
  requested_plan: string;
  created_at: string;
}

interface DashboardData {
  stats: {
    schools: number;
    students: number;
    admins: number;
    payments: number;
    lifecycle: {
      setupSchools: number;
      activeSchools: number;
      inactiveSchools: number;
      archivedSchools: number;
      healthExcellent: number;
      healthHealthy: number;
      healthAtRisk: number;
      healthInactive: number;
      newSetupSchoolsLast30Days: number;
      setupSchoolsOlderThan14Days: number;
      activeSchoolsThisMonth: number;
      schoolsAtRisk: number;
    };
  };
  schools: SuperAdminSchoolRow[];
}

interface SuperAdminDashboardClientProps {
  initialData: DashboardData;
  /** Defaults to [] if omitted (avoids crashes during HMR or stale renders). */
  initialPendingUpgrades?: PendingUpgradeRow[];
}

export function SuperAdminDashboardClient({
  initialData,
  initialPendingUpgrades = [],
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const [pendingUpgrades, setPendingUpgrades] = useState(initialPendingUpgrades);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const businessSnapshot = useMemo(
    () => computeBusinessSnapshot(initialData.schools),
    [initialData.schools]
  );

  const todayLabel = useMemo(() => formatExecutiveDashboardDate(new Date()), []);

  useEffect(() => {
    setPendingUpgrades(initialPendingUpgrades);
  }, [initialPendingUpgrades]);

  async function reviewRequest(requestId: string, approve: boolean) {
    setReviewBusyId(requestId);
    try {
      const res = await fetch("/api/super-admin/upgrade-requests/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approve }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(body.error || "Could not update request.");
        return;
      }
      setPendingUpgrades((rows) => rows.filter((r) => r.id !== requestId));
      router.refresh();
    } finally {
      setReviewBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SaExecutiveHeader
        title="Super Admin Dashboard"
        subtitle="Monitor school growth, engagement, health, and platform performance."
        dateLabel={todayLabel}
        totalSchools={initialData.stats.schools}
        paidSchools={businessSnapshot.paidSchools}
      >
        <Link
          href="/super-admin/analytics"
          className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
        >
          Analytics
        </Link>
        <Link
          href="/super-admin/activity-logs"
          className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
        >
          Activity logs
        </Link>
        {pendingUpgrades.length > 0 ? (
          <span
            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
            title="Pending plan upgrade requests"
          >
            {pendingUpgrades.length} pending upgrade
            {pendingUpgrades.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <a href="/super-admin/create" className={saBtnPrimary}>
          Create School
        </a>
      </SaExecutiveHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SaKpiCardHighlighted
          label="Total Schools"
          value={initialData.stats.schools}
          caption={highlightedKpiTrend("Total Schools")}
        />
        <SaKpiCardHighlighted
          label="Paid Schools"
          value={businessSnapshot.paidSchools}
          caption={highlightedKpiTrend("Paid Schools")}
        />
        <SaKpiCardHighlighted
          label="Average Health Score"
          value={businessSnapshot.averageHealthScore}
          caption={highlightedKpiTrend(
            "Average Health Score",
            businessSnapshot.averageHealthScore
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SaKpiCard label="Total Students" value={initialData.stats.students} />
        <SaKpiCard label="Admin Memberships" value={initialData.stats.admins} />
        <SaKpiCard label="Total Payments" value={initialData.stats.payments} />
        <SaKpiCard label="Free Schools" value={businessSnapshot.freeSchools} />
        <SaKpiCard
          label="Average Students Per School"
          value={businessSnapshot.averageStudentsPerSchool}
        />
      </div>

      {pendingUpgrades.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 px-5 py-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Pending upgrades
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            School admins requested a plan change. Approve to update the school plan, or deny to
            close the request.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">School</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Requested by</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-slate-600 sm:table-cell">
                    From → To
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
                    Requested
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUpgrades.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-100 last:border-0",
                      saTableRowHover
                    )}
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`/super-admin/schools/${row.school_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {row.school_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.requester_display}</td>
                    <td className="hidden px-4 py-3 text-slate-700 sm:table-cell">
                      {binaryPlanLabel(row.current_plan)} →{" "}
                      {binaryPlanLabel(row.requested_plan)}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewBusyId === row.id}
                          onClick={() => reviewRequest(row.id, true)}
                          className={saBtnPrimarySm}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={reviewBusyId === row.id}
                          onClick={() => reviewRequest(row.id, false)}
                          className={saBtnSecondarySm}
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Schools Management
        </h2>
        <SchoolsLifecycleDashboard
          schools={initialData.schools}
          lifecycleStats={initialData.stats.lifecycle}
          averageHealthScore={businessSnapshot.averageHealthScore}
        />
      </section>
    </div>
  );
}
