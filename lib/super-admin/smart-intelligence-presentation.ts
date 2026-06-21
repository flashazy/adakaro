import { formatAnalyticsCurrency } from "@/lib/analytics-format";
import { isPaidPlanId } from "@/lib/plans";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import type {
  IntelligenceCardId,
  SmartIntelligencePayload,
} from "@/lib/super-admin/smart-intelligence-types";

export type PlatformHealthLabel =
  | "Critical"
  | "Poor"
  | "Healthy"
  | "Excellent";

export type PrioritySeverity = "critical" | "medium" | "low";

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export interface ExecutiveMicroKpis {
  schools: number;
  paid: number;
  atRisk: number;
  champions: number;
  stuckSetup: number;
}

export interface ExecutiveSummaryView {
  narrative: string;
  healthBadge: { label: PlatformHealthLabel; tone: "critical" | "warning" | "healthy" | "excellent" };
  totalAlerts: number;
  activeSchools: number;
  totalSchools: number;
  microKpis: ExecutiveMicroKpis;
}

export interface PlatformHealthView {
  score: number;
  label: PlatformHealthLabel;
  tone: "critical" | "warning" | "healthy" | "excellent";
}

export interface ScorecardTrendView {
  direction: TrendDirection;
  label: string;
}

export interface ScorecardSparklineView {
  points: number[];
  placeholder: boolean;
}

export interface ScorecardView {
  id: IntelligenceCardId;
  title: string;
  headlineValue: string;
  statusBadge: { label: string; tone: string };
  trend: ScorecardTrendView;
  insight: string;
  sparkline: ScorecardSparklineView;
}

export type PriorityVisualSeverity = "critical" | "high" | "medium" | "low";

export interface PriorityAttentionRow {
  id: string;
  school: string;
  issue: string;
  severity: PrioritySeverity;
  visualSeverity: PriorityVisualSeverity;
  recommendedAction: string;
  status: "Pending";
  sortScore: number;
}

export interface RecommendedActionItem {
  id: string;
  emoji: string;
  title: string;
  impactBadge: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: "critical" | "warning" | "healthy" | "neutral";
}

export interface RevenueOpportunityRow {
  id: string;
  school: string;
  students: number;
  engagement: number;
  likelihood: number;
}

export interface ChampionSchoolRow {
  id: string;
  school: string;
  engagementScore: number;
  students: number;
  plan: string;
}

const INSUFFICIENT_TREND = "Insufficient trend history";

function buildMicroKpis(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[]
): ExecutiveMicroKpis {
  return {
    schools: schools.length,
    paid: schools.filter((s) => isPaidPlanId(s.plan)).length,
    atRisk: data.risk.schoolsAtRisk.length,
    champions: data.engagement.schools.filter((s) => s.label === "champion").length,
    stuckSetup: data.onboarding.stuckCount,
  };
}

/** Presentation-only placeholder sparkline (30-day visual). */
function buildSparkline(
  cardId: IntelligenceCardId,
  data: SmartIntelligencePayload
): ScorecardSparklineView {
  const points: number[] = [];
  const steps = 12;

  if (cardId === "revenue" && data.revenue.growthPercent !== null) {
    const dir = data.revenue.growthDirection;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      if (dir === "up") points.push(0.35 + t * 0.55);
      else if (dir === "down") points.push(0.9 - t * 0.55);
      else points.push(0.55 + Math.sin(t * Math.PI) * 0.05);
    }
    return { points, placeholder: false };
  }

  for (let i = 0; i < steps; i++) {
    const wobble = Math.sin(i * 0.9) * 0.04;
    points.push(0.5 + wobble);
  }
  return { points, placeholder: true };
}

function deriveVisualSeverity(
  severity: PrioritySeverity,
  sortScore: number
): PriorityVisualSeverity {
  if (severity === "critical") return "critical";
  if (severity === "medium" && sortScore >= 65) return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function platformHealthLabel(score: number): PlatformHealthLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Healthy";
  if (score >= 40) return "Poor";
  return "Critical";
}

function platformHealthTone(
  score: number
): "critical" | "warning" | "healthy" | "excellent" {
  if (score >= 80) return "excellent";
  if (score >= 60) return "healthy";
  if (score >= 40) return "warning";
  return "critical";
}

