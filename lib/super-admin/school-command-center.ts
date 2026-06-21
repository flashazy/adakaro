import { formatAnalyticsCurrency } from "@/lib/analytics-format";
import {
  daysSinceIso,
  formatSchoolLastActivity,
  type SchoolHealthResult,
} from "@/lib/super-admin/school-health";
import {
  isRecentActivity,
  normalizeSchoolLifecycleStatus,
  schoolLifecycleStatusLabel,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";
import type { SchoolLifecycleMetrics } from "@/lib/super-admin/load-school-lifecycle-metrics";

export interface SchoolHealthDriver {
  label: string;
  met: boolean;
}

export interface SchoolRiskAssessment {
  score: number;
  level: "Low" | "Medium" | "High";
  reasons: string[];
  recommendedAction: string;
}

export interface SchoolTimelineEvent {
  id: string;
  label: string;
  date: string | null;
  note?: string;
}

export interface SchoolCommandCenterKpis {
  students: number;
  admins: number;
  teachers: number;
  parents: number;
  revenueLabel: string;
  platformActivity: string;
  studentHelper: string;
  adminHelper: string;
  teacherHelper: string;
  parentHelper: string;
  revenueHelper: string;
  activityHelper: string;
  studentTarget: string;
  adminTarget: string;
  teacherTarget: string;
  parentTarget: string;
  revenueTarget: string;
  activityTarget: string;
}

export interface SchoolStudentOverview {
  total: number;
  active: number;
  newThisMonth: number;
  lastAddedAt: string | null;
}

export interface SchoolCommunicationSummary {
  lastFollowUpAt: string | null;
  lastContactAttemptAt: string | null;
  lastAdminLoginAt: string | null;
  broadcastsSent: number;
  responsesReceived: number;
  unreadMessages: number;
}

export interface SchoolActivityMonitor {
  lastLogin: string | null;
  lastAttendance: string | null;
  lastReportCard: string | null;
  lastFinance: string | null;
  status: ActivityStatusLevel;
}

export type PriorityLevel = "champion" | "immediate" | "follow_up" | "stable";
export type CommunicationHealthLevel = "Good" | "Fair" | "Poor";
export type ActivityStatusLevel = "Active" | "Dormant" | "Inactive";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type ExecutiveStatusLevel = "needs_intervention" | "requires_follow_up" | "healthy";
export type OperationalStatusLevel = "needs_intervention" | "at_risk" | "healthy";

export interface ScoreTrend {
  delta: number | null;
  label: string;
}

export interface RiskTrend {
  previousScore: number | null;
  currentScore: number;
  direction: "up" | "down" | "flat" | null;
  label: string;
}

export interface NextBestAction {
  action: string;
  reason: string;
}

export interface SchoolCommandCenterPayload {
  schoolStatus: SchoolLifecycleStatus;
  health: SchoolHealthResult;
  healthDrivers: SchoolHealthDriver[];
  healthTrend: ScoreTrend;
  risk: SchoolRiskAssessment;
  riskTrend: RiskTrend;
  priorityLevel: PriorityLevel;
  priorityLabel: string;
  executiveStatus: ExecutiveStatusLevel;
  executiveStatusLabel: string;
  operationalStatus: OperationalStatusLevel;
  operationalStatusLabel: string;
  kpis: SchoolCommandCenterKpis;
  timeline: SchoolTimelineEvent[];
  studentOverview: SchoolStudentOverview;
  communication: SchoolCommunicationSummary;
  communicationHealth: CommunicationHealthLevel;
  activity: SchoolActivityMonitor;
  insights: string[];
  insightConfidence: ConfidenceLevel;
  recommendedNextStep: string;
  nextBestAction: NextBestAction;
  daysSinceCreated: number | null;
  churnRiskScore: number;
  revenueTotal: number;
}

export function commandCenterHealthBarColor(score: number): string {
  if (score > 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function commandCenterHealthTextColor(score: number): string {
  if (score > 70) return "text-emerald-700";
  if (score >= 40) return "text-amber-700";
  return "text-red-700";
}

export function commandCenterHealthDotColor(score: number): string {
  if (score > 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function commandCenterRiskTextColor(score: number): string {
  if (score >= 80) return "text-red-700";
  if (score >= 60) return "text-amber-700";
  return "text-emerald-700";
}

export function commandCenterRiskBadgeClass(score: number): string {
  if (score >= 80) return "text-red-800 bg-red-50 ring-red-200";
  if (score >= 60) return "text-amber-800 bg-amber-50 ring-amber-200";
  return "text-emerald-800 bg-emerald-50 ring-emerald-200";
}

export function commandCenterRiskDotColor(score: number): string {
  if (score >= 80) return "bg-red-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

export function computeExecutiveStatus(
  healthScore: number,
  riskScore: number
): { level: ExecutiveStatusLevel; label: string } {
  if (riskScore > 80 || healthScore < 40) {
    return { level: "needs_intervention", label: "Needs Intervention" };
  }
  if (riskScore >= 60 || healthScore <= 70) {
    return { level: "requires_follow_up", label: "Requires Follow-Up" };
  }
  return { level: "healthy", label: "Healthy" };
}

export function computeOperationalStatus(
  healthScore: number,
  riskScore: number
): { level: OperationalStatusLevel; label: string } {
  if (riskScore > 80 || healthScore < 40) {
    return { level: "needs_intervention", label: "Needs Intervention" };
  }
  if (riskScore >= 60) {
    return { level: "at_risk", label: "At Risk" };
  }
  if (healthScore > 70) {
    return { level: "healthy", label: "Healthy" };
  }
  return { level: "at_risk", label: "At Risk" };
}

export function riskLevelFromScore(score: number): SchoolRiskAssessment["level"] {
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function computeHealthDrivers(input: {
  studentCount: number;
  paymentCount: number;
  hasProfile: boolean;
  recentActivity: boolean;
}): SchoolHealthDriver[] {
  return [
    { label: "Profile completed", met: input.hasProfile },
    { label: "Students added", met: input.studentCount > 0 },
    { label: "Payments recorded", met: input.paymentCount > 0 },
    { label: "Active platform usage", met: input.recentActivity },
  ];
}

export function computeRiskAssessment(input: {
  healthScore: number;
  studentCount: number;
  paymentCount: number;
  schoolStatus: SchoolLifecycleStatus;
  daysSinceCreated: number | null;
  daysSinceLastActivity: number | null;
}): SchoolRiskAssessment {
  const reasons: string[] = [];
  let score = Math.round((100 - input.healthScore) * 0.4);

  if (input.studentCount === 0) {
    score += 10;
    reasons.push("No students enrolled");
  }

  if (input.paymentCount === 0) {
    score += input.studentCount > 0 ? 20 : 8;
    reasons.push("No payments recorded");
  }

  if (
    input.schoolStatus === "setup" &&
    input.daysSinceCreated !== null &&
    input.daysSinceCreated > 14
  ) {
    score += 15;
    reasons.push("Setup older than 14 days");
  }

  if (
    input.daysSinceLastActivity === null ||
    input.daysSinceLastActivity > 30
  ) {
    score += input.daysSinceLastActivity === null ? 20 : 15;
    reasons.push("Low engagement");
  }

  if (input.healthScore < 40) {
    reasons.push(`Low health score (${input.healthScore}/100)`);
  }

  const finalScore = Math.min(100, score);
  const level = riskLevelFromScore(finalScore);

  let recommendedAction =
    "Monitor school progress and check in if activity remains low.";
  if (level === "High") {
    recommendedAction =
      "Contact school administrator and schedule onboarding assistance.";
  } else if (level === "Medium") {
    recommendedAction =
      "Send a follow-up and confirm onboarding steps are underway.";
  }

  return {
    score: finalScore,
    level,
    reasons: reasons.length > 0 ? reasons : ["No major risk signals detected"],
    recommendedAction,
  };
}

export function platformActivityLabel(
  daysSinceLastActivity: number | null
): string {
  if (daysSinceLastActivity === null) return "Low";
  if (daysSinceLastActivity <= 7) return "High";
  if (daysSinceLastActivity <= 30) return "Moderate";
  return "Low";
}

export function activityStatusFromDays(
  daysSinceLastActivity: number | null
): ActivityStatusLevel {
  if (daysSinceLastActivity === null) return "Inactive";
  if (daysSinceLastActivity <= 14) return "Active";
  if (daysSinceLastActivity <= 60) return "Dormant";
  return "Inactive";
}

export function computePriorityLevel(
  healthScore: number,
  riskScore: number
): { level: PriorityLevel; label: string } {
  if (healthScore > 85) {
    return { level: "champion", label: "Champion School" };
  }
  if (riskScore > 80) {
    return { level: "immediate", label: "Immediate Attention" };
  }
  if (riskScore >= 60) {
    return { level: "follow_up", label: "Needs Follow-Up" };
  }
  return { level: "stable", label: "Stable" };
}

export function computeHealthTrend(input: {
  daysSinceCreated: number | null;
  newStudentsThisMonth: number;
  daysSinceLastActivity: number | null;
}): ScoreTrend {
  if (input.daysSinceCreated === null || input.daysSinceCreated < 14) {
    return { delta: null, label: "No trend history yet" };
  }

  let delta = 0;
  if (input.newStudentsThisMonth > 0) delta += 8;
  if (input.daysSinceLastActivity === null || input.daysSinceLastActivity > 30) {
    delta -= 12;
  } else if (input.daysSinceLastActivity > 14) {
    delta -= 5;
  }

  if (delta === 0) {
    return { delta: 0, label: "No significant change in last 30 days" };
  }

  const sign = delta > 0 ? "↑" : "↓";
  const abs = Math.abs(delta);
  return {
    delta,
    label: `${sign} ${delta > 0 ? "+" : "−"}${abs} in last 30 days`,
  };
}

export function computeRiskTrend(
  currentScore: number,
  healthTrend: ScoreTrend
): RiskTrend {
  if (healthTrend.delta === null) {
    return {
      previousScore: null,
      currentScore,
      direction: null,
      label: "Trend data unavailable",
    };
  }

  const previousScore = Math.max(
    0,
    Math.min(100, currentScore - Math.round(-healthTrend.delta * 0.85))
  );
  const diff = currentScore - previousScore;
  const direction: RiskTrend["direction"] =
    diff > 2 ? "up" : diff < -2 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const verb =
    direction === "up"
      ? "Risk increasing"
      : direction === "down"
        ? "Risk decreasing"
        : "Risk stable";

  return {
    previousScore,
    currentScore,
    direction,
    label: `${arrow} ${verb}`,
  };
}

export function computeCommunicationHealth(
  communication: SchoolCommunicationSummary
): CommunicationHealthLevel {
  const candidates = [
    communication.lastFollowUpAt,
    communication.lastContactAttemptAt,
    communication.lastAdminLoginAt,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return "Poor";

  const mostRecent = candidates.reduce((a, b) =>
    new Date(a).getTime() >= new Date(b).getTime() ? a : b
  );
  const days = daysSinceIso(mostRecent);

  if (days === null || days > 30) return "Poor";
  if (days <= 14) return "Good";
  return "Fair";
}

export function computeInsightConfidence(input: {
  studentCount: number;
  adminCount: number;
  hasActivity: boolean;
  daysSinceCreated: number | null;
}): ConfidenceLevel {
  const signals = [
    input.studentCount > 0,
    input.adminCount > 0,
    input.hasActivity,
    (input.daysSinceCreated ?? 0) >= 14,
  ].filter(Boolean).length;

  if (signals >= 3) return "High";
  if (signals >= 2) return "Medium";
  return "Low";
}

export function buildNextBestAction(input: {
  risk: SchoolRiskAssessment;
  daysSinceCreated: number | null;
  studentCount: number;
}): NextBestAction {
  const topReason = input.risk.reasons[0] ?? "Limited onboarding progress detected.";

  if (input.risk.score > 80) {
    return {
      action: "Contact school administrator within 48 hours.",
      reason:
        input.studentCount === 0 && input.daysSinceCreated !== null
          ? `No students enrolled after ${input.daysSinceCreated} days.`
          : topReason,
    };
  }

  if (input.risk.score >= 60) {
    return {
      action: "Send a follow-up and confirm onboarding progress.",
      reason: topReason,
    };
  }

  return {
    action: "Monitor school health and check in during the next review cycle.",
    reason: topReason,
  };
}

export function buildCommandCenterInsights(input: {
  risk: SchoolRiskAssessment;
  studentCount: number;
  daysSinceCreated: number | null;
  schoolStatus: SchoolLifecycleStatus;
  healthScore: number;
}): { insights: string[]; recommendedNextStep: string } {
  const insights: string[] = [];

  if (input.risk.level === "High") {
    insights.push("School likely to churn within 30 days.");
  }

  if (
    input.schoolStatus === "setup" &&
    input.daysSinceCreated !== null &&
    input.daysSinceCreated > 14
  ) {
    insights.push("No onboarding progress detected.");
  }

  if (input.studentCount === 0 && (input.daysSinceCreated ?? 0) > 7) {
    insights.push("No students enrolled despite account age.");
  }

  if (input.healthScore < 40) {
    insights.push("Health score indicates the school needs hands-on support.");
  }

  if (insights.length === 0) {
    insights.push("School metrics are within normal operating range.");
  }

  return {
    insights,
    recommendedNextStep: input.risk.recommendedAction,
  };
}

export function buildSchoolTimeline(input: {
  createdAt: string;
  firstInvitationAt: string | null;
  firstLoginAt: string | null;
  firstStudentAt: string | null;
  firstPaymentAt: string | null;
  lastActivityAt: string | null;
  studentCount: number;
}): SchoolTimelineEvent[] {
  const events: SchoolTimelineEvent[] = [
    { id: "created", label: "School created", date: input.createdAt },
    {
      id: "invited",
      label: "Admin invited",
      date: input.firstInvitationAt,
      note: input.firstInvitationAt ? undefined : "No invitation sent yet",
    },
    {
      id: "login",
      label: "First login",
      date: input.firstLoginAt,
      note: input.firstLoginAt ? undefined : "No admin login yet",
    },
    {
      id: "student",
      label: "First student added",
      date: input.firstStudentAt,
      note:
        input.studentCount === 0
          ? "No student activity yet"
          : undefined,
    },
    {
      id: "payment",
      label: "First payment recorded",
      date: input.firstPaymentAt,
      note: input.firstPaymentAt ? undefined : "No payments yet",
    },
    {
      id: "activity",
      label: "Last activity",
      date: input.lastActivityAt,
      note: input.lastActivityAt ? undefined : "No recorded activity",
    },
  ];

  return events;
}

export function buildCommandCenterKpis(input: {
  metrics: SchoolLifecycleMetrics;
  parentCount: number;
  revenueTotal: number;
  currency: string;
  daysSinceLastActivity: number | null;
}): SchoolCommandCenterKpis {
  const { metrics } = input;
  const activity = platformActivityLabel(input.daysSinceLastActivity);

  return {
    students: metrics.studentCount,
    admins: metrics.adminCount,
    teachers: metrics.teacherCount,
    parents: input.parentCount,
    revenueLabel: formatSchoolRevenue(input.revenueTotal, input.currency),
    platformActivity: activity,
    studentHelper:
      metrics.studentCount === 0
        ? "No students enrolled"
        : metrics.lastStudentAt
          ? `Last added ${formatSchoolLastActivity(metrics.lastStudentAt)}`
          : "Students on file",
    adminHelper:
      metrics.adminCount === 0 ? "No admins assigned" : `${metrics.adminCount} on team`,
    teacherHelper:
      metrics.teacherCount === 0 ? "No teachers assigned" : "Teaching staff",
    parentHelper:
      input.parentCount === 0 ? "No parent accounts" : "Parent accounts",
    revenueHelper:
      input.revenueTotal === 0
        ? "No revenue recorded"
        : "Lifetime recorded payments",
    activityHelper:
      input.daysSinceLastActivity === null
        ? "No platform activity"
        : `Last active ${formatSchoolLastActivity(
            new Date(
              Date.now() - input.daysSinceLastActivity * 86_400_000
            ).toISOString()
          )}`,
    studentTarget: "Target: 20+",
    adminTarget: "Target: 1+",
    teacherTarget: "Target: 2+",
    parentTarget: "Target: grows with enrollment",
    revenueTarget: `Expected: ${formatSchoolRevenue(50_000, input.currency)}+`,
    activityTarget: "Target: weekly usage",
  };
}

export function assembleCommandCenterPayload(input: {
  schoolStatus: SchoolLifecycleStatus;
  health: SchoolHealthResult;
  metrics: SchoolLifecycleMetrics;
  parentCount: number;
  revenueTotal: number;
  currency: string;
  createdAt: string;
  firstInvitationAt: string | null;
  studentOverview: SchoolStudentOverview;
  communication: SchoolCommunicationSummary;
  hasProfile: boolean;
}): SchoolCommandCenterPayload {
  const schoolStatus = normalizeSchoolLifecycleStatus(input.schoolStatus);
  const daysSinceCreated = daysSinceIso(input.createdAt);
  const daysSinceLastActivity = daysSinceIso(
    input.metrics.lastActivityAt ?? input.communication.lastAdminLoginAt
  );
  const recentActivity =
    isRecentActivity(input.metrics.lastActivityAt) ||
    isRecentActivity(input.communication.lastAdminLoginAt);

  const healthDrivers = computeHealthDrivers({
    studentCount: input.metrics.studentCount,
    paymentCount: input.metrics.paymentCount,
    hasProfile: input.hasProfile,
    recentActivity,
  });

  const risk = computeRiskAssessment({
    healthScore: input.health.score,
    studentCount: input.metrics.studentCount,
    paymentCount: input.metrics.paymentCount,
    schoolStatus,
    daysSinceCreated,
    daysSinceLastActivity,
  });

  const { insights, recommendedNextStep } = buildCommandCenterInsights({
    risk,
    studentCount: input.metrics.studentCount,
    daysSinceCreated,
    schoolStatus,
    healthScore: input.health.score,
  });

  const timeline = buildSchoolTimeline({
    createdAt: input.createdAt,
    firstInvitationAt: input.firstInvitationAt,
    firstLoginAt: input.metrics.lastLoginAt,
    firstStudentAt: input.metrics.lastStudentAt,
    firstPaymentAt: input.metrics.lastPaymentAt,
    lastActivityAt: input.metrics.lastActivityAt,
    studentCount: input.metrics.studentCount,
  });

  const healthTrend = computeHealthTrend({
    daysSinceCreated,
    newStudentsThisMonth: input.studentOverview.newThisMonth,
    daysSinceLastActivity,
  });
  const riskTrend = computeRiskTrend(risk.score, healthTrend);
  const priority = computePriorityLevel(input.health.score, risk.score);
  const executive = computeExecutiveStatus(input.health.score, risk.score);
  const operational = computeOperationalStatus(input.health.score, risk.score);
  const communicationHealth = computeCommunicationHealth(input.communication);
  const activityStatus = activityStatusFromDays(daysSinceLastActivity);
  const insightConfidence = computeInsightConfidence({
    studentCount: input.metrics.studentCount,
    adminCount: input.metrics.adminCount,
    hasActivity: recentActivity,
    daysSinceCreated,
  });
  const nextBestAction = buildNextBestAction({
    risk,
    daysSinceCreated,
    studentCount: input.metrics.studentCount,
  });

  return {
    schoolStatus,
    health: input.health,
    healthDrivers,
    healthTrend,
    risk,
    riskTrend,
    priorityLevel: priority.level,
    priorityLabel: priority.label,
    executiveStatus: executive.level,
    executiveStatusLabel: executive.label,
    operationalStatus: operational.level,
    operationalStatusLabel: operational.label,
    kpis: buildCommandCenterKpis({
      metrics: input.metrics,
      parentCount: input.parentCount,
      revenueTotal: input.revenueTotal,
      currency: input.currency,
      daysSinceLastActivity,
    }),
    timeline,
    studentOverview: input.studentOverview,
    communication: input.communication,
    communicationHealth,
    activity: {
      lastLogin: input.metrics.lastLoginAt,
      lastAttendance: input.metrics.lastAttendanceAt,
      lastReportCard: input.metrics.lastReportAt,
      lastFinance: input.metrics.lastPaymentAt ?? input.metrics.lastFeeAt,
      status: activityStatus,
    },
    insights,
    insightConfidence,
    recommendedNextStep,
    nextBestAction,
    daysSinceCreated,
    churnRiskScore: risk.score,
    revenueTotal: input.revenueTotal,
  };
}

export function lifecycleStatusDisplay(status: SchoolLifecycleStatus): string {
  return schoolLifecycleStatusLabel(status);
}

function formatSchoolRevenue(amount: number, currency: string): string {
  const code = currency?.trim().toUpperCase() || "TZS";
  if (code === "TZS") return formatAnalyticsCurrency(amount);
  return `${code} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
