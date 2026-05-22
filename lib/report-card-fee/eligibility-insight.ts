import type { ReportCardFeeRuleType } from "./types";

/** Default gap (percentage points) for "almost eligible" preview insight. */
export const DEFAULT_ALMOST_ELIGIBLE_BUFFER_PERCENT = 10;

export type EligibilityInsightStatus = "eligible" | "almost" | "blocked";

export interface EligibilityInsightStudentInput {
  studentName: string;
  admissionNumber: string | null;
  paidAmount: number;
  paidPercent: number;
  requiredAmount: number | null;
  requiredPercent: number | null;
  ruleType: ReportCardFeeRuleType | null;
  appliedRuleLabel: string;
  /** From access engine — used only when rule disabled (all eligible). */
  engineEligible: boolean;
}

export interface EligibilityInsightStudentRow {
  studentName: string;
  admissionNumber: string | null;
  paidAmount: number;
  paidPercent: number;
  requiredAmount: number | null;
  requiredPercent: number | null;
  ruleType: ReportCardFeeRuleType | null;
  appliedRuleLabel: string;
  status: EligibilityInsightStatus;
  remainingGapPercent: number;
  needMorePercent: number;
  remainingAmount: number;
}

export interface EligibilityInsightResult {
  eligibleCount: number;
  almostEligibleCount: number;
  blockedCount: number;
  bufferPercent: number;
  sampleBlocked: EligibilityInsightStudentRow[];
  sampleAlmostEligible: EligibilityInsightStudentRow[];
  sampleEligible: EligibilityInsightStudentRow[];
  blockedMoreCount: number;
  almostEligibleMoreCount: number;
  collectionOpportunityCount: number;
  estimatedRemainingCollection: number;
}

const SAMPLE_LIMIT = 5;

export function resolveRequiredPercentForInsight(
  row: Pick<
    EligibilityInsightStudentInput,
    "requiredPercent" | "requiredAmount" | "ruleType" | "paidAmount"
  >
): number {
  if (row.ruleType === "percentage" && row.requiredPercent != null) {
    return Number(row.requiredPercent);
  }
  if (
    row.ruleType === "fixed_amount" &&
    row.requiredAmount != null &&
    row.requiredAmount > 0
  ) {
    return 100;
  }
  return row.requiredPercent ?? 100;
}

export function resolvePaidPercentForInsight(
  row: Pick<
    EligibilityInsightStudentInput,
    "paidPercent" | "paidAmount" | "requiredAmount" | "ruleType"
  >
): number {
  if (row.ruleType === "percentage") {
    return Number(row.paidPercent);
  }
  if (
    row.ruleType === "fixed_amount" &&
    row.requiredAmount != null &&
    row.requiredAmount > 0
  ) {
    return Math.min(100, (row.paidAmount / row.requiredAmount) * 100);
  }
  return Number(row.paidPercent);
}

export function classifyInsightStatus(
  paidPercent: number,
  requiredPercent: number,
  bufferPercent: number
): EligibilityInsightStatus {
  const paid = Math.round(paidPercent * 100) / 100;
  const required = Math.round(requiredPercent * 100) / 100;
  if (paid >= required) return "eligible";
  const remainingGap = required - paid;
  if (remainingGap <= bufferPercent) return "almost";
  return "blocked";
}

function minimumRequiredAmount(
  row: EligibilityInsightStudentInput,
  requiredPercent: number,
  feeAssigned: number
): number {
  if (row.requiredAmount != null && row.requiredAmount > 0) {
    return row.requiredAmount;
  }
  if (feeAssigned > 0 && row.ruleType === "percentage") {
    return (feeAssigned * requiredPercent) / 100;
  }
  return 0;
}

