export type PlanId = "free" | "basic" | "pro" | "enterprise";

/**
 * New tier model:
 *   - Free  → max 20 students, 1 admin, core dashboard features only.
 *   - Any paid plan (basic / pro / enterprise) → unlimited students &
 *     admins, every feature unlocked. The school admin requests an upgrade
 *     and a super admin approves; once `plan !== 'free'` all caps & feature
 *     gates fall away.
 *
 * The four plan ids are kept so existing schools / RPCs / activity logs
 * referencing them continue to work; for billing UX they collapse to two
 * states: "free" vs "paid".
 */
export const PLANS = {
  free: {
    name: "Free",
    studentLimit: 20,
    adminLimit: 1,
    features: [] as const,
  },
  basic: {
    name: "Basic",
    studentLimit: null,
    adminLimit: null,
    features: ["advancedReports", "bulkImport"] as const,
  },
  pro: {
    name: "Pro",
    studentLimit: null,
    adminLimit: null,
    features: ["advancedReports", "bulkImport"] as const,
  },
  enterprise: {
    name: "Enterprise",
    studentLimit: null,
    adminLimit: null,
    features: ["advancedReports", "bulkImport"] as const,
  },
} as const;

/**
 * Which subscription tiers unlock each feature key.
 * Under the new model every paid plan unlocks everything.
 */
export const FEATURES = {
  bulkImport: ["basic", "pro", "enterprise"] as const satisfies readonly PlanId[],
  advancedReports: ["basic", "pro", "enterprise"] as const satisfies readonly PlanId[],
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** @deprecated Prefer PLANS + getPlanLimits; kept for bundle compatibility. */
export const PLAN_LIMITS = {
  free: { maxAdmins: 1 },
  basic: { maxAdmins: 999 },
  pro: { maxAdmins: 999 },
  enterprise: { maxAdmins: 999 },
} as const;

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const p = String(plan ?? "free").toLowerCase().trim();
  if (p === "basic" || p === "pro" || p === "enterprise" || p === "free") {
    return p;
  }
  return "free";
}

/** True when the school is on any paid plan (basic / pro / enterprise). */
export function isPaidPlanId(plan: string | null | undefined): boolean {
  return normalizePlanId(plan) !== "free";
}

/** Free-tier student cap surfaced to UI copy / API errors. */
export const FREE_TIER_STUDENT_LIMIT = PLANS.free.studentLimit;

export function getPlanLimits(plan: string): {
  studentLimit: number | null;
  adminLimit: number | null;
} {
  const key = normalizePlanId(plan);
  const row = PLANS[key];
  return {
    studentLimit: row.studentLimit,
    adminLimit: row.adminLimit,
  };
}

export function canAccessFeature(plan: string, feature: FeatureKey): boolean {
  const p = normalizePlanId(plan);
  const allowed = FEATURES[feature];
  return (allowed as readonly string[]).includes(p);
}

/**
 * Lowest plan that includes the feature (for upgrade CTAs).
 * Under the new model every paid plan unlocks everything, so the answer is
 * always "basic" — the cheapest paid tier.
 */
export function requiredPlanForFeature(_feature: FeatureKey): PlanId {
  return "basic";
}

export function planDisplayName(plan: string): string {
  const key = normalizePlanId(plan);
  return PLANS[key].name;
}

/**
 * Two-state label used everywhere in the upgrade UI: "Free" or "Paid".
 *
 * Per the new tier model the user-facing dashboard collapses every paid tier
 * (basic / pro / enterprise) into a single "Paid" state. Internal super-admin
 * tooling that edits a school's exact plan column should keep using
 * `planDisplayName()`; for any "upgrade" surface, prefer this helper.
 */
export function binaryPlanLabel(plan: string | null | undefined): "Free" | "Paid" {
  return isPaidPlanId(plan) ? "Paid" : "Free";
}

/** Numeric cap for invite math; non-free (null) → high sentinel. */
export function getPlanLimit(plan: string, _limit: "maxAdmins"): number {
  const { adminLimit } = getPlanLimits(plan);
  if (adminLimit == null) return 999;
  return adminLimit;
}