/** Presentation-only composite — does not alter underlying intelligence formulas. */
export function computePlatformHealth(
  data: SmartIntelligencePayload,
  totalSchools: number
): PlatformHealthView {
  const { churn, risk, onboarding, engagement } = data;

  const churnComponent =
    totalSchools > 0
      ? Math.round(
          100 -
            (churn.highRiskCount / totalSchools) * 55 -
            (churn.mediumRiskCount / totalSchools) * 25
        )
      : 100;

  const riskComponent = Math.max(0, 100 - risk.averageRiskScore);
  const onboardingComponent = onboarding.averageProgress;
  const engagementComponent = engagement.averageScore;

  const score = Math.round(
    (churnComponent + riskComponent + onboardingComponent + engagementComponent) / 4
  );
  const clamped = Math.max(0, Math.min(100, score));

  return {
    score: clamped,
    label: platformHealthLabel(clamped),
    tone: platformHealthTone(clamped),
  };
}

export function buildExecutiveSummary(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[],
  activeSchools: number
): ExecutiveSummaryView {
  const totalSchools = schools.length;
  const churnRiskCount =
    data.churn.highRiskCount + data.churn.mediumRiskCount;
  const stuckCount = data.onboarding.stuckCount;
  const engagementScore = data.engagement.averageScore;
  const health = computePlatformHealth(data, totalSchools);

  if (totalSchools === 0) {
    return {
      narrative:
        "No schools are registered yet. Intelligence summaries will appear once schools join the platform.",
      healthBadge: { label: health.label, tone: health.tone },
      totalAlerts: 0,
      activeSchools: 0,
      totalSchools: 0,
      microKpis: {
        schools: 0,
        paid: 0,
        atRisk: 0,
        champions: 0,
        stuckSetup: 0,
      },
    };
  }

  const engagementPhrase =
    engagementScore >= 60
      ? `remains strong at ${engagementScore}/100`
      : engagementScore >= 40
        ? `is moderate at ${engagementScore}/100`
        : `needs attention at ${engagementScore}/100`;

  const middleParts: string[] = [];
  if (churnRiskCount > 0) {
    middleParts.push(
      `${churnRiskCount} school${churnRiskCount === 1 ? "" : "s"} show${churnRiskCount === 1 ? "s" : ""} churn risk`
    );
  }
  if (stuckCount > 0) {
    middleParts.push(
      `${stuckCount} school${stuckCount === 1 ? "" : "s"} remain${stuckCount === 1 ? "s" : ""} stuck in onboarding`
    );
  }

  let narrative = `${activeSchools} school${activeSchools === 1 ? "" : "s"} ${activeSchools === 1 ? "is" : "are"} currently active`;
  if (middleParts.length > 0) {
    narrative += `. ${middleParts.join(", ")}`;
  }
  narrative += `, and platform engagement ${engagementPhrase}.`;

  const needsAttention =
    data.churn.highRiskCount > 0 ||
    stuckCount > 0 ||
    engagementScore < 60 ||
    health.score < 60;

  if (needsAttention) {
    narrative +=
      " Immediate attention is recommended for high-risk schools and incomplete onboarding accounts.";
  } else {
    narrative += " Platform health is stable — continue monitoring key signals weekly.";
  }

  const totalAlerts =
    data.churn.highRiskCount +
    stuckCount +
    data.risk.schoolsAtRisk.length;

  return {
    narrative,
    healthBadge: { label: health.label, tone: health.tone },
    totalAlerts,
    activeSchools,
    totalSchools,
    microKpis: buildMicroKpis(data, schools),
  };
}

function revenueTrend(data: SmartIntelligencePayload): ScorecardTrendView {
  const { growthDirection, growthPercent } = data.revenue;
  if (growthPercent !== null) {
    if (growthDirection === "up") {
      return { direction: "up", label: `↑ ${growthPercent}% forecast growth` };
    }
    if (growthDirection === "down") {
      return { direction: "down", label: `↓ ${Math.abs(growthPercent)}% forecast decline` };
    }
    return { direction: "flat", label: "Stable revenue forecast" };
  }
  if (growthDirection === "up") {
    return { direction: "up", label: "↑ Revenue forecast improving" };
  }
  if (growthDirection === "down") {
    return { direction: "down", label: "↓ Revenue forecast declining" };
  }
  return { direction: "unknown", label: INSUFFICIENT_TREND };
}