function toInsightRow(
  row: EligibilityInsightStudentInput,
  status: EligibilityInsightStatus,
  requiredPercent: number,
  paidPercent: number,
  feeAssigned: number
): EligibilityInsightStudentRow {
  const minRequired = minimumRequiredAmount(row, requiredPercent, feeAssigned);
  const remainingAmount = Math.max(0, minRequired - row.paidAmount);
  const remainingGapPercent = Math.max(0, requiredPercent - paidPercent);

  return {
    studentName: row.studentName,
    admissionNumber: row.admissionNumber,
    paidAmount: row.paidAmount,
    paidPercent: Math.round(paidPercent * 10) / 10,
    requiredAmount: row.requiredAmount,
    requiredPercent: row.requiredPercent,
    ruleType: row.ruleType,
    appliedRuleLabel: row.appliedRuleLabel,
    status,
    remainingGapPercent: Math.round(remainingGapPercent * 10) / 10,
    needMorePercent: Math.round(remainingGapPercent * 10) / 10,
    remainingAmount: Math.round(remainingAmount),
  };
}

/**
 * Preview-only intelligence buckets (does not affect parent access eligibility).
 */
export function calculateEligibilityInsight(
  students: EligibilityInsightStudentInput[],
  options?: {
    bufferPercent?: number;
    feeAssigned?: number;
    ruleEnabled?: boolean;
  }
): EligibilityInsightResult {
  const bufferPercent =
    options?.bufferPercent ?? DEFAULT_ALMOST_ELIGIBLE_BUFFER_PERCENT;
  const feeAssigned = options?.feeAssigned ?? 0;
  const ruleEnabled = options?.ruleEnabled ?? true;

  const eligible: EligibilityInsightStudentRow[] = [];
  const almost: EligibilityInsightStudentRow[] = [];
  const blocked: EligibilityInsightStudentRow[] = [];

  if (!ruleEnabled) {
    for (const s of students) {
      eligible.push(
        toInsightRow(s, "eligible", 0, 100, feeAssigned)
      );
    }
    return {
      eligibleCount: eligible.length,
      almostEligibleCount: 0,
      blockedCount: 0,
      bufferPercent,
      sampleBlocked: [],
      sampleAlmostEligible: [],
      sampleEligible: eligible.slice(0, SAMPLE_LIMIT),
      blockedMoreCount: 0,
      almostEligibleMoreCount: 0,
      collectionOpportunityCount: 0,
      estimatedRemainingCollection: 0,
    };
  }

  for (const s of students) {
    const requiredPercent = resolveRequiredPercentForInsight(s);
    const paidPercent = resolvePaidPercentForInsight(s);
    const status = classifyInsightStatus(
      paidPercent,
      requiredPercent,
      bufferPercent
    );
    const insightRow = toInsightRow(
      s,
      status,
      requiredPercent,
      paidPercent,
      feeAssigned
    );

    if (status === "eligible") eligible.push(insightRow);
    else if (status === "almost") almost.push(insightRow);
    else blocked.push(insightRow);
  }

  const sortByName = (
    a: EligibilityInsightStudentRow,
    b: EligibilityInsightStudentRow
  ) => {
    const aKey = a.admissionNumber ?? a.studentName;
    const bKey = b.admissionNumber ?? b.studentName;
    return aKey.localeCompare(bKey);
  };

  eligible.sort(sortByName);
  almost.sort((a, b) => a.needMorePercent - b.needMorePercent);
  blocked.sort(sortByName);

  const estimatedRemainingCollection = almost.reduce(
    (sum, row) => sum + row.remainingAmount,
    0
  );

  return {
    eligibleCount: eligible.length,
    almostEligibleCount: almost.length,
    blockedCount: blocked.length,
    bufferPercent,
    sampleBlocked: blocked.slice(0, SAMPLE_LIMIT),
    sampleAlmostEligible: almost.slice(0, SAMPLE_LIMIT),
    sampleEligible: eligible.slice(0, SAMPLE_LIMIT),
    blockedMoreCount: Math.max(0, blocked.length - SAMPLE_LIMIT),
    almostEligibleMoreCount: Math.max(0, almost.length - SAMPLE_LIMIT),
    collectionOpportunityCount: almost.length,
    estimatedRemainingCollection,
  };
}
