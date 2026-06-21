"use client";

import { SuperAdminLoadingButton, SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import { formatDate, formatExecutiveDashboardDate } from "@/lib/format-date";
import { binaryPlanLabel } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SchoolsLifecycleDashboard } from "@/components/super-admin/schools-lifecycle-dashboard";
import { SuperAdminDashboardMobilePolish } from "./super-admin-dashboard-mobile-polish";
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
import { SmartIntelligenceSection } from "@/components/super-admin/smart-intelligence/smart-intelligence-section";
import type { SmartIntelligencePayload } from "@/lib/super-admin/smart-intelligence-types";
import { DemoLeadsWidget } from "@/components/super-admin/demo-leads-widget";
import type { DemoLeadPipelineStats } from "@/lib/demo-requests/types";
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
  initialIntelligence?: SmartIntelligencePayload | null;
  intelligenceError?: string | null;
  initialLeadPipelineStats?: DemoLeadPipelineStats | null;
}

export function SuperAdminDashboardClient({
  initialData,
  initialPendingUpgrades = [],
  initialIntelligence = null,
  intelligenceError = null,
  initialLeadPipelineStats = null,
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const [pendingUpgrades, setPendingUpgrades] = useState(initialPendingUpgrades);
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);

  const businessSnapshot = useMemo(
    () => computeBusinessSnapshot(initialData.schools),
    [initialData.schools]
  );

  const todayLabel = useMemo(() => formatExecutiveDashboardDate(new Date()), []);

  useEffect(() => {
    setPendingUpgrades(initialPendingUpgrades);
  }, [initialPendingUpgrades]);

  async function reviewRequest(requestId: string, approve: boolean) {
    const key = `${requestId}:${approve ? "approve" : "deny"}`;
    setReviewBusyKey(key);
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
      setReviewBusyKey(null);
    }
  }

  return (
    <>
      <SuperAdminDashboardMobilePolish />
      <div
        id="sa-dashboard"
        className="mx-auto max-w-full space-y-4 overflow-x-hidden sm:space-y-6 md:max-w-7xl"
      >
      <SaExecutiveHeader
        title="Super Admin Dashboard"
        subtitle="Monitor school growth, engagement, health, and platform performance."
        dateLabel={todayLabel}
        totalSchools={initialData.stats.schools}
        paidSchools={businessSnapshot.paidSchools}
      >
        <SuperAdminNavLink
          href="/super-admin/analytics"
          loadingLabel="Loading…"
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 sm:text-sm"
        >
          Analytics
        </SuperAdminNavLink>
        <SuperAdminNavLink
          href="/super-admin/activity-logs"
          loadingLabel="Loading…"
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 sm:text-sm"
        >
          Activity logs
        </SuperAdminNavLink>
        <SuperAdminNavLink
          href="/super-admin/demo-requests"
          loadingLabel="Loading…"
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 sm:text-sm"
        >
          Demo Requests
        </SuperAdminNavLink>
        {pendingUpgrades.length > 0 ? (
          <span
            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 sm:px-3 sm:py-1 sm:text-sm"
            title="Pending plan upgrade requests"
          >
            {pendingUpgrades.length} pending upgrade
            {pendingUpgrades.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <SuperAdminNavLink href="/super-admin/create" loadingLabel="Loading…" className={cn(saBtnPrimary, "max-md:px-3 max-md:py-1.5 max-md:text-xs")}>
          Create School
        </SuperAdminNavLink>
      </SaExecutiveHeader>

      <div className="max-md:space-y-3">
      <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 lg:grid-cols-3 lg:gap-4">
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
          className="max-md:col-span-2"
        />
      </div>

      <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 lg:grid-cols-5 lg:gap-4">
        <SaKpiCard label="Total Students" value={initialData.stats.students} />
        <SaKpiCard label="Admin Memberships" value={initialData.stats.admins} />
        <SaKpiCard label="Total Payments" value={initialData.stats.payments} />
        <SaKpiCard label="Free Schools" value={businessSnapshot.freeSchools} />
        <SaKpiCard
          label="Average Students Per School"
          value={businessSnapshot.averageStudentsPerSchool}
          className="max-md:col-span-2"
        />
      </div>
      </div>

      <SmartIntelligenceSection
        initialData={initialIntelligence}
        initialError={intelligenceError}
        schoolCount={initialData.stats.schools}
        schools={initialData.schools}
        activeSchools={initialData.stats.lifecycle.activeSchools}
      />

      {initialLeadPipelineStats ? (
        <DemoLeadsWidget pipelineStats={initialLeadPipelineStats} />
      ) : null}

      {pendingUpgrades.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-4 shadow-sm sm:rounded-2xl sm:px-5 sm:py-5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            Pending upgrades
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            School admins requested a plan change. Approve to update the school plan, or deny to
            close the request.
          </p>

          <div className="mt-4 space-y-3 md:hidden">
            {pendingUpgrades.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
              >
                <SuperAdminNavLink
                  href={`/super-admin/schools/${row.school_id}`}
                  loadingLabel="Opening…"
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {row.school_name}
                </SuperAdminNavLink>
                <p className="mt-1 text-xs text-slate-500">{row.requester_display}</p>
                <p className="mt-2 text-sm text-slate-700">
                  {binaryPlanLabel(row.current_plan)} → {binaryPlanLabel(row.requested_plan)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SuperAdminLoadingButton
                    type="button"
                    disabled={reviewBusyKey?.startsWith(`${row.id}:`) ?? false}
                    loading={reviewBusyKey === `${row.id}:approve`}
                    loadingLabel="Approving…"
                    onClick={() => reviewRequest(row.id, true)}
                    className={cn(saBtnPrimarySm, "w-full")}
                  >
                    Approve
                  </SuperAdminLoadingButton>
                  <SuperAdminLoadingButton
                    type="button"
                    disabled={reviewBusyKey?.startsWith(`${row.id}:`) ?? false}
                    loading={reviewBusyKey === `${row.id}:deny`}
                    loadingLabel="Denying…"
                    onClick={() => reviewRequest(row.id, false)}
                    className={cn(saBtnSecondarySm, "w-full")}
                  >
                    Deny
                  </SuperAdminLoadingButton>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
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
                      <SuperAdminNavLink
                        href={`/super-admin/schools/${row.school_id}`}
                        loadingLabel="Opening…"
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {row.school_name}
                      </SuperAdminNavLink>
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
                        <SuperAdminLoadingButton
                          type="button"
                          disabled={reviewBusyKey?.startsWith(`${row.id}:`) ?? false}
                          loading={reviewBusyKey === `${row.id}:approve`}
                          loadingLabel="Approving…"
                          onClick={() => reviewRequest(row.id, true)}
                          className={saBtnPrimarySm}
                        >
                          Approve
                        </SuperAdminLoadingButton>
                        <SuperAdminLoadingButton
                          type="button"
                          disabled={reviewBusyKey?.startsWith(`${row.id}:`) ?? false}
                          loading={reviewBusyKey === `${row.id}:deny`}
                          loadingLabel="Denying…"
                          onClick={() => reviewRequest(row.id, false)}
                          className={saBtnSecondarySm}
                        >
                          Deny
                        </SuperAdminLoadingButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="max-md:mt-10 max-md:border-t max-md:border-slate-200/70 max-md:pt-8">
        <h2 className="text-base font-bold tracking-tight text-slate-950 sm:text-lg sm:font-semibold sm:text-slate-900">
          Schools Management
        </h2>
        <div className="mt-4 max-md:mt-5">
        <SchoolsLifecycleDashboard
          schools={initialData.schools}
          lifecycleStats={initialData.stats.lifecycle}
          averageHealthScore={businessSnapshot.averageHealthScore}
        />
        </div>
      </section>
      </div>
    </>
  );
}
