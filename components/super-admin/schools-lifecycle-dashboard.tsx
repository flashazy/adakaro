"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  healthScoreIndicatorDot,
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
  saMobileSectionLead,
  saMobileSectionLeadFirst,
  saMobileSectionContentGap,
  saMobileExecutiveTitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { enterSuperAdminSchoolWorkspace } from "@/lib/super-admin/open-school-workspace.client";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import { cn } from "@/lib/utils";

const saDashboardPanel = cn(
  saSection,
  "max-md:rounded-xl max-md:px-4 max-md:py-3"
);

const saDashboardGrowthPanel =
  "rounded-xl border border-emerald-100 bg-emerald-50/30 px-4 py-4 shadow-sm max-md:rounded-xl max-md:px-3.5 max-md:py-3 sm:rounded-2xl sm:px-5 sm:py-5";

const saDashboardAttentionPanel =
  "rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-4 shadow-sm max-md:rounded-xl max-md:px-3.5 max-md:py-3 sm:rounded-2xl sm:px-5 sm:py-5";

const saDashboardToolbar = cn(
  saDirectoryToolbar,
  "max-md:rounded-xl max-md:px-4 max-md:py-3"
);

const saMobileCardActionBtn =
  "inline-flex min-h-11 w-full items-center justify-center py-2 sm:min-h-0 sm:w-auto sm:py-1.5";

const saMobileFieldLabel =
  "text-[9px] font-medium uppercase tracking-wide text-slate-400/60";

