import type {
  SmartIntelligencePayload,
} from "@/lib/super-admin/smart-intelligence-types";
import type {
  SmartIntelligenceNavigationContext,
  SmartIntelligenceSource,
} from "@/lib/super-admin/smart-intelligence-navigation";

export interface FollowUpRecipientCounts {
  admins: number;
  teachers: number;
  parents: number;
  total: number;
}

export interface PreviousFollowUpItem {
  id: string;
  sentAt: string;
  title: string;
  typeLabel: string;
  sentBy?: string;
}

export type RiskSeverityLabel =
  | "Critical Risk"
  | "High Risk"
  | "Medium Risk"
  | "Low Risk";

export interface SchoolScoreSummary {
  label: "Risk Score" | "Health Score";
  value: number;
  max: number;
  barPercent: number;
  tone: "critical" | "high" | "medium" | "low" | "healthy";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToTone(
  value: number,
  mode: "risk" | "health"
): SchoolScoreSummary["tone"] {
  const v = mode === "risk" ? value : value;
  if (mode === "risk") {
    if (v >= 85) return "critical";
    if (v >= 65) return "high";
    if (v >= 40) return "medium";
    return "low";
  }
  if (v <= 25) return "critical";
  if (v <= 45) return "high";
  if (v <= 65) return "medium";
  return "healthy";
}

/** Severity badge beside risk type in school context. */
export function getRiskSeverityLabel(
  riskLevel?: string,
  riskScore?: number
): RiskSeverityLabel | null {
  const level = riskLevel?.toLowerCase().trim();
  const score = riskScore !== undefined ? clampScore(riskScore) : undefined;

  if (score !== undefined && score >= 90) return "Critical Risk";
  if (level === "high" || (score !== undefined && score >= 70)) return "High Risk";
  if (level === "medium" || (score !== undefined && score >= 45)) return "Medium Risk";
  if (level === "low" || score !== undefined) return "Low Risk";
  if (level) return "Medium Risk";
  return null;
}

export function riskSeverityBadgeClass(
  severity: RiskSeverityLabel
): string {
  switch (severity) {
    case "Critical Risk":
      return "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200";
    case "High Risk":
      return "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200";
    case "Medium Risk":
      return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "Low Risk":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function scoreSummaryBarClass(
  tone: SchoolScoreSummary["tone"]
): string {
  switch (tone) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-slate-400";
    case "healthy":
      return "bg-emerald-500";
  }
}

/** Executive score strip for the attention card. */
export function extractSchoolScoreSummary(
  data: SmartIntelligencePayload | null,
  schoolId: string,
  source: SmartIntelligenceSource,
  nav?: Partial<SmartIntelligenceNavigationContext>
): SchoolScoreSummary | null {
  if (data) {
    const churn = data.churn.schools.find((s) => s.id === schoolId);
    if (churn && (source === "churn" || source === "priority" || source === "risk")) {
      const value = clampScore(churn.riskScore);
      return {
        label: "Risk Score",
        value,
        max: 100,
        barPercent: value,
        tone: scoreToTone(value, "risk"),
      };
    }

    const risk = data.risk.schoolsAtRisk.find((s) => s.id === schoolId);
    if (risk && source === "risk") {
      const value = clampScore(risk.riskScore);
      return {
        label: "Risk Score",
        value,
        max: 100,
        barPercent: value,
        tone: scoreToTone(value, "risk"),
      };
    }

    const engagement =
      data.engagement.lowEngagement.find((s) => s.id === schoolId) ??
      data.engagement.schools.find((s) => s.id === schoolId);
    if (engagement && source === "engagement") {
      const value = clampScore(engagement.score);
      return {
        label: "Health Score",
        value,
        max: 100,
        barPercent: value,
        tone: scoreToTone(value, "health"),
      };
    }

    const onboarding =
      data.onboarding.stuckSchools.find((s) => s.id === schoolId) ??
      data.onboarding.schools.find((s) => s.id === schoolId);
    if (onboarding && source === "onboarding") {
      const value = clampScore(100 - onboarding.progressPercent);
      return {
        label: "Risk Score",
        value,
        max: 100,
        barPercent: value,
        tone: scoreToTone(value, "risk"),
      };
    }
  }

  if (nav?.engagementScore !== undefined && source === "engagement") {
    const value = clampScore(nav.engagementScore);
    return {
      label: "Health Score",
      value,
      max: 100,
      barPercent: value,
      tone: scoreToTone(value, "health"),
    };
  }

  if (nav?.onboardingProgress !== undefined && source === "onboarding") {
    const value = clampScore(100 - nav.onboardingProgress);
    return {
      label: "Risk Score",
      value,
      max: 100,
      barPercent: value,
      tone: scoreToTone(value, "risk"),
    };
  }

  if (nav?.riskLevel && (source === "churn" || source === "priority" || source === "risk")) {
    const level = nav.riskLevel.toLowerCase();
    const value =
      level === "high" ? 78 : level === "medium" ? 55 : level === "low" ? 28 : 50;
    return {
      label: "Risk Score",
      value,
      max: 100,
      barPercent: value,
      tone: scoreToTone(value, "risk"),
    };
  }

  return null;
}

/** Trust indicators above the message body. */
export function getSmartMessageSources(
  source: SmartIntelligenceSource
): string[] {
  switch (source) {
    case "churn":
    case "priority":
      return ["Churn Intelligence", "Engagement Analytics", "Platform Signals"];
    case "risk":
      return ["Risk Scoring", "Operational Signals", "Platform Intelligence"];
    case "engagement":
      return ["Engagement Analytics", "Usage Signals", "Platform Intelligence"];
    case "onboarding":
      return ["Onboarding Signals", "Setup Tracking", "Platform Intelligence"];
    case "revenue":
      return ["Revenue Analytics", "Billing Signals", "Platform Intelligence"];
    default:
      return ["Platform Intelligence"];
  }
}

export function formatFollowUpDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} • ${time}`;
  } catch {
    return iso;
  }
}

export function extractRiskScoreForSeverity(
  data: SmartIntelligencePayload | null,
  schoolId: string
): number | undefined {
  if (!data) return undefined;
  const churn = data.churn.schools.find((s) => s.id === schoolId);
  if (churn) return churn.riskScore;
  const risk = data.risk.schoolsAtRisk.find((s) => s.id === schoolId);
  if (risk) return risk.riskScore;
  return undefined;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Human-readable follow-up category for buttons, modals, and history. */
export function getFollowUpTypeLabel(source: SmartIntelligenceSource): string {
  switch (source) {
    case "churn":
    case "risk":
    case "priority":
      return "Retention Follow-Up";
    case "onboarding":
      return "Onboarding Follow-Up";
    case "revenue":
      return "Revenue Follow-Up";
    case "engagement":
      return "Engagement Follow-Up";
    default:
      return "Follow-Up";
  }
}

export function getFollowUpSendButtonLabel(
  source: SmartIntelligenceSource
): string {
  return `Send ${getFollowUpTypeLabel(source)}`;
}

export function getFollowUpSendLoadingLabel(
  source: SmartIntelligenceSource
): string {
  return `Sending ${getFollowUpTypeLabel(source).toLowerCase()}…`;
}

/** Badge label for school context header (e.g. Churn Risk). */
export function getRiskTypeLabel(
  source: SmartIntelligenceSource,
  riskLevel?: string
): string {
  switch (source) {
    case "churn":
    case "priority":
      if (riskLevel) {
        const level = capitalize(riskLevel.replace(/_/g, " "));
        return level.includes("Risk") ? level : `${level} Churn Risk`;
      }
      return "Churn Risk";
    case "risk":
      return "Operational Risk";
    case "onboarding":
      return "Onboarding Gap";
    case "revenue":
      return "Revenue Risk";
    case "engagement":
      return "Engagement Gap";
    default:
      return "Follow-Up";
  }
}

export function getExpectedOutcomes(
  source: SmartIntelligenceSource
): string[] {
  switch (source) {
    case "churn":
    case "risk":
    case "priority":
      return [
        "Reduce churn risk",
        "Increase engagement",
        "Improve onboarding completion",
        "Improve retention likelihood",
      ];
    case "onboarding":
      return [
        "Complete remaining setup steps",
        "Increase platform adoption",
        "Improve onboarding completion",
        "Enable full feature access",
      ];
    case "revenue":
      return [
        "Clarify billing questions",
        "Support plan renewal",
        "Restore payment activity",
        "Maintain uninterrupted service",
      ];
    case "engagement":
      return [
        "Increase day-to-day usage",
        "Strengthen staff adoption",
        "Improve engagement scores",
        "Unlock more platform value",
      ];
    default:
      return [
        "Strengthen school relationship",
        "Resolve open questions",
        "Support platform success",
        "Improve retention likelihood",
      ];
  }
}

/** Map broadcast title to a friendly follow-up type for history. */
export function followUpTypeLabelFromTitle(title: string): string {
  const t = title.trim().toLowerCase();
  if (t.includes("retention") || t.includes("churn")) return "Retention Follow-Up";
  if (t.includes("onboarding")) return "Onboarding Follow-Up";
  if (t.includes("payment") || t.includes("revenue") || t.includes("billing")) {
    return "Revenue Follow-Up";
  }
  if (t.includes("engagement")) return "Engagement Follow-Up";
  if (t.includes("follow-up") || t.includes("follow up")) return "Follow-Up";
  return title.trim() || "Broadcast";
}

export function buildPreviousFollowUps(
  broadcasts: { id: string; title: string; sent_at: string; target_user_ids: string[] | null }[],
  adminUserIds: string[]
): PreviousFollowUpItem[] {
  if (adminUserIds.length === 0) return [];

  const adminSet = new Set(adminUserIds);
  return broadcasts
    .filter((b) => {
      const targets = b.target_user_ids;
      if (!targets?.length) return false;
      return targets.some((id) => adminSet.has(id));
    })
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      sentAt: b.sent_at,
      title: b.title,
      typeLabel: followUpTypeLabelFromTitle(b.title),
      sentBy: "Super Admin",
    }));
}

/**
 * Pull attention signals for a school from Smart Intelligence payload + nav context.
 * Presentation only — does not recalculate scores.
 */
export function extractSchoolAttentionSignals(
  data: SmartIntelligencePayload | null,
  schoolId: string,
  source: SmartIntelligenceSource,
  nav?: Partial<SmartIntelligenceNavigationContext>
): string[] {
  const signals: string[] = [];
  const seen = new Set<string>();

  function add(signal: string) {
    const trimmed = signal.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    signals.push(trimmed);
  }

  if (data) {
    const churn = data.churn.schools.find((s) => s.id === schoolId);
    if (churn) {
      churn.signals.forEach(add);
      add(`Churn probability: ${capitalize(churn.riskLevel)}`);
    }

    const risk = data.risk.schoolsAtRisk.find((s) => s.id === schoolId);
    if (risk) risk.signals.forEach(add);

    const engagement =
      data.engagement.lowEngagement.find((s) => s.id === schoolId) ??
      data.engagement.schools.find((s) => s.id === schoolId);
    if (engagement) {
      add(`Engagement score: ${engagement.score}`);
      engagement.signals.forEach(add);
    }

    const onboarding =
      data.onboarding.stuckSchools.find((s) => s.id === schoolId) ??
      data.onboarding.schools.find((s) => s.id === schoolId);
    if (onboarding) {
      add(`Onboarding progress: ${onboarding.progressPercent}%`);
      onboarding.missingSteps.slice(0, 2).forEach((step) =>
        add(`Setup pending: ${step}`)
      );
    }
  }

  if (nav?.riskLevel) {
    add(`Churn probability: ${capitalize(nav.riskLevel)}`);
  }
  if (nav?.engagementScore !== undefined) {
    add(`Engagement score: ${nav.engagementScore}`);
  }
  if (nav?.onboardingProgress !== undefined) {
    add(`Onboarding progress: ${nav.onboardingProgress}%`);
  }

  if (source === "revenue" && signals.length === 0) {
    add("Payment or billing activity may need attention");
  }

  return signals.slice(0, 6);
}
