import type { IntelligenceCardId } from "@/lib/super-admin/smart-intelligence-types";

/** Where a Smart Intelligence school action originated. */
export type SmartIntelligenceSource =
  | IntelligenceCardId
  | "priority"
  | "general";

export interface SmartIntelligenceNavigationContext {
  schoolId: string;
  schoolName: string;
  source: SmartIntelligenceSource;
  riskLevel?: string;
  engagementScore?: number;
  onboardingProgress?: number;
}

export interface SchoolIntelligenceContextPayload {
  school: {
    id: string;
    name: string;
    plan: string;
    status: string;
    studentCount: number;
  };
  adminUserIds: string[];
  recipientCounts?: {
    admins: number;
    teachers: number;
    parents: number;
    total: number;
  };
}

const SCROLL_KEY = "sa-intelligence-scroll-y";
const FROM_INTELLIGENCE_KEY = "sa-from-intelligence";

const INTELLIGENCE_HASH = "smart-intelligence";

export function saveIntelligenceScrollPosition(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  sessionStorage.setItem(FROM_INTELLIGENCE_KEY, "1");
}

export function consumeIntelligenceScrollRestore(): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(FROM_INTELLIGENCE_KEY) !== "1") return;
  const raw = sessionStorage.getItem(SCROLL_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
  sessionStorage.removeItem(FROM_INTELLIGENCE_KEY);
  if (!raw) return;
  const y = Number(raw);
  if (!Number.isFinite(y)) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    });
  });
}

export function intelligenceDashboardHref(): string {
  return `/super-admin#${INTELLIGENCE_HASH}`;
}

export function isFromIntelligenceNavigation(
  searchParams: URLSearchParams
): boolean {
  return searchParams.get("from") === "intelligence";
}

export function parseIntelligenceNavigationFromSearchParams(
  searchParams: URLSearchParams
): SmartIntelligenceNavigationContext | null {
  const schoolId = searchParams.get("schoolId")?.trim();
  if (!schoolId) return null;

  const schoolName = searchParams.get("schoolName")?.trim() || "";
  const sourceRaw = searchParams.get("source")?.trim() || "general";
  const source = isValidSource(sourceRaw) ? sourceRaw : "general";

  const riskLevel = searchParams.get("riskLevel")?.trim() || undefined;
  const engagementScore = parseOptionalNumber(searchParams.get("engagementScore"));
  const onboardingProgress = parseOptionalNumber(
    searchParams.get("onboardingProgress")
  );

  return {
    schoolId,
    schoolName,
    source,
    riskLevel,
    engagementScore,
    onboardingProgress,
  };
}

