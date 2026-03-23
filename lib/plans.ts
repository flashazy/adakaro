export type PlanId = "free" | "basic" | "pro" | "enterprise";

export const PLAN_LIMITS = {
  free: { maxAdmins: 1 },
  basic: { maxAdmins: 2 },
  pro: { maxAdmins: 5 },
  enterprise: { maxAdmins: 999 },
} as const;

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const p = String(plan ?? "free").toLowerCase();
  if (p === "basic" || p === "pro" || p === "enterprise" || p === "free") {
    return p;
  }
  return "free";
}

export function getPlanLimit(
  plan: string,
  limit: "maxAdmins"
): number {
  const key = normalizePlanId(plan);
  return PLAN_LIMITS[key][limit] ?? 1;
}

export function planDisplayName(plan: string): string {
  return normalizePlanId(plan).replace(/^./, (c) => c.toUpperCase());
}
