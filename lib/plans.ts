export type PlanId = "free" | "basic" | "pro" | "enterprise";

/** Central plan configuration (limits + marketing names). */
export const PLANS = {
  free: {
    name: "Free",
    studentLimit: 50,
    adminLimit: 1,
    features: [] as const,
  },
  basic: {
    name: "Basic",
    studentLimit: 200,
    adminLimit: 2,
    features: ["advancedReports"] as const,
  },
  pro: {
    name: "Pro",
    studentLimit: 500,
    adminLimit: 5,
    features: ["advancedReports", "bulkImport"] as const,
  },
  enterprise: {
    name: "Enterprise",
    studentLimit: null,
    adminLimit: null,
    features: ["advancedReports", "bulkImport"] as const,
  },
} as const;

/** Which subscription tiers unlock each feature key. */
export const FEATURES = {
  bulkImport: ["pro", "enterprise"] as const satisfies readonly PlanId[],
  advancedReports: ["basic", "pro", "enterprise"] as const satisfies readonly PlanId[],
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** @deprecated Prefer PLANS + getPlanLimits; kept for bundle compatibility. */
export const PLAN_LIMITS = {
  free: { maxAdmins: 1 },
  basic: { maxAdmins: 2 },
  pro: { maxAdmins: 5 },
  enterprise: { maxAdmins: 999 },
} as const;

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const p = String(plan ?? "free").toLowerCase().trim();
  if (p === "basic" || p === "pro" || p === "enterprise" || p === "free") {
    return p;
  }
  return "free";
}

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
 * bulkImport → pro, advancedReports → basic
 */
export function requiredPlanForFeature(feature: FeatureKey): PlanId {
  if (feature === "bulkImport") return "pro";
  return "basic";
}

export function planDisplayName(plan: string): string {
  const key = normalizePlanId(plan);
  return PLANS[key].name;
}

/** Numeric cap for invite math; enterprise (null) → high sentinel. */
export function getPlanLimit(plan: string, limit: "maxAdmins"): number {
  const { adminLimit } = getPlanLimits(plan);
  if (adminLimit == null) return 999;
  return adminLimit;
}
