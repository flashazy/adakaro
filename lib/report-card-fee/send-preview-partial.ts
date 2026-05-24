import type { ClassSendEligibilityPreview } from "./types";

/**
 * Fast estimate for the send modal using roster parent-access flags already
 * loaded on the coordinator page (same term/year).
 */
export function buildPartialSendEligibilityPreview(params: {
  pendingStudentIds: string[];
  parentCanOpenByStudentId: Record<string, boolean>;
  ruleLikelyEnabled: boolean;
  allowAdminOverride?: boolean;
}): ClassSendEligibilityPreview {
  const { pendingStudentIds, parentCanOpenByStudentId, ruleLikelyEnabled } =
    params;
  const totalPending = pendingStudentIds.length;
  let eligibleCount = 0;
  for (const id of pendingStudentIds) {
    if (parentCanOpenByStudentId[id] ?? true) eligibleCount++;
  }
  return {
    ruleEnabled: ruleLikelyEnabled,
    allowAdminOverride: params.allowAdminOverride ?? true,
    appliedRuleLabel: null,
    scheduleType: null,
    eligibleCount,
    blockedCount: totalPending - eligibleCount,
    totalPending,
    students: [],
    isPartial: true,
  };
}