export function buildScorecards(
  data: SmartIntelligencePayload
): ScorecardView[] {
  const { churn, risk, revenue, onboarding, engagement } = data;

  const championCount = engagement.schools.filter(
    (s) => s.label === "champion"
  ).length;

  return [
    {
      id: "churn",
      title: "Churn Prediction",
      headlineValue: churn.headlineValue,
      statusBadge: churn.statusBadge,
      trend: { direction: "unknown", label: INSUFFICIENT_TREND },
      sparkline: buildSparkline("churn", data),
      insight:
        churn.highRiskCount + churn.mediumRiskCount > 0
          ? `${churn.highRiskCount + churn.mediumRiskCount} school${churn.highRiskCount + churn.mediumRiskCount === 1 ? "" : "s"} flagged at elevated churn risk`
          : "No elevated churn signals across schools",
    },
    {
      id: "risk",
      title: "School Risk Scoring",
      headlineValue: risk.headlineValue,
      statusBadge: risk.statusBadge,
      trend: { direction: "unknown", label: INSUFFICIENT_TREND },
      sparkline: buildSparkline("risk", data),
      insight:
        risk.schoolsAtRisk.length > 0
          ? `${risk.schoolsAtRisk.length} school${risk.schoolsAtRisk.length === 1 ? "" : "s"} above risk threshold`
          : `Average operational risk ${risk.averageRiskScore}/100`,
    },
    {
      id: "revenue",
      title: "Revenue Forecasting",
      headlineValue: revenue.headlineValue,
      statusBadge: revenue.statusBadge,
      trend: revenueTrend(data),
      sparkline: buildSparkline("revenue", data),
      insight:
        revenue.growthDirection === "down"
          ? "Review schools with declining payment activity"
          : `${revenue.paidSchoolCount} paid school${revenue.paidSchoolCount === 1 ? "" : "s"} · ${formatAnalyticsCurrency(revenue.currentRevenue)} last 30 days`,
    },
    {
      id: "onboarding",
      title: "Onboarding Tracking",
      headlineValue: onboarding.headlineValue,
      statusBadge: onboarding.statusBadge,
      trend: { direction: "unknown", label: INSUFFICIENT_TREND },
      sparkline: buildSparkline("onboarding", data),
      insight:
        onboarding.completeCount > 0
          ? `${onboarding.completeCount} school${onboarding.completeCount === 1 ? "" : "s"} completed full setup`
          : onboarding.stuckCount > 0
            ? `${onboarding.stuckCount} school${onboarding.stuckCount === 1 ? "" : "s"} need setup support`
            : "Onboarding progressing across schools",
    },
    {
      id: "engagement",
      title: "Engagement Scoring",
      headlineValue: engagement.headlineValue,
      statusBadge: engagement.statusBadge,
      trend: { direction: "unknown", label: INSUFFICIENT_TREND },
      sparkline: buildSparkline("engagement", data),
      insight:
        championCount > 0
          ? `${championCount} champion school${championCount === 1 ? "" : "s"} driving platform usage`
          : `Platform average engagement ${engagement.averageScore}/100`,
    },
  ];
}

function severityRank(s: PrioritySeverity): number {
  if (s === "critical") return 3;
  if (s === "medium") return 2;
  return 1;
}

export function buildPriorityAttentionRows(
  data: SmartIntelligencePayload
): PriorityAttentionRow[] {
  const bySchool = new Map<string, PriorityAttentionRow>();

  function upsert(row: Omit<PriorityAttentionRow, "status" | "visualSeverity">) {
    const visualSeverity = deriveVisualSeverity(row.severity, row.sortScore);
    const existing = bySchool.get(row.id);
    if (!existing || row.sortScore > existing.sortScore) {
      bySchool.set(row.id, { ...row, visualSeverity, status: "Pending" });
    }
  }

  for (const s of data.churn.schools) {
    if (s.riskLevel === "high") {
      upsert({
        id: s.id,
        school: s.name,
        issue: "High Churn",
        severity: "critical",
        recommendedAction: "Call School Owner",
        sortScore: 90 + s.riskScore,
      });
    } else if (s.riskLevel === "medium") {
      upsert({
        id: s.id,
        school: s.name,
        issue: "Churn Risk",
        severity: "medium",
        recommendedAction: "Send engagement follow-up",
        sortScore: 60 + s.riskScore,
      });
    }
  }

  for (const s of data.risk.schoolsAtRisk) {
    const severity: PrioritySeverity =
      s.riskScore >= 60 ? "critical" : s.riskScore >= 35 ? "medium" : "low";
    upsert({
      id: s.id,
      school: s.name,
      issue: "Operational Risk",
      severity,
      recommendedAction: "Review school health",
      sortScore: 50 + s.riskScore,
    });
  }

  for (const s of data.onboarding.stuckSchools) {
    const severity: PrioritySeverity =
      s.progressPercent < 40 ? "medium" : "low";
    upsert({
      id: s.id,
      school: s.name,
      issue: "Incomplete Setup",
      severity,
      recommendedAction: "Finish Onboarding",
      sortScore: 40 + (60 - s.progressPercent),
    });
  }

  return [...bySchool.values()]
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      return b.sortScore - a.sortScore;
    })
    .slice(0, 10);
}