function FunnelArrowVertical() {
  return (
    <div
      className="flex h-2 shrink-0 items-center justify-center sm:hidden"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3 text-slate-300/90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

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
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 max-md:left-3.5 max-md:h-[18px] max-md:w-[18px]"
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

const saMobileSearchInput = cn(
  saSearchInput,
  "max-md:h-12 max-md:rounded-xl max-md:py-0 max-md:pl-10 max-md:pr-3 max-md:text-[15px] max-md:focus:border-indigo-500 max-md:focus:ring-2 max-md:focus:ring-indigo-100/80"
);

const saMobilePlanSelect = cn(
  saInput,
  "max-md:h-12 max-md:rounded-xl max-md:border-slate-300 max-md:py-0 max-md:text-[15px] max-md:focus:border-indigo-500 max-md:focus:ring-2 max-md:focus:ring-indigo-100/80"
);

const saMobileFilterTabActive = cn(
  saFilterTabActive,
  "max-md:scale-100 max-md:shadow-sm max-md:ring-2 max-md:ring-indigo-500/25"
);

const saMobileFilterTabInactive = cn(
  saFilterTabInactive,
  "max-md:bg-slate-50 max-md:text-slate-600"
);

function DirectoryStatusFilterTabs({
  tabs,
  statusFilter,
  onSelect,
}: {
  tabs: { key: StatusFilter; label: string; count: number }[];
  statusFilter: StatusFilter;
  onSelect: (key: StatusFilter) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setFadeLeft(el.scrollLeft > 6);
    setFadeRight(maxScroll > 6 && el.scrollLeft < maxScroll - 6);
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades, { passive: true });

    const observer = new ResizeObserver(updateFades);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
      observer.disconnect();
    };
  }, [updateFades, tabs]);

  return (
    <div className="relative md:contents">
      {fadeLeft ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white via-white/90 to-transparent md:hidden dark:from-zinc-900 dark:via-zinc-900/90"
          aria-hidden
        />
      ) : null}
      {fadeRight ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white via-white/90 to-transparent md:hidden dark:from-zinc-900 dark:via-zinc-900/90"
          aria-hidden
        />
      ) : null}
      <div
        ref={scrollRef}
        className="flex gap-2 max-md:-mx-0.5 max-md:overflow-x-auto max-md:scroll-smooth max-md:pb-0.5 max-md:pr-4 max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 text-xs font-medium transition-all duration-200 sm:px-4 sm:py-2 sm:text-sm",
              "max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:py-2",
              statusFilter === tab.key ? saMobileFilterTabActive : saMobileFilterTabInactive,
              "max-md:last:mr-1"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
    </div>
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
  buttonClassName,
}: {
  school: SuperAdminSchoolRow;
  onView: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  buttonClassName?: string;
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
        className={cn(saBtnActionMenu, buttonClassName)}
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
    <div className="space-y-4 overflow-x-hidden sm:space-y-6">
      <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 lg:grid-cols-4 lg:gap-4">
        <SaKpiCard label="Setup Schools" value={lifecycleStats.setupSchools} />
        <SaKpiCard label="Active Schools" value={lifecycleStats.activeSchools} />
        <SaKpiCard label="Inactive Schools" value={lifecycleStats.inactiveSchools} />
        <SaKpiCard label="Archived Schools" value={lifecycleStats.archivedSchools} />
      </div>

      <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 lg:grid-cols-4 lg:gap-4">
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
        <SaKpiCard
          label="Schools At Risk"
          value={lifecycleStats.schoolsAtRisk}
          emphasizeMobile
        />
      </div>

      <SaSectionAnchor
        label="Health Overview"
        id="sa-health-overview"
        className={saMobileSectionLeadFirst}
      />
      <section className={saDashboardPanel} aria-labelledby="sa-health-overview">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
          <SaSectionHeader
            title="School Health Overview"
            className={cn("max-md:text-base", saMobileExecutiveTitle)}
          />
          {healthTotal > 0 ? (
            <div className="flex w-full items-center gap-1.5 text-xs max-md:font-medium sm:w-auto sm:gap-2 sm:text-sm">
              <span className="text-slate-500 max-md:font-semibold max-md:text-slate-700">
                Platform Health:
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset max-md:px-2.5 max-md:py-1 max-md:text-xs max-md:font-bold sm:px-2.5 sm:text-xs",
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
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:rounded-xl sm:text-sm">
                {healthCallout}
              </p>
            ) : null}
            <div className="mt-3 flex h-2.5 w-full min-w-0 overflow-hidden rounded-full bg-slate-100 sm:mt-4 sm:h-3">
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
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:mt-4 sm:grid-cols-2 sm:gap-2">
              {healthRows.map((row) => (
                <div
                  key={row.label}
                  className="flex min-h-[2.25rem] items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2 text-xs sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", row.barClass)}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">{row.label}</span>{" "}
                      <span className="text-xs text-slate-500">({row.range})</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums text-slate-700">
                    <span className="min-w-[1.25rem] text-right font-medium">
                      {row.count}
                    </span>
                    <span className="min-w-[2.75rem] text-right text-slate-500">
                      ({row.percent}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <SaSectionAnchor
        label="Growth Opportunities"
        id="sa-growth-opportunities"
        className={saMobileSectionLead}
      />
      <section
        className={saDashboardGrowthPanel}
        aria-labelledby="sa-growth-opportunities"
      >
        <SaSectionHeader
          title="Growth Opportunities"
          subtitle="Schools closest to becoming successful, expanding clients."
          className={cn("max-md:text-base", saMobileExecutiveTitle)}
          subtitleClassName="max-md:mt-0.5 max-md:text-xs"
        />
        {growthOpportunities.length === 0 ? (
          <SaEmptyState
            message="No growth opportunities to highlight right now."
            className="mt-4 border-emerald-100 bg-white/60"
          />
        ) : (
          <ol className={cn("mt-3 space-y-2.5 sm:mt-4 sm:space-y-3", saMobileSectionContentGap)}>
            {growthOpportunities.map((item, index) => {
              const badge = growthOpportunityBadge(item.insight);
              return (
                <li
                  key={item.school.id}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4",
                    saInteractiveCard,
                    "max-md:hover:translate-y-0 max-md:hover:shadow-sm"
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 sm:h-8 sm:w-8 sm:text-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-snug text-slate-950">
                      {item.school.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className={cn(saChipCalm, badge.className)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                      {item.school.student_count} students · {item.school.health_label}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold leading-snug text-emerald-800 sm:mt-1.5 sm:text-xs sm:font-medium sm:text-emerald-700">
                      {item.insight}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerSchool(item.school)}
                    className={cn(saBtnSecondarySm, "shrink-0 self-start")}
                  >
                    View
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div>
          <SaSectionAnchor
            label="Recommended Actions"
            id="sa-recommended-actions"
            className={saMobileSectionLead}
          />
          <section className={saDashboardPanel} aria-labelledby="sa-recommended-actions">
          <SaSectionHeader
            title="Recommended Actions"
            subtitle="What to focus on today."
            className={cn("max-md:text-base", saMobileExecutiveTitle)}
            subtitleClassName="max-md:mt-0.5 max-md:text-xs"
          />
          <ul className={cn("mt-3 space-y-1.5 sm:mt-4 sm:space-y-3", saMobileSectionContentGap)}>
            {recommendedActions.map((action) => (
              <li
                key={action}
                className="flex min-h-[2.5rem] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs font-medium text-slate-800 transition-all duration-150 max-md:active:scale-[0.99] max-md:active:bg-slate-100 sm:min-h-0 sm:items-start sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3 sm:text-sm sm:font-normal sm:text-slate-700"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-base leading-none ring-1 ring-slate-200/90 max-md:shadow-sm sm:h-7 sm:w-7 sm:rounded-none sm:bg-transparent sm:text-base sm:ring-0 sm:shadow-none"
                  aria-hidden
                >
                  {recommendedActionIcon(action)}
                </span>
                <span className="min-w-0 flex-1 leading-snug sm:leading-relaxed">
                  {action}
                </span>
              </li>
            ))}
          </ul>
        </section>
        </div>

        <div>
          <SaSectionAnchor label="Lifecycle Funnel" className={saMobileSectionLead} />
          <section className={cn(saDashboardPanel, "flex flex-col justify-center")}>
          <SaSectionHeader
            title="Schools Lifecycle Funnel"
            className="max-md:text-base"
          />
          <div className={cn("mt-3 flex w-full flex-col items-stretch sm:mt-5 sm:flex-row sm:items-stretch sm:gap-3", "max-md:mt-2 max-md:gap-0")}>
            {funnelSteps.map((step, index) => (
              <div
                key={step.label}
                className="flex w-full min-w-0 flex-col items-stretch sm:flex-1 sm:flex-row"
              >
                {index > 0 ? (
                  <>
                    <FunnelArrowVertical />
                    <FunnelArrow />
                  </>
                ) : null}
                <div className="flex min-h-[3.25rem] w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center shadow-sm transition-all duration-200 sm:min-h-[5.5rem] sm:flex-1 sm:rounded-2xl sm:px-3 sm:py-4 sm:hover:-translate-y-0.5 sm:hover:shadow-md">
                  <p className="text-lg font-extrabold tabular-nums leading-none text-slate-950 sm:text-xl sm:font-bold">
                    {step.count}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium leading-tight text-slate-600 sm:text-xs">
                    {step.label}
                  </p>
                  {step.sublabel ? (
                    <p className="text-[9px] leading-tight text-slate-400 sm:text-[10px]">
                      {step.sublabel}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>

      <SaSectionAnchor
        label="Attention Queue"
        id="sa-attention-queue"
        className={saMobileSectionLead}
      />
      <section
        className={saDashboardAttentionPanel}
        aria-labelledby="sa-attention-queue"
      >
        <SaSectionHeader
          title="Schools Requiring Attention"
          className="max-md:text-base"
        />
        {attentionSchools.length === 0 ? (
          <SaEmptyState
            message="No schools currently require attention."
            className="mt-4 border-amber-100 bg-white/60"
          />
        ) : (
          <ul className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {attentionSchools.map((school) => (
              <li
                key={school.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 pl-2.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-2xl sm:p-4 sm:pl-3",
                  attentionSeverityAccent(school.priority),
                  saInteractiveCard,
                  "max-md:hover:translate-y-0 max-md:hover:shadow-sm"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-slate-950">
                    {school.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 sm:mt-2">
                    {school.badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={cn(saChipCalm, badge.className)}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 sm:mt-2">
                    Health: {school.health_score} · Last activity:{" "}
                    {formatSchoolLastActivity(school.last_activity_at)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerSchool(school)}
                    className={cn(saBtnSecondarySm, saMobileCardActionBtn)}
                  >
                    View
                  </button>
                  {school.school_status !== "archived" ? (
                    <SuperAdminLoadingButton
                      type="button"
                      disabled={busyId === school.id}
                      loading={busyId === school.id}
                      loadingLabel="Archiving…"
                      onClick={() => setArchiveTarget(school)}
                      className={cn(saBtnArchiveOutline, saMobileCardActionBtn)}
                    >
                      Archive
                    </SuperAdminLoadingButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={cn("max-md:space-y-3", saMobileSectionLead)}>
        <SaSectionAnchor
          label="Schools Directory"
          id="sa-schools-directory"
        />
        <div aria-labelledby="sa-schools-directory" className="space-y-3 sm:space-y-4">
          <div className={saDashboardToolbar}>
            <p className="text-xs text-slate-600 sm:text-sm">
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

            <DirectoryStatusFilterTabs
              tabs={statusTabs}
              statusFilter={statusFilter}
              onSelect={setStatusFilter}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                <div className="relative w-full min-w-0 flex-1 sm:min-w-[12rem]">
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Search schools by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={saMobileSearchInput}
                  />
                </div>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className={cn(saMobilePlanSelect, "w-full sm:w-auto")}
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

      <div className="space-y-2 md:hidden">
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
              "rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm",
              saInteractiveCard,
              saTableRowHover,
              "max-md:hover:translate-y-0 max-md:hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <SaRankBadge rank={index + 1} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-snug text-slate-950">
                    {school.name}
                  </p>
                  {school.id === topHealthSchoolId ? (
                    <div className="mt-0.5">
                      <SaTooltip content={SA_TOOLTIPS.topSchool}>
                        <SaTopSchoolBadge />
                      </SaTooltip>
                    </div>
                  ) : null}
                </div>
              </div>
              <SaTooltip content={SA_TOOLTIPS.status}>
                <span
                  className={cn(
                    saStatusBadge,
                    "shrink-0",
                    schoolLifecycleStatusBadgeClass(school.school_status)
                  )}
                >
                  {schoolLifecycleStatusLabel(school.school_status)}
                </span>
              </SaTooltip>
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <dt className={saMobileFieldLabel}>Health</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      healthScoreIndicatorDot(school.health_category)
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-sm font-extrabold tabular-nums leading-none",
                      healthScoreValueColor(school.health_category)
                    )}
                  >
                    {school.health_score}
                    <span className="text-[10px] font-normal text-slate-400">
                      {" "}
                      /100
                    </span>
                  </span>
                </dd>
              </div>
              <div>
                <dt className={saMobileFieldLabel}>Plan</dt>
                <dd className="mt-0.5 font-medium text-slate-600">
                  {binaryPlanLabel(school.plan)}
                </dd>
              </div>
              <div>
                <dt className={saMobileFieldLabel}>Students</dt>
                <dd className="mt-0.5 tabular-nums text-slate-600">
                  {school.student_count}
                </dd>
              </div>
              <div>
                <dt className={saMobileFieldLabel}>Activity</dt>
                <dd className="mt-0.5 leading-snug text-slate-600">
                  {formatSchoolLastActivity(school.last_activity_at)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className={saMobileFieldLabel}>Created</dt>
                <dd className="mt-0.5 text-slate-600">{formatDate(school.created_at)}</dd>
              </div>
            </dl>
            <div
              className="mt-2 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setDrawerSchool(school)}
                className={cn(saBtnSecondarySm, saMobileCardActionBtn)}
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
                buttonClassName={cn(saMobileCardActionBtn, "justify-center")}
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
