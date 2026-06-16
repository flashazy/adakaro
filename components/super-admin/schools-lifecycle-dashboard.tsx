"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format-date";
import { binaryPlanLabel, isPaidPlanId } from "@/lib/plans";
import { formatSchoolLastActivity } from "@/lib/super-admin/school-health";
import {
  schoolHealthBadgeClass,
} from "@/lib/super-admin/school-health";
import {
  isSetupSchoolNeedingAttention,
  normalizeSchoolLifecycleStatus,
  schoolLifecycleStatusBadgeClass,
  schoolLifecycleStatusLabel,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";
import {
  computeGrowthOpportunities,
  computeLifecycleFunnel,
  computeRecommendedActions,
  getAttentionReasonBadges,
  healthDistributionRows,
} from "@/lib/super-admin/dashboard-insights";
import { SchoolSummaryDrawer } from "@/components/super-admin/school-summary-drawer";
import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import {
  growthOpportunityBadge,
  healthOverviewCallout,
  healthScoreValueColor,
  platformHealthFromAverage,
  recommendedActionIcon,
  attentionSeverityAccent,
  SA_TOOLTIPS,
} from "@/lib/super-admin/dashboard-presentation";
import {
  saBtnArchiveOutline,
  saBtnActionMenu,
  saBtnDangerOutline,
  saBtnPrimary,
  saBtnSecondary,
  saBtnSecondarySm,
  saChipCalm,
  saDirectoryToolbar,
  saFilterTabActive,
  saFilterTabInactive,
  saInput,
  saInteractiveCard,
  saSearchInput,
  saSection,
  saStatusBadge,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
  SaEmptyState,
  SaHealthScoreCell,
  SaKpiCard,
  SaRankBadge,
  SaSectionAnchor,
  SaSectionHeader,
  SaTooltip,
  SaTopSchoolBadge,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { enterSuperAdminSchoolWorkspace } from "@/lib/super-admin/open-school-workspace.client";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import { cn } from "@/lib/utils";

function FunnelArrow() {
  return (
    <div
      className="hidden shrink-0 items-center self-center px-0.5 sm:flex"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function MoreHorizontalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}
export interface SchoolsLifecycleDashboardProps {
  schools: SuperAdminSchoolRow[];
  lifecycleStats: {
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
  /** Existing platform average — used for display badge only. */
  averageHealthScore?: number;
}

type StatusFilter = "all" | SchoolLifecycleStatus;

function SchoolActionsMenu({
  school,
  onView,
  onArchive,
  onRestore,
  onDelete,
}: {
  school: SuperAdminSchoolRow;
  onView: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];

  items.push({
    label: "View School",
    onClick: () => {
      setOpen(false);
      onView();
    },
  });

  items.push({
    label: "Open school workspace",
    onClick: () => {
      setOpen(false);
      void enterSuperAdminSchoolWorkspace(school.id);
    },
  });

  if (school.school_status !== "archived") {
    items.push({
      label: "Edit School",
      onClick: () => {
        window.location.href = `/super-admin/schools/${school.id}?edit=1`;
      },
    });
    items.push({
      label: "Archive School",
      onClick: () => {
        setOpen(false);
        onArchive();
      },
    });
  }

  if (school.school_status === "archived") {
    items.push({
      label: "Restore School",
      onClick: () => {
        setOpen(false);
        onRestore();
      },
    });
    items.push({
      label: "Delete Permanently",
      onClick: () => {
        setOpen(false);
        onDelete();
      },
      danger: true,
    });
  } else if (school.can_delete_permanently) {
    items.push({
      label: "Delete Permanently",
      onClick: () => {
        setOpen(false);
        onDelete();
      },
      danger: true,
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={saBtnActionMenu}
      >
        <MoreHorizontalIcon />
        Actions
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50",
                  item.danger ? "text-red-600" : "text-slate-700"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function SchoolsLifecycleDashboard({
  schools,
  lifecycleStats,
  averageHealthScore = 0,
}: SchoolsLifecycleDashboardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SuperAdminSchoolRow | null>(
    null
  );
  const [restoreTarget, setRestoreTarget] = useState<SuperAdminSchoolRow | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminSchoolRow | null>(
    null
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteFinalOpen, setDeleteFinalOpen] = useState(false);
  const [drawerSchool, setDrawerSchool] = useState<SuperAdminSchoolRow | null>(
    null
  );

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    {
      key: "all",
      label: "All Schools",
      count: schools.filter((s) => s.school_status !== "archived").length,
    },
    {
      key: "setup",
      label: "Setup",
      count: lifecycleStats.setupSchools,
    },
    {
      key: "active",
      label: "Active",
      count: lifecycleStats.activeSchools,
    },
    {
      key: "inactive",
      label: "Inactive",
      count: lifecycleStats.inactiveSchools,
    },
    {
      key: "archived",
      label: "Archived",
      count: lifecycleStats.archivedSchools,
    },
  ];

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const schoolStatus = normalizeSchoolLifecycleStatus(school.school_status);
      const matchesSearch = school.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesPlan =
        planFilter === "all"
          ? true
          : planFilter === "paid"
            ? isPaidPlanId(school.plan)
            : !isPaidPlanId(school.plan);
      const matchesStatus =
        statusFilter === "all"
          ? schoolStatus !== "archived"
          : schoolStatus === statusFilter;
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [schools, search, planFilter, statusFilter]);

  const topHealthSchoolId = useMemo(() => {
    if (filteredSchools.length === 0) return null;
    const maxScore = Math.max(...filteredSchools.map((s) => s.health_score));
    return filteredSchools.find((s) => s.health_score === maxScore)?.id ?? null;
  }, [filteredSchools]);

  const filteredStatusCounts = useMemo(() => {
    let active = 0;
    let setup = 0;
    for (const school of filteredSchools) {
      const status = normalizeSchoolLifecycleStatus(school.school_status);
      if (status === "active") active += 1;
      if (status === "setup") setup += 1;
    }
    return { active, setup };
  }, [filteredSchools]);

  const attentionSchools = useMemo(() => {
    type AttentionItem = SuperAdminSchoolRow & {
      priority: number;
      badges: ReturnType<typeof getAttentionReasonBadges>;
    };

    const items: AttentionItem[] = [];

    for (const school of schools) {
      const status = normalizeSchoolLifecycleStatus(school.school_status);
      if (status === "archived") continue;

      const badges = getAttentionReasonBadges(school);
      if (badges.length === 0) continue;

      let priority = 4;
      if (status === "inactive") priority = 1;
      else if (status === "active" && school.health_score < 40) priority = 2;
      else if (isSetupSchoolNeedingAttention(status, school.created_at)) priority = 3;

      items.push({ ...school, priority, badges });
    }

    return items
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.health_score - b.health_score;
      })
      .slice(0, 8);
  }, [schools]);

  const growthOpportunities = useMemo(
    () => computeGrowthOpportunities(schools),
    [schools]
  );

  const recommendedActions = useMemo(
    () => computeRecommendedActions(schools, lifecycleStats),
    [schools, lifecycleStats]
  );

  const funnelSteps = useMemo(
    () => computeLifecycleFunnel(schools, lifecycleStats),
    [schools, lifecycleStats]
  );

  const healthRows = useMemo(
    () => healthDistributionRows(lifecycleStats),
    [lifecycleStats]
  );

  const healthTotal =
    lifecycleStats.healthExcellent +
    lifecycleStats.healthHealthy +
    lifecycleStats.healthAtRisk +
    lifecycleStats.healthInactive;

  const platformHealth = platformHealthFromAverage(averageHealthScore);

  const healthCallout = healthOverviewCallout(lifecycleStats, healthTotal);

  const hasActiveFilters =
    search.trim() !== "" || planFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setPlanFilter("all");
    setStatusFilter("all");
  }

  async function runLifecycle(
    schoolId: string,
    action: "archive" | "restore" | "delete",
    confirm?: string
  ) {
    setBusyId(schoolId);
    try {
      const res = await fetch("/api/super-admin/schools/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, action, confirm }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(body.error || "Action failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SaKpiCard label="Setup Schools" value={lifecycleStats.setupSchools} />
        <SaKpiCard label="Active Schools" value={lifecycleStats.activeSchools} />
        <SaKpiCard label="Inactive Schools" value={lifecycleStats.inactiveSchools} />
        <SaKpiCard label="Archived Schools" value={lifecycleStats.archivedSchools} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SaKpiCard
          label="New Setup Schools (30d)"
          value={lifecycleStats.newSetupSchoolsLast30Days}
        />
        <SaKpiCard
          label="Setup Older Than 14 Days"
          value={lifecycleStats.setupSchoolsOlderThan14Days}
        />
        <SaKpiCard
          label="Active Schools This Month"
          value={lifecycleStats.activeSchoolsThisMonth}
        />
        <SaKpiCard label="Schools At Risk" value={lifecycleStats.schoolsAtRisk} />
      </div>

      <SaSectionAnchor label="Health Overview" id="sa-health-overview" />
      <section className={saSection} aria-labelledby="sa-health-overview">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SaSectionHeader title="School Health Overview" />
          {healthTotal > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Platform Health:</span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                  platformHealth.className
                )}
              >
                {platformHealth.label}
              </span>
            </div>
          ) : null}
        </div>
        {healthTotal === 0 ? (
          <SaEmptyState
            message="No school health data yet."
            className="mt-4"
          />
        ) : (
          <>
            {healthCallout ? (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {healthCallout}
              </p>
            ) : null}
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {(
                [
                  ["excellent", lifecycleStats.healthExcellent, "bg-emerald-500"],
                  ["healthy", lifecycleStats.healthHealthy, "bg-blue-500"],
                  ["at_risk", lifecycleStats.healthAtRisk, "bg-amber-500"],
                  ["inactive", lifecycleStats.healthInactive, "bg-red-500"],
                ] as const
              ).map(([key, count, color]) => {
                if (count <= 0) return null;
                return (
                  <div
                    key={key}
                    className={cn("h-full", color)}
                    style={{ width: `${(count / healthTotal) * 100}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {healthRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", row.barClass)}
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium text-slate-800">{row.label}</span>{" "}
                      <span className="text-xs text-slate-500">({row.range})</span>
                    </span>
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {row.count}{" "}
                    <span className="text-slate-500">({row.percent}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <SaSectionAnchor label="Growth Opportunities" id="sa-growth-opportunities" />
      <section
        className="rounded-2xl border border-emerald-100 bg-emerald-50/30 px-5 py-5 shadow-sm"
        aria-labelledby="sa-growth-opportunities"
      >
        <SaSectionHeader
          title="Growth Opportunities"
          subtitle="Schools closest to becoming successful, expanding clients."
        />
        {growthOpportunities.length === 0 ? (
          <SaEmptyState
            message="No growth opportunities to highlight right now."
            className="mt-4 border-emerald-100 bg-white/60"
          />
        ) : (
          <ol className="mt-4 space-y-3">
            {growthOpportunities.map((item, index) => {
              const badge = growthOpportunityBadge(item.insight);
              return (
                <li
                  key={item.school.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
                    saInteractiveCard
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{item.school.name}</p>
                      <span
                        className={cn(
                          saChipCalm,
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {item.school.student_count} students · {item.school.health_label}
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">
                      {item.insight}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerSchool(item.school)}
                    className={saBtnSecondarySm}
                  >
                    View
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div>
          <SaSectionAnchor label="Recommended Actions" id="sa-recommended-actions" />
          <section className={saSection} aria-labelledby="sa-recommended-actions">
          <SaSectionHeader
            title="Recommended Actions"
            subtitle="What to focus on today."
          />
          <ul className="mt-4 space-y-3">
            {recommendedActions.map((action) => (
              <li
                key={action}
                className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-700"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-base"
                  aria-hidden
                >
                  {recommendedActionIcon(action)}
                </span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </section>
        </div>

        <div>
          <SaSectionAnchor label="Lifecycle Funnel" />
          <section className={cn(saSection, "flex flex-col justify-center")}>
          <SaSectionHeader title="Schools Lifecycle Funnel" />
          <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:items-stretch">
            {funnelSteps.map((step, index) => (
              <div key={step.label} className="flex min-w-0 flex-1 items-stretch">
                {index > 0 ? <FunnelArrow /> : null}
                <div className="flex min-h-[5.5rem] flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xl font-bold tabular-nums text-slate-950">
                    {step.count}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {step.label}
                  </p>
                  {step.sublabel ? (
                    <p className="text-[10px] text-slate-400">{step.sublabel}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>

      <SaSectionAnchor label="Attention Queue" id="sa-attention-queue" />
      <section
        className="rounded-2xl border border-amber-200 bg-amber-50/50 px-5 py-5 shadow-sm"
        aria-labelledby="sa-attention-queue"
      >
        <SaSectionHeader title="Schools Requiring Attention" />
        {attentionSchools.length === 0 ? (
          <SaEmptyState
            message="No schools currently require attention."
            className="mt-4 border-amber-100 bg-white/60"
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {attentionSchools.map((school) => (
              <li
                key={school.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 pl-3 shadow-sm",
                  attentionSeverityAccent(school.priority),
                  saInteractiveCard
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{school.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {school.badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={cn(saChipCalm, badge.className)}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Health: {school.health_score} · Last activity:{" "}
                    {formatSchoolLastActivity(school.last_activity_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerSchool(school)}
                    className={saBtnSecondarySm}
                  >
                    View
                  </button>
                  {school.school_status !== "archived" ? (
                    <button
                      type="button"
                      disabled={busyId === school.id}
                      onClick={() => setArchiveTarget(school)}
                      className={saBtnArchiveOutline}
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-2">
        <SaSectionAnchor label="Schools Directory" id="sa-schools-directory" />
        <div aria-labelledby="sa-schools-directory" className="space-y-4">
          <div className={saDirectoryToolbar}>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                Showing {filteredSchools.length} school
                {filteredSchools.length === 1 ? "" : "s"}
              </span>
              <span className="mx-2 text-slate-300" aria-hidden>
                ·
              </span>
              <span>{filteredStatusCounts.active} Active</span>
              <span className="mx-2 text-slate-300" aria-hidden>
                ·
              </span>
              <span>{filteredStatusCounts.setup} Setup</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    statusFilter === tab.key ? saFilterTabActive : saFilterTabInactive
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="relative min-w-[12rem] flex-1">
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Search schools by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={saSearchInput}
                  />
                </div>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className={cn(saInput, "border-slate-300")}
                >
                  <option value="all">All plans</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              {search.trim() ? (
                <p className="text-xs text-slate-500">
                  Showing {filteredSchools.length} matching school
                  {filteredSchools.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          </div>

      <div className="space-y-3 md:hidden">
        {filteredSchools.length === 0 ? (
          <SaEmptyState
            message="No schools match your filters."
            actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          filteredSchools.map((school, index) => (
          <article
            key={school.id}
            role="button"
            tabIndex={0}
            onClick={() => setDrawerSchool(school)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDrawerSchool(school);
              }
            }}
            className={cn(
              "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
              saInteractiveCard,
              saTableRowHover
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <SaRankBadge rank={index + 1} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{school.name}</p>
                    {school.id === topHealthSchoolId ? (
                      <SaTooltip content={SA_TOOLTIPS.topSchool}>
                        <SaTopSchoolBadge />
                      </SaTooltip>
                    ) : null}
                  </div>
                </div>
              </div>
              <SaTooltip content={SA_TOOLTIPS.status}>
                <span
                  className={cn(
                    saStatusBadge,
                    schoolLifecycleStatusBadgeClass(school.school_status)
                  )}
                >
                  {schoolLifecycleStatusLabel(school.school_status)}
                </span>
              </SaTooltip>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span
                className={cn(
                  "font-bold tabular-nums",
                  healthScoreValueColor(school.health_category)
                )}
              >
                {school.health_score}
                <span className="font-normal text-slate-400"> /100</span>
              </span>
              <span>{binaryPlanLabel(school.plan)}</span>
              <span>Students: {school.student_count}</span>
              <span>{formatSchoolLastActivity(school.last_activity_at)}</span>
            </div>
            <div
              className="mt-3 flex gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setDrawerSchool(school)}
                className={cn(saBtnSecondarySm, "flex-1")}
              >
                View
              </button>
              <SchoolActionsMenu
                school={school}
                onView={() => setDrawerSchool(school)}
                onArchive={() => setArchiveTarget(school)}
                onRestore={() => setRestoreTarget(school)}
                onDelete={() => {
                  setDeleteTarget(school);
                  setDeleteConfirmText("");
                  setDeleteFinalOpen(false);
                }}
              />
            </div>
          </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        {filteredSchools.length === 0 ? (
          <SaEmptyState
            message="No schools match your filters."
            actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
            className="m-4"
          />
        ) : (
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
        <table className="w-full min-w-[58rem] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className={saTableHeadRow}>
              <th className={cn(saTableHeadCell, "w-14")}>Rank</th>
              <th className={saTableHeadCell}>School</th>
              <th className={saTableHeadCell}>
                <SaTooltip content={SA_TOOLTIPS.status}>Status</SaTooltip>
              </th>
              <th className={saTableHeadCell}>
                <SaTooltip content={SA_TOOLTIPS.healthScore}>Health Score</SaTooltip>
              </th>
              <th className={saTableHeadCell}>Last Activity</th>
              <th className={saTableHeadCell}>
                <SaTooltip content={SA_TOOLTIPS.plan}>Plan</SaTooltip>
              </th>
              <th className={saTableHeadCell}>Students</th>
              <th className={saTableHeadCell}>Created</th>
              <th className={saTableHeadCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchools.map((school, index) => (
              <tr
                key={school.id}
                onClick={() => setDrawerSchool(school)}
                className={cn(
                  "border-b border-slate-100 last:border-0",
                  saTableRowHover
                )}
              >
                <td className="px-4 py-3.5">
                  <SaRankBadge rank={index + 1} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{school.name}</span>
                    {school.id === topHealthSchoolId ? (
                      <SaTooltip content={SA_TOOLTIPS.topSchool}>
                        <SaTopSchoolBadge />
                      </SaTooltip>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <SaTooltip content={SA_TOOLTIPS.status}>
                    <span
                      className={cn(
                        saStatusBadge,
                        schoolLifecycleStatusBadgeClass(school.school_status)
                      )}
                    >
                      {schoolLifecycleStatusLabel(school.school_status)}
                    </span>
                  </SaTooltip>
                </td>
                <td className="px-4 py-3.5">
                  <SaTooltip content={SA_TOOLTIPS.healthScore}>
                    <SaHealthScoreCell
                      score={school.health_score}
                      label={school.health_label}
                      badgeClassName={schoolHealthBadgeClass(school.health_category)}
                      scoreColorClassName={healthScoreValueColor(school.health_category)}
                    />
                  </SaTooltip>
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {formatSchoolLastActivity(school.last_activity_at)}
                </td>
                <td className="px-4 py-3.5 text-slate-700">
                  <SaTooltip content={SA_TOOLTIPS.plan}>
                    <span>{binaryPlanLabel(school.plan)}</span>
                  </SaTooltip>
                </td>
                <td className="px-4 py-3.5 tabular-nums text-slate-700">
                  {school.student_count}
                </td>
                <td className="px-4 py-3.5 text-slate-600">{formatDate(school.created_at)}</td>
                <td
                  className="px-4 py-3.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <SchoolActionsMenu
                    school={school}
                    onView={() => setDrawerSchool(school)}
                    onArchive={() => setArchiveTarget(school)}
                    onRestore={() => setRestoreTarget(school)}
                    onDelete={() => {
                      setDeleteTarget(school);
                      setDeleteConfirmText("");
                      setDeleteFinalOpen(false);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </div>
        </div>
      </div>

      {archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Archive School?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              This school will be removed from active listings but all data will
              remain safely stored and can be restored later.
            </p>
            <p className="mt-3 font-medium text-slate-800">{archiveTarget.name}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className={cn(saBtnSecondary, "flex-1")}
              >
                Cancel
              </button>
              <SuperAdminLoadingButton
                type="button"
                disabled={busyId === archiveTarget.id}
                loading={busyId === archiveTarget.id}
                loadingLabel="Archiving…"
                onClick={async () => {
                  await runLifecycle(archiveTarget.id, "archive");
                  setArchiveTarget(null);
                }}
                className={cn(saBtnArchiveOutline, "flex-1 px-4 py-2 text-sm")}
              >
                Archive
              </SuperAdminLoadingButton>
            </div>
          </div>
        </div>
      ) : null}

      {restoreTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Restore School?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Restore this school back to active operations?
            </p>
            <p className="mt-3 font-medium text-slate-800">{restoreTarget.name}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className={cn(saBtnSecondary, "flex-1")}
              >
                Cancel
              </button>
              <SuperAdminLoadingButton
                type="button"
                disabled={busyId === restoreTarget.id}
                loading={busyId === restoreTarget.id}
                loadingLabel="Restoring…"
                onClick={async () => {
                  await runLifecycle(restoreTarget.id, "restore");
                  setRestoreTarget(null);
                }}
                className={cn(saBtnPrimary, "flex-1")}
              >
                Restore
              </SuperAdminLoadingButton>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            {!deleteTarget.can_delete_permanently ? (
              <>
                <h3 className="text-lg font-semibold text-red-700">
                  Cannot delete school
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  This school contains operational data and cannot be permanently
                  deleted.
                </p>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className={cn(saBtnSecondary, "mt-5 w-full")}
                >
                  Close
                </button>
              </>
            ) : !deleteFinalOpen ? (
              <>
                <h3 className="text-lg font-semibold text-slate-950">Delete permanently?</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Type <strong className="text-slate-800">DELETE</strong> to continue.
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className={cn(saInput, "mt-3 w-full")}
                  placeholder="DELETE"
                />
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className={cn(saBtnSecondary, "flex-1")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteConfirmText !== "DELETE"}
                    onClick={() => setDeleteFinalOpen(true)}
                    className={cn(saBtnDangerOutline, "flex-1")}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-red-700">
                  This action cannot be undone
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Permanently delete <strong className="text-slate-800">{deleteTarget.name}</strong>?
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteFinalOpen(false)}
                    className={cn(saBtnSecondary, "flex-1")}
                  >
                    Go back
                  </button>
                  <SuperAdminLoadingButton
                    type="button"
                    disabled={busyId === deleteTarget.id}
                    loading={busyId === deleteTarget.id}
                    loadingLabel="Deleting…"
                    onClick={async () => {
                      await runLifecycle(deleteTarget.id, "delete", "DELETE");
                      setDeleteTarget(null);
                      setDeleteFinalOpen(false);
                    }}
                    className={cn(saBtnDangerOutline, "flex-1")}
                  >
                    Delete permanently
                  </SuperAdminLoadingButton>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <SchoolSummaryDrawer
        school={drawerSchool}
        onClose={() => setDrawerSchool(null)}
      />
    </div>
  );
}