export function buildRecommendedActions(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[]
): RecommendedActionItem[] {
  const actions: RecommendedActionItem[] = [];
  const { churn, onboarding, engagement, revenue } = data;

  if (churn.highRiskCount > 0) {
    actions.push({
      id: "contact-churn",
      emoji: "🔥",
      title: `Contact ${churn.highRiskCount} high-risk school${churn.highRiskCount === 1 ? "" : "s"}`,
      impactBadge: `Recover ${churn.highRiskCount} school${churn.highRiskCount === 1 ? "" : "s"}`,
      description: churn.recommendedAction,
      actionLabel: "View priority schools",
      href: "#priority-attention",
      tone: "critical",
    });
  }

  if (onboarding.stuckCount > 0) {
    actions.push({
      id: "onboarding-followup",
      emoji: "⚠️",
      title: `Follow up with ${onboarding.stuckCount} onboarding school${onboarding.stuckCount === 1 ? "" : "s"}`,
      impactBadge: `Complete ${onboarding.stuckCount} setup${onboarding.stuckCount === 1 ? "" : "s"}`,
      description: onboarding.recommendedAction,
      actionLabel: "Review stuck schools",
      href: "#priority-attention",
      tone: "warning",
    });
  }

  const upsellCandidates = schools.filter((school) => {
    if (isPaidPlanId(school.plan)) return false;
    const eng = engagement.schools.find((e) => e.id === school.id);
    return eng && (eng.label === "champion" || eng.label === "active");
  });

  if (upsellCandidates.length > 0) {
    actions.push({
      id: "upsell-engaged",
      emoji: "📈",
      title: `Upsell ${upsellCandidates.length} highly engaged school${upsellCandidates.length === 1 ? "" : "s"}`,
      impactBadge: `Potential upgrades: ${upsellCandidates.length}`,
      description:
        "Free-plan schools with strong engagement are prime upgrade candidates.",
      actionLabel: "View opportunities",
      href: "#revenue-opportunities",
      tone: "healthy",
    });
  }

  if (revenue.growthDirection === "down") {
    actions.push({
      id: "revenue-review",
      emoji: "💰",
      title: "Review declining revenue trend",
      impactBadge: "Retention opportunity",
      description: revenue.recommendedAction,
      actionLabel: "Open revenue details",
      href: "#smart-intelligence-scorecards",
      tone: "warning",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "all-clear",
      emoji: "✅",
      title: "No urgent actions today",
      impactBadge: "Platform stable",
      description:
        "Platform signals are stable. Review intelligence scorecards for ongoing monitoring.",
      actionLabel: "View scorecards",
      href: "#smart-intelligence-scorecards",
      tone: "neutral",
    });
  }

  return actions;
}

/** Presentation-only upgrade likelihood from engagement + student volume. */
export function buildRevenueOpportunities(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[]
): RevenueOpportunityRow[] {
  const engagementById = new Map(
    data.engagement.schools.map((s) => [s.id, s])
  );

  return schools
    .filter((s) => !isPaidPlanId(s.plan))
    .map((school) => {
      const eng = engagementById.get(school.id);
      const engagementScore = eng?.score ?? 0;
      const studentFactor = Math.min(school.student_count / 50, 1) * 40;
      const engagementFactor = engagementScore * 0.6;
      const likelihood = Math.round(
        Math.min(99, Math.max(0, studentFactor + engagementFactor))
      );

      return {
        id: school.id,
        school: school.name,
        students: school.student_count,
        engagement: engagementScore,
        likelihood,
      };
    })
    .filter((row) => row.engagement >= 40 || row.students >= 10)
    .sort((a, b) => b.likelihood - a.likelihood)
    .slice(0, 8);
}

