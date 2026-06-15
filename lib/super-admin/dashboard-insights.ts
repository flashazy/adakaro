import { daysSinceIso } from "@/lib/super-admin/school-health";
import { isPaidPlanId } from "@/lib/plans";
import type {
  SuperAdminLifecycleStats,
  SuperAdminSchoolRow,
} from "@/lib/super-admin/types";
import {
  isSetupSchoolNeedingAttention,
  normalizeSchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";

export interface GrowthOpportunity {
  school: SuperAdminSchoolRow;
  rankScore: number;
  insight: string;
}

export interface AttentionReasonBadge {
  label: string;
  className: string;
}

export interface BusinessSnapshot {
  paidSchools: number;
  freeSchools: number;
  averageHealthScore: number;
  averageStudentsPerSchool: number;
}

const RECENT_ACTIVITY_DAYS = 30;

function isRecentActivity(iso: string | null | undefined): boolean {
  const days = daysSinceIso(iso);
  return days !== null && days <= RECENT_ACTIVITY_DAYS;
}

export function computeBusinessSnapshot(
  schools: SuperAdminSchoolRow[]
): BusinessSnapshot {
  const visible = schools.filter(
    (s) => normalizeSchoolLifecycleStatus(s.school_status) !== "archived"
  );
  if (visible.length === 0) {
    return {
      paidSchools: 0,
      freeSchools: 0,
      averageHealthScore: 0,
      averageStudentsPerSchool: 0,
    };
  }

  const paidSchools = visible.filter((s) => isPaidPlanId(s.plan)).length;
  const totalHealth = visible.reduce((sum, s) => sum + s.health_score, 0);
  const totalStudents = visible.reduce((sum, s) => sum + s.student_count, 0);

  return {
    paidSchools,
    freeSchools: visible.length - paidSchools,
    averageHealthScore: Math.round(totalHealth / visible.length),
    averageStudentsPerSchool: Math.round(totalStudents / visible.length),
  };
}

function growthOpportunityInsight(school: SuperAdminSchoolRow): string {
  if (
    school.health_category === "excellent" ||
    school.health_category === "healthy"
  ) {
    if (school.student_count >= 40 || isPaidPlanId(school.plan)) {
      return "Potential expansion candidate";
    }
    return "Healthy growth school";
  }
  if (school.health_category === "at_risk") {
    return "Needs engagement";
  }
  return "Needs onboarding support";
}

function growthOpportunityScore(school: SuperAdminSchoolRow): number {
  const status = normalizeSchoolLifecycleStatus(school.school_status);
  if (status === "archived") return -1;

  let score = school.student_count * 2;
  score += school.health_score * 0.6;
  if (isPaidPlanId(school.plan)) score += 40;
  if (isRecentActivity(school.last_activity_at)) score += 25;
  if (status === "active") score += 20;
  if (school.health_category === "excellent") score += 15;
  if (school.health_category === "healthy") score += 10;
  return score;
}

export function computeGrowthOpportunities(
  schools: SuperAdminSchoolRow[],
  limit = 5
): GrowthOpportunity[] {
  return schools
    .filter((s) => {
      const status = normalizeSchoolLifecycleStatus(s.school_status);
      if (status === "archived") return false;
      return s.student_count > 0 || status === "active";
    })
    .map((school) => ({
      school,
      rankScore: growthOpportunityScore(school),
      insight: growthOpportunityInsight(school),
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, limit);
}

export function computeRecommendedActions(
  schools: SuperAdminSchoolRow[],
  lifecycleStats: SuperAdminLifecycleStats
): string[] {
  const actions: string[] = [];

  if (lifecycleStats.setupSchoolsOlderThan14Days > 0) {
    actions.push(
      `Contact ${lifecycleStats.setupSchoolsOlderThan14Days} Setup school${lifecycleStats.setupSchoolsOlderThan14Days === 1 ? "" : "s"} older than 14 days`
    );
  }

  const atRiskPaid = schools.filter((s) => {
    const status = normalizeSchoolLifecycleStatus(s.school_status);
    return (
      status === "active" &&
      s.health_category === "at_risk" &&
      isPaidPlanId(s.plan)
    );
  }).length;

  if (atRiskPaid > 0) {
    actions.push(
      `Follow up with ${atRiskPaid} At-Risk paid school${atRiskPaid === 1 ? "" : "s"}`
    );
  }

  const lowHealth = schools.filter((s) => {
    const status = normalizeSchoolLifecycleStatus(s.school_status);
    return status !== "archived" && s.health_score < 40;
  }).length;

  if (lowHealth > 0) {
    actions.push(`Review ${lowHealth} low-health school${lowHealth === 1 ? "" : "s"}`);
  }

  const abandonTest = schools.filter((s) => {
    const status = normalizeSchoolLifecycleStatus(s.school_status);
    return status === "setup" && s.can_delete_permanently;
  }).length;

  if (abandonTest > 0) {
    actions.push(
      `Archive ${abandonTest} abandoned test school${abandonTest === 1 ? "" : "s"}`
    );
  }

  if (lifecycleStats.inactiveSchools > 0) {
    actions.push(
      `Re-engage ${lifecycleStats.inactiveSchools} inactive school${lifecycleStats.inactiveSchools === 1 ? "" : "s"}`
    );
  }

  if (actions.length === 0) {
    actions.push("All schools look stable — monitor growth opportunities below");
  }

  return actions;
}

export function getAttentionReasonBadges(
  school: SuperAdminSchoolRow
): AttentionReasonBadge[] {
  const badges: AttentionReasonBadge[] = [];
  const status = normalizeSchoolLifecycleStatus(school.school_status);

  if (status === "inactive") {
    badges.push({
      label: "Inactive",
      className:
        "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50",
    });
  }

  if (isSetupSchoolNeedingAttention(status, school.created_at)) {
    badges.push({
      label: "Setup >14 days",
      className:
        "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/60",
    });
  }

  if (school.health_score < 40) {
    badges.push({
      label: "Low health",
      className:
        "bg-red-50 text-red-800 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50",
    });
  }

  if (school.student_count === 0) {
    badges.push({
      label: "No students",
      className:
        "bg-orange-50 text-orange-800 ring-orange-200/70 dark:bg-orange-950/35 dark:text-orange-300 dark:ring-orange-900/40",
    });
  }

  if ((school.payment_count ?? 0) === 0 && school.student_count > 0) {
    badges.push({
      label: "No payments",
      className:
        "bg-orange-50 text-orange-800 ring-orange-200/70 dark:bg-orange-950/35 dark:text-orange-300 dark:ring-orange-900/40",
    });
  }

  const daysSince = daysSinceIso(school.last_activity_at);
  if (daysSince !== null && daysSince >= RECENT_ACTIVITY_DAYS) {
    badges.push({
      label: `No activity ${RECENT_ACTIVITY_DAYS}+ days`,
      className:
        "bg-amber-50 text-amber-900 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/40",
    });
  }

  return badges;
}

export function getSchoolRecommendedNextAction(
  school: SuperAdminSchoolRow
): string {
  const status = normalizeSchoolLifecycleStatus(school.school_status);

  if (status === "archived") {
    return "Review restore or permanent deletion";
  }

  if (status === "setup") {
    return "Encourage onboarding";
  }

  if (status === "inactive") {
    return "Monitor closely";
  }

  if (
    school.health_category === "excellent" ||
    (school.health_category === "healthy" && school.student_count >= 40)
  ) {
    return "Expansion opportunity";
  }

  if (school.health_category === "healthy") {
    return "Healthy school";
  }

  if (school.health_category === "at_risk") {
    return "Needs engagement follow-up";
  }

  return "Needs onboarding support";
}

export interface LifecycleFunnelStep {
  label: string;
  count: number;
  sublabel?: string;
}

export function computeLifecycleFunnel(
  schools: SuperAdminSchoolRow[],
  lifecycleStats: SuperAdminLifecycleStats
): LifecycleFunnelStep[] {
  const total = schools.filter(
    (s) => normalizeSchoolLifecycleStatus(s.school_status) !== "archived"
  ).length;

  return [
    { label: "Total Schools", count: total },
    { label: "Setup", count: lifecycleStats.setupSchools },
    { label: "Active", count: lifecycleStats.activeSchools },
    {
      label: "Healthy",
      count: lifecycleStats.healthHealthy,
      sublabel: "70–89",
    },
    {
      label: "Excellent",
      count: lifecycleStats.healthExcellent,
      sublabel: "90–100",
    },
  ];
}

export function healthDistributionRows(
  lifecycleStats: SuperAdminLifecycleStats
): {
  label: string;
  range: string;
  count: number;
  percent: number;
  barClass: string;
}[] {
  const total =
    lifecycleStats.healthExcellent +
    lifecycleStats.healthHealthy +
    lifecycleStats.healthAtRisk +
    lifecycleStats.healthInactive;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return [
    {
      label: "Excellent",
      range: "90–100",
      count: lifecycleStats.healthExcellent,
      percent: pct(lifecycleStats.healthExcellent),
      barClass: "bg-emerald-500",
    },
    {
      label: "Healthy",
      range: "70–89",
      count: lifecycleStats.healthHealthy,
      percent: pct(lifecycleStats.healthHealthy),
      barClass: "bg-blue-500",
    },
    {
      label: "At Risk",
      range: "40–69",
      count: lifecycleStats.healthAtRisk,
      percent: pct(lifecycleStats.healthAtRisk),
      barClass: "bg-amber-500",
    },
    {
      label: "Inactive",
      range: "0–39",
      count: lifecycleStats.healthInactive,
      percent: pct(lifecycleStats.healthInactive),
      barClass: "bg-red-500",
    },
  ];
}
