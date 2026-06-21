import { formatAnalyticsCurrency } from "@/lib/analytics-format";
import { isPaidPlanId } from "@/lib/plans";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import type {
  ChurnIntelligence,
  ChurnRiskLevel,
  ChurnSchoolDetail,
  EngagementIntelligence,
  EngagementLabel,
  EngagementSchoolDetail,
  GrowthDirection,
  IntelligenceStatusBadge,
  IntelligenceStatusTone,
  OnboardingIntelligence,
  OnboardingSchoolDetail,
  OnboardingStatus,
  RevenueIntelligence,
  RiskIntelligence,
  RiskSchoolDetail,
  SchoolIntelligenceContext,
  SmartIntelligencePayload,
} from "@/lib/super-admin/smart-intelligence-types";

const MS_PER_DAY = 86_400_000;
const RECENT_ACTIVITY_DAYS = 30;
const SETUP_STALE_DAYS = 14;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function statusBadge(
  label: string,
  tone: IntelligenceStatusTone
): IntelligenceStatusBadge {
  return { label, tone };
}

function churnLevel(score: number): ChurnRiskLevel {
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function engagementLabel(score: number): EngagementLabel {
  if (score >= 80) return "champion";
  if (score >= 60) return "active";
  if (score >= 40) return "weak_usage";
  return "disengaged";
}

function onboardingStatus(progress: number): OnboardingStatus {
  if (progress >= 100) return "complete";
  if (progress >= 60) return "almost_ready";
  if (progress > 0) return "in_progress";
  return "not_started";
}

function computeChurnForSchool(
  school: SuperAdminSchoolRow,
  ctx: SchoolIntelligenceContext
): ChurnSchoolDetail {
  const signals: string[] = [];
  let score = 0;

  const activityDays = daysSince(school.last_activity_at);
  if (activityDays === null) {
    score += 35;
    signals.push("No recorded activity");
  } else if (activityDays > 60) {
    score += 50;
    signals.push(`No activity for ${activityDays} days`);
  } else if (activityDays > RECENT_ACTIVITY_DAYS) {
    score += 30;
    signals.push(`No recent activity (${activityDays} days)`);
  }

  if (school.school_status === "inactive") {
    score += 40;
    signals.push("School marked inactive");
  }

  if (school.health_score < 40) {
    score += 25;
    signals.push(`Low health score (${school.health_score})`);
  } else if (school.health_score < 60) {
    score += 12;
    signals.push(`Moderate health score (${school.health_score})`);
  }

  if (school.student_count > 0 && school.payment_count === 0) {
    score += 15;
    signals.push("Students enrolled but no payments recorded");
  }

  const setupDays = daysSince(school.created_at);
  if (
    school.school_status === "setup" &&
    setupDays !== null &&
    setupDays > SETUP_STALE_DAYS
  ) {
    score += 20;
    signals.push(`Setup incomplete for ${setupDays} days`);
  }

  if (school.student_count === 0) {
    score += 10;
    signals.push("No students added");
  }

  if (ctx.classCount === 0 && school.student_count > 0) {
    score += 8;
    signals.push("No classes configured");
  }

  if (school.payment_count === 0 && ctx.revenueLast30Days === 0 && isPaidPlanId(school.plan)) {
    score += 12;
    signals.push("Paid plan with no payment activity");
  }

  const riskScore = Math.min(100, score);
  const riskLevel = churnLevel(riskScore);

  return {
    id: school.id,
    name: school.name,
    riskLevel,
    riskScore,
    signals: signals.length > 0 ? signals : ["No churn signals detected"],
  };
}

function computeRiskForSchool(
  school: SuperAdminSchoolRow,
  ctx: SchoolIntelligenceContext
): RiskSchoolDetail {
  const signals: string[] = [];
  let score = 0;

  score += Math.round((100 - school.health_score) * 0.4);
  if (school.health_score < 60) {
    signals.push(`Health score ${school.health_score}/100`);
  }

  if (school.payment_count === 0) {
    score += school.student_count > 0 ? 20 : 8;
    signals.push("No payments recorded");
  }

  const activityDays = daysSince(school.last_activity_at);
  if (activityDays === null || activityDays > RECENT_ACTIVITY_DAYS) {
    const penalty = activityDays === null ? 20 : Math.min(20, Math.round(activityDays / 3));
    score += penalty;
    signals.push(
      activityDays === null
        ? "No platform activity"
        : `Low activity (${activityDays} days since last use)`
    );
  }

  const setupDays = daysSince(school.created_at);
  if (
    school.school_status === "setup" &&
    setupDays !== null &&
    setupDays > SETUP_STALE_DAYS
  ) {
    score += 15;
    signals.push(`Setup older than ${SETUP_STALE_DAYS} days`);
  }

  if (school.student_count === 0) {
    score += 10;
    signals.push("No students");
  }

  if (school.school_status === "inactive") {
    score += 25;
    signals.push("Inactive status");
  }

  if (ctx.classCount === 0 && school.student_count > 0) {
    score += 5;
    signals.push("No classes");
  }

  return {
    id: school.id,
    name: school.name,
    riskScore: Math.min(100, score),
    signals: signals.length > 0 ? signals : ["Low operational risk"],
  };
}

function computeOnboardingForSchool(
  school: SuperAdminSchoolRow,
  ctx: SchoolIntelligenceContext
): OnboardingSchoolDetail {
  const steps = [
    { key: "created", label: "School created", done: true },
    { key: "students", label: "Students added", done: school.student_count > 0 },
    { key: "classes", label: "Classes added", done: ctx.classCount > 0 },
    { key: "admin", label: "Admin assigned", done: school.admin_count > 0 },
    { key: "payments", label: "Payments recorded", done: school.payment_count > 0 },
    {
      key: "activity",
      label: "Recent activity",
      done:
        daysSince(school.last_activity_at) !== null &&
        (daysSince(school.last_activity_at) ?? 999) <= RECENT_ACTIVITY_DAYS,
    },
  ];

  const completed = steps.filter((s) => s.done);
  const missing = steps.filter((s) => !s.done);
  const progressPercent = Math.round((completed.length / steps.length) * 100);

  return {
    id: school.id,
    name: school.name,
    progressPercent,
    status: onboardingStatus(progressPercent),
    completedSteps: completed.map((s) => s.label),
    missingSteps: missing.map((s) => s.label),
  };
}

function computeEngagementForSchool(
  school: SuperAdminSchoolRow,
  ctx: SchoolIntelligenceContext
): EngagementSchoolDetail {
  const signals: string[] = [];
  let score = 0;

  score += Math.round(school.health_score * 0.35);
  signals.push(`Health contribution: ${school.health_score}`);

  const activityDays = daysSince(school.last_activity_at);
  if (activityDays !== null && activityDays <= RECENT_ACTIVITY_DAYS) {
    score += 25;
    signals.push("Recent platform activity");
  } else {
    signals.push("Stale or missing activity");
  }

  if (school.payment_count > 0 || ctx.revenueLast30Days > 0) {
    score += 15;
    signals.push("Payment activity");
  }

  if (school.student_count > 0) {
    score += 10;
    signals.push("Active student roster");
  }

  if (school.admin_count > 0) {
    score += 10;
    signals.push("Admin usage");
  }

  if (school.teacher_count > 0) {
    score += 5;
    signals.push("Teacher accounts");
  }

  if (school.school_status === "active") {
    score += 15;
    signals.push("Active school status");
  } else if (school.school_status === "inactive") {
    score -= 10;
    signals.push("Inactive status penalty");
  }

  if (ctx.classCount > 0) {
    score += 5;
    signals.push("Classes in use");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const label = engagementLabel(finalScore);

  return {
    id: school.id,
    name: school.name,
    score: finalScore,
    label,
    signals,
  };
}

function churnHeadlineAndBadge(
  high: number,
  medium: number,
  low: number,
  total: number
): { headline: string; badge: IntelligenceStatusBadge } {
  if (total === 0) {
    return {
      headline: "—",
      badge: statusBadge("No schools", "neutral"),
    };
  }
  if (high > 0) {
    return {
      headline: String(high),
      badge: statusBadge(
        high === 1 ? "1 high risk" : `${high} high risk`,
        "critical"
      ),
    };
  }
  if (medium > 0) {
    return {
      headline: String(medium),
      badge: statusBadge("Medium risk", "warning"),
    };
  }
  return {
    headline: String(low),
    badge: statusBadge("Low risk", "healthy"),
  };
}

function riskHeadlineAndBadge(avg: number): {
  headline: string;
  badge: IntelligenceStatusBadge;
} {
  const rounded = Math.round(avg);
  let tone: IntelligenceStatusTone = "healthy";
  let label = "Healthy";
  if (rounded >= 60) {
    tone = "critical";
    label = "High risk";
  } else if (rounded >= 35) {
    tone = "warning";
    label = "Elevated";
  }
  return { headline: String(rounded), badge: statusBadge(label, tone) };
}

function revenueGrowth(
  current: number,
  previous: number
): { direction: GrowthDirection; percent: number | null } {
  if (current === 0 && previous === 0) {
    return { direction: "unknown", percent: null };
  }
  if (previous === 0) {
    return { direction: current > 0 ? "up" : "stable", percent: null };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 2) return { direction: "up", percent: pct };
  if (pct < -2) return { direction: "down", percent: pct };
  return { direction: "stable", percent: pct };
}

export interface ComputeSmartIntelligenceInput {
  schools: SuperAdminSchoolRow[];
  classCountBySchool: Map<string, number>;
  revenueCurrent30Days: number;
  revenuePrevious30Days: number;
  revenueLast90Days: number;
  revenueBySchoolLast30Days: Map<string, number>;
}

export function computeSmartIntelligence(
  input: ComputeSmartIntelligenceInput
): SmartIntelligencePayload {
  const {
    schools,
    classCountBySchool,
    revenueCurrent30Days,
    revenuePrevious30Days,
    revenueLast90Days,
    revenueBySchoolLast30Days,
  } = input;

  const schoolContexts = new Map<string, SchoolIntelligenceContext>();
  for (const school of schools) {
    schoolContexts.set(school.id, {
      classCount: classCountBySchool.get(school.id) ?? 0,
      revenueLast30Days: revenueBySchoolLast30Days.get(school.id) ?? 0,
      revenueLast90Days: revenueLast90Days,
    });
  }

  const churnSchools = schools.map((s) =>
    computeChurnForSchool(s, schoolContexts.get(s.id)!)
  );
  const highRiskCount = churnSchools.filter((s) => s.riskLevel === "high").length;
  const mediumRiskCount = churnSchools.filter((s) => s.riskLevel === "medium").length;
  const lowRiskCount = churnSchools.filter((s) => s.riskLevel === "low").length;
  const churnHeadline = churnHeadlineAndBadge(
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    schools.length
  );

  const churn: ChurnIntelligence = {
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    headlineValue: churnHeadline.headline,
    explanation:
      schools.length === 0
        ? "Add schools to begin churn monitoring."
        : `${highRiskCount} school${highRiskCount === 1 ? "" : "s"} show strong churn signals based on activity, payments, and health.`,
    statusBadge: churnHeadline.badge,
    recommendedAction:
      highRiskCount > 0
        ? "Reach out to high-risk schools with onboarding support and check payment or activity blockers."
        : "Continue monitoring weekly activity and payment trends.",
    signalsUsed: [
      "Last platform activity",
      "Student and class updates",
      "Payment records",
      "Health score",
      "School lifecycle status",
    ],
    schools: [...churnSchools].sort((a, b) => b.riskScore - a.riskScore),
  };

  const riskSchools = schools.map((s) =>
    computeRiskForSchool(s, schoolContexts.get(s.id)!)
  );
  const averageRiskScore =
    riskSchools.length > 0
      ? riskSchools.reduce((sum, s) => sum + s.riskScore, 0) / riskSchools.length
      : 0;
  const riskHeadline = riskHeadlineAndBadge(averageRiskScore);
  const schoolsAtRisk = [...riskSchools]
    .filter((s) => s.riskScore >= 35)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  const risk: RiskIntelligence = {
    averageRiskScore: Math.round(averageRiskScore),
    schoolsAtRisk,
    headlineValue: riskHeadline.headline,
    explanation:
      schools.length === 0
        ? "No schools to score yet."
        : `Average operational risk score across ${schools.length} school${schools.length === 1 ? "" : "s"}. Higher scores need attention.`,
    statusBadge: riskHeadline.badge,
    recommendedAction:
      schoolsAtRisk.length > 0
        ? "Prioritize outreach for schools with risk scores above 35 — verify setup, payments, and admin engagement."
        : "Risk levels are manageable. Review monthly for drift.",
    signalsUsed: [
      "Health score",
      "Payment activity",
      "Platform activity",
      "Setup age",
      "Student count",
      "Lifecycle status",
    ],
  };

  const paidSchoolCount = schools.filter((s) => isPaidPlanId(s.plan)).length;
  const monthlyAvg = revenueLast90Days / 3;
  const { direction, percent } = revenueGrowth(
    revenueCurrent30Days,
    revenuePrevious30Days
  );
  const growthFactor =
    percent !== null ? 1 + percent / 100 : revenuePrevious30Days > 0 ? revenueCurrent30Days / revenuePrevious30Days : 1;
  const projectedNextMonth = Math.max(
    0,
    Math.round(revenueCurrent30Days * growthFactor)
  );
  const projected3Month = Math.max(0, Math.round(projectedNextMonth * 3));

  let revenueTone: IntelligenceStatusTone = "neutral";
  let revenueBadgeLabel = "Stable";
  if (direction === "up") {
    revenueTone = "healthy";
    revenueBadgeLabel = percent !== null ? `+${percent}% growth` : "Growing";
  } else if (direction === "down") {
    revenueTone = "warning";
    revenueBadgeLabel = percent !== null ? `${percent}% decline` : "Declining";
  }

  const revenue: RevenueIntelligence = {
    currentRevenue: revenueCurrent30Days,
    projectedNextMonth,
    projected3Month,
    growthDirection: direction,
    growthPercent: percent,
    paidSchoolCount,
    headlineValue: formatAnalyticsCurrency(projectedNextMonth),
    explanation: `Based on ${paidSchoolCount} paid school${paidSchoolCount === 1 ? "" : "s"} and completed payment trends over the last 90 days.`,
    statusBadge: statusBadge(revenueBadgeLabel, revenueTone),
    recommendedAction:
      direction === "down"
        ? "Investigate schools with dropping payments and offer retention support."
        : "Maintain billing follow-ups for paid schools to sustain revenue momentum.",
    signalsUsed: [
      "Completed payments (last 30 / 60 / 90 days)",
      "Paid school count",
      "Month-over-month payment trend",
    ],
  };

  const onboardingSchools = schools.map((s) =>
    computeOnboardingForSchool(s, schoolContexts.get(s.id)!)
  );
  const averageProgress =
    onboardingSchools.length > 0
      ? Math.round(
          onboardingSchools.reduce((sum, s) => sum + s.progressPercent, 0) /
            onboardingSchools.length
        )
      : 0;
  const completeCount = onboardingSchools.filter((s) => s.status === "complete").length;
  const stuckSchools = onboardingSchools
    .filter((s) => s.progressPercent < 60)
    .sort((a, b) => a.progressPercent - b.progressPercent);

  let onboardingTone: IntelligenceStatusTone = "warning";
  let onboardingLabel = "In progress";
  if (schools.length === 0) {
    onboardingTone = "neutral";
    onboardingLabel = "No data";
  } else if (completeCount === schools.length) {
    onboardingTone = "healthy";
    onboardingLabel = "All complete";
  } else if (stuckSchools.length > 0) {
    onboardingTone = "warning";
    onboardingLabel = `${stuckSchools.length} stuck`;
  }

  const onboarding: OnboardingIntelligence = {
    averageProgress,
    completeCount,
    stuckCount: stuckSchools.length,
    headlineValue: schools.length === 0 ? "—" : `${averageProgress}%`,
    explanation:
      schools.length === 0
        ? "Track setup milestones as schools join the platform."
        : `${completeCount} of ${schools.length} schools completed all onboarding milestones.`,
    statusBadge: statusBadge(onboardingLabel, onboardingTone),
    recommendedAction:
      stuckSchools.length > 0
        ? "Contact stuck setup schools to complete students, classes, admin, and first payment steps."
        : "Onboarding is on track. Celebrate complete schools and monitor new signups.",
    signalsUsed: [
      "School created",
      "Students added",
      "Classes added",
      "Admin assigned",
      "Payments recorded",
      "Recent activity",
    ],
    stuckSchools: stuckSchools.slice(0, 8),
    schools: [...onboardingSchools].sort(
      (a, b) => a.progressPercent - b.progressPercent
    ),
  };

  const engagementSchools = schools.map((s) =>
    computeEngagementForSchool(s, schoolContexts.get(s.id)!)
  );
  const averageEngagement =
    engagementSchools.length > 0
      ? Math.round(
          engagementSchools.reduce((sum, s) => sum + s.score, 0) /
            engagementSchools.length
        )
      : 0;
  const topEngaged = [...engagementSchools]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const lowEngagement = [...engagementSchools]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  let engagementTone: IntelligenceStatusTone = "healthy";
  let engagementLabelText = "Strong";
  if (averageEngagement < 40) {
    engagementTone = "critical";
    engagementLabelText = "Weak";
  } else if (averageEngagement < 60) {
    engagementTone = "warning";
    engagementLabelText = "Mixed";
  }

  const engagement: EngagementIntelligence = {
    averageScore: averageEngagement,
    headlineValue: schools.length === 0 ? "—" : String(averageEngagement),
    explanation:
      schools.length === 0
        ? "Engagement scores appear once schools are active on the platform."
        : `Platform-wide engagement average from activity, roster updates, payments, and admin usage.`,
    statusBadge: statusBadge(engagementLabelText, engagementTone),
    recommendedAction:
      lowEngagement.length > 0 && lowEngagement[0]!.score < 40
        ? "Run engagement campaigns for disengaged schools — share best practices and module walkthroughs."
        : "Recognize champion schools and replicate their usage patterns.",
    signalsUsed: [
      "Activity logs",
      "Student updates",
      "Class updates",
      "Payments",
      "Admin usage",
      "School status",
    ],
    topEngaged,
    lowEngagement,
    schools: engagementSchools,
  };

  return {
    computedAt: new Date().toISOString(),
    churn,
    risk,
    revenue,
    onboarding,
    engagement,
  };
}