export function buildChampionSchools(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[]
): ChampionSchoolRow[] {
  const schoolById = new Map(schools.map((s) => [s.id, s]));

  return data.engagement.topEngaged.slice(0, 5).map((eng) => {
    const school = schoolById.get(eng.id);
    return {
      id: eng.id,
      school: eng.name,
      engagementScore: eng.score,
      students: school?.student_count ?? 0,
      plan: school?.plan ?? "free",
    };
  });
}

import {
  buildSchoolContactsHref as buildContactsNavHref,
  buildSchoolProfileHref,
  buildSchoolBroadcastHref as buildBroadcastNavHref,
} from "@/lib/super-admin/smart-intelligence-navigation";
import type { SmartIntelligenceSource } from "@/lib/super-admin/smart-intelligence-navigation";

export function schoolProfileHref(schoolId: string): string {
  return buildSchoolProfileHref(schoolId);
}

export function schoolContactsHref(
  schoolId: string,
  schoolName?: string,
  source: SmartIntelligenceSource = "general"
): string {
  return buildContactsNavHref({
    schoolId,
    schoolName: schoolName ?? "",
    source,
  });
}

export function schoolBroadcastHref(
  ctx: Parameters<typeof buildBroadcastNavHref>[0]
): string {
  return buildBroadcastNavHref(ctx);
}

export function platformHealthBarClass(
  tone: PlatformHealthView["tone"]
): string {
  switch (tone) {
    case "excellent":
      return "bg-emerald-500";
    case "healthy":
      return "bg-indigo-500";
    case "warning":
      return "bg-amber-500";
    case "critical":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

export function platformHealthBadgeClass(
  tone: PlatformHealthView["tone"]
): string {
  switch (tone) {
    case "excellent":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "healthy":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function prioritySeverityClass(severity: PrioritySeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function priorityVisualSeverityClass(
  severity: PriorityVisualSeverity
): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "medium":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function priorityRowHoverAccent(
  severity: PriorityVisualSeverity
): string {
  switch (severity) {
    case "critical":
      return "hover:bg-red-50/50 hover:shadow-[inset_3px_0_0_0_rgb(239,68,68)]";
    case "high":
      return "hover:bg-orange-50/40 hover:shadow-[inset_3px_0_0_0_rgb(249,115,22)]";
    case "medium":
      return "hover:bg-yellow-50/40 hover:shadow-[inset_3px_0_0_0_rgb(234,179,8)]";
    default:
      return "hover:bg-slate-50/80 hover:shadow-[inset_3px_0_0_0_rgb(148,163,184)]";
  }
}

export function getRevenueOpportunitiesEmptyCopy(
  data: SmartIntelligencePayload,
  schools: SuperAdminSchoolRow[]
): { title: string; description: string } {
  const freeSchools = schools.filter((s) => !isPaidPlanId(s.plan));
  if (data.revenue.currentRevenue === 0 && data.revenue.paidSchoolCount === 0) {
    return {
      title: "No payment history yet",
      description:
        "Revenue forecasts and upgrade opportunities will appear after the first completed payment and as free schools build engagement.",
    };
  }
  if (freeSchools.length === 0) {
    return {
      title: "All schools are on paid plans",
      description:
        "Upgrade opportunities appear when free-plan schools show strong engagement and student growth.",
    };
  }
  return {
    title: "No upgrade candidates yet",
    description:
      "Free schools need stronger engagement or more students before they qualify as upgrade leads. Check back as usage grows.",
  };
}

export function getChampionSchoolsEmptyCopy(
  data: SmartIntelligencePayload
): { title: string; description: string } {
  if (data.engagement.schools.length === 0) {
    return {
      title: "Engagement data not available",
      description:
        "Champion schools will appear once schools are active and generating platform activity signals.",
    };
  }
  return {
    title: "No champions identified yet",
    description:
      "Schools reaching champion-level engagement (80+) will be celebrated here as platform success stories.",
  };
}

export function getPriorityAttentionEmptyCopy(
  hasRows: boolean
): { title: string; description: string } {
  if (!hasRows) {
    return {
      title: "All clear — no priority schools",
      description:
        "No schools currently require executive intervention. Continue monitoring intelligence scorecards for early signals.",
    };
  }
  return {
    title: "No matches for this filter",
    description:
      "Try a different severity filter to view other schools in the priority queue.",
  };
}

export function trendLabelClass(direction: TrendDirection): string {
  switch (direction) {
    case "up":
      return "text-emerald-600";
    case "down":
      return "text-red-600";
    case "flat":
      return "text-slate-500";
    default:
      return "text-slate-400";
  }
}