function isValidSource(value: string): value is SmartIntelligenceSource {
  return [
    "churn",
    "risk",
    "revenue",
    "onboarding",
    "engagement",
    "priority",
    "general",
  ].includes(value);
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function appendIntelligenceParams(
  params: URLSearchParams,
  ctx: Partial<SmartIntelligenceNavigationContext>
): void {
  params.set("from", "intelligence");
  if (ctx.source) params.set("source", ctx.source);
  if (ctx.riskLevel) params.set("riskLevel", ctx.riskLevel);
  if (ctx.engagementScore !== undefined) {
    params.set("engagementScore", String(ctx.engagementScore));
  }
  if (ctx.onboardingProgress !== undefined) {
    params.set("onboardingProgress", String(ctx.onboardingProgress));
  }
}

export function buildSchoolProfileHref(schoolId: string): string {
  return `/super-admin/schools/${encodeURIComponent(schoolId)}`;
}

/** Contacts Center row actions — preserve school/intelligence context on profile links. */
export interface ContactsRowActionContext {
  filteredSchoolId?: string | null;
  schoolName?: string | null;
  fromIntelligence?: boolean;
  intelligenceNav?: SmartIntelligenceNavigationContext | null;
}

export function buildContactRowSchoolProfileHref(
  schoolId: string,
  ctx: ContactsRowActionContext
): string {
  const base = buildSchoolProfileHref(schoolId);
  if (!ctx.filteredSchoolId || ctx.filteredSchoolId !== schoolId) {
    return base;
  }

  const params = new URLSearchParams();
  if (ctx.fromIntelligence && ctx.intelligenceNav) {
    params.set("from", "intelligence");
    appendIntelligenceParams(params, ctx.intelligenceNav);
  } else {
    params.set("from", "contacts");
    params.set("schoolId", schoolId);
    const name = ctx.schoolName?.trim() || ctx.intelligenceNav?.schoolName;
    if (name) params.set("schoolName", name);
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildSchoolContactsHref(
  ctx: Pick<
    SmartIntelligenceNavigationContext,
    "schoolId" | "schoolName" | "source"
  > &
    Partial<
      Pick<
        SmartIntelligenceNavigationContext,
        "riskLevel" | "engagementScore" | "onboardingProgress"
      >
    >
): string {
  const params = new URLSearchParams();
  params.set("schoolId", ctx.schoolId);
  if (ctx.schoolName) params.set("schoolName", ctx.schoolName);
  appendIntelligenceParams(params, ctx);
  return `/super-admin/contacts?${params.toString()}`;
}

export function buildSchoolBroadcastHref(
  ctx: SmartIntelligenceNavigationContext
): string {
  const params = new URLSearchParams();
  params.set("schoolId", ctx.schoolId);
  if (ctx.schoolName) params.set("schoolName", ctx.schoolName);
  appendIntelligenceParams(params, ctx);
  return `/super-admin/broadcasts?${params.toString()}`;
}

export interface FollowUpTemplate {
  title: string;
  message: string;
}

const DEFAULT_FOLLOW_UP: FollowUpTemplate = {
  title: "Adakaro Follow-Up",
  message: `Hello,

We wanted to reach out and see how things are going with your school on Adakaro.

If you need help with onboarding, engagement, payments, or platform setup, we would be happy to assist. Our team is available to walk through any open items and make sure your school gets the most from the platform.

Please let us know how we can support you.

Warm regards,
Adakaro Team`,
};

/** Message templates keyed by Smart Intelligence source (presentation only). */
export function getFollowUpTemplate(
  source: SmartIntelligenceSource
): FollowUpTemplate {
  switch (source) {
    case "churn":
    case "risk":
    case "priority":
      return {
        title: "School Retention Follow-Up",
        message: `Hello,

We noticed there has been less platform activity at your school recently, and we wanted to check in.

We would be happy to help review your setup, answer questions, and support your team so day-to-day use stays smooth. Our team is available for a quick walkthrough or refresh whenever it suits you.

Please reply if you would like assistance — we are here to help.

Warm regards,
Adakaro Team`,
      };
    case "onboarding":
      return {
        title: "Onboarding Assistance",
        message: `Hello,

We noticed your school setup on Adakaro is not fully complete yet, and we would be happy to help you finish.

Our team can guide you through adding students, classes, administrators, and any remaining steps so your school is ready to use every feature.

Please let us know a convenient time and we will assist you.

Warm regards,
Adakaro Team`,
      };
    case "revenue":
      return {
        title: "Payment Activity Follow-Up",
        message: `Hello,

We noticed some recent changes in payment or billing activity for your school and wanted to reach out.

Our team is available to help with payment setup, plan questions, and renewal so your Adakaro services continue without interruption.

Please contact us if you would like billing support — we are glad to assist.

Warm regards,
Adakaro Team`,
      };
    case "engagement":
      return {
        title: "Engagement Improvement Support",
        message: `Hello,

We would like to help your school get even more value from Adakaro — from attendance and academics to reports and administration.

Our team can share practical tips and guide your staff on features that support stronger day-to-day engagement.

Please let us know how we can support you.

Warm regards,
Adakaro Team`,
      };
    default:
      return DEFAULT_FOLLOW_UP;
  }
}

export function priorityIssueToSource(issue: string): SmartIntelligenceSource {
  if (issue.includes("Churn")) return "churn";
  if (issue.includes("Setup")) return "onboarding";
  if (issue.includes("Risk")) return "risk";
  return "priority";
}

export function intelligenceCardToSource(
  cardId: IntelligenceCardId
): SmartIntelligenceSource {
  return cardId;
}
