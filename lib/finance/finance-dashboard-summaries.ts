/** Raw balance line from `student_fee_balances` (one row per student × fee structure). */
export interface FinanceBalanceLine {
  student_id: string;
  total_fee: number;
  total_paid: number;
  balance: number;
}

export interface FinanceSummary {
  totalExpected: number;
  collected: number;
  outstanding: number;
  collectionRatePercent: number;
}

export interface FinanceInsight {
  hasData: boolean;
  studentsWithOutstanding: number;
  totalOutstanding: number;
  largestOutstandingClass: string;
}

export type CollectionHealthLevel =
  | "needs_attention"
  | "improving"
  | "healthy";

export interface CollectionHealth {
  level: CollectionHealthLevel;
  label: string;
  detail: string;
  subdetail?: string;
}

/** Compact amount for executive summary lines (e.g. TSh 45.7M). */
export function formatCompactFinanceAmount(
  amount: number,
  currencyCode: string
): string {
  const n = Math.abs(Number(amount) || 0);
  const code = String(currencyCode ?? "TZS").toUpperCase();
  const prefix =
    code === "TZS"
      ? "TSh"
      : code === "KES"
        ? "KSh"
        : code === "UGX"
          ? "UGX"
          : code === "USD"
            ? "$"
            : code;

  if (n >= 1_000_000_000) {
    return `${prefix} ${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${prefix} ${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${prefix} ${(n / 1_000).toFixed(1)}K`;
  }
  return `${prefix} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type StudentBalanceStatus = "cleared" | "partial" | "unpaid";

export type BalanceUrgency = "cleared" | "low" | "medium" | "high";

/** Display-only urgency for outstanding balance amounts (no calculation changes). */
export function getBalanceUrgency(
  totalFee: number,
  balance: number
): BalanceUrgency {
  const bal = Number(balance);
  const fee = Number(totalFee);
  if (bal <= 0) return "cleared";
  if (fee <= 0) return "high";
  const ratio = bal / fee;
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.15) return "medium";
  return "low";
}

/** Tailwind classes for balance amount emphasis. */
export function getBalanceAmountClassName(urgency: BalanceUrgency): string {
  const base = "tabular-nums";
  switch (urgency) {
    case "cleared":
      return `${base} font-medium text-emerald-700 dark:text-emerald-400`;
    case "low":
      return `${base} font-semibold text-emerald-600 dark:text-emerald-400`;
    case "medium":
      return `${base} font-semibold text-amber-700 dark:text-amber-400`;
    case "high":
      return `${base} font-semibold text-red-700/85 dark:text-red-400/90`;
  }
}

/** School-friendly collection rate status (matches collection health bands). */
export function getCollectionRateFriendlyStatus(
  collectionRatePercent: number
): string {
  const rate =
    Number.isFinite(collectionRatePercent) && collectionRatePercent >= 0
      ? collectionRatePercent
      : 0;
  if (rate >= 70) return "Healthy collection";
  if (rate >= 40) return "Improving";
  return "Needs attention";
}

/** School-wide totals from balance lines (same basis as Financial Reports). */
export function buildFinanceSummaryFromBalanceLines(
  lines: FinanceBalanceLine[]
): FinanceSummary {
  let totalExpected = 0;
  let collected = 0;
  let outstanding = 0;

  for (const line of lines) {
    totalExpected += Number(line.total_fee) || 0;
    collected += Number(line.total_paid) || 0;
    outstanding += Math.max(0, Number(line.balance) || 0);
  }

  const collectionRatePercent =
    totalExpected > 0 ? (collected / totalExpected) * 100 : 0;

  return {
    totalExpected,
    collected,
    outstanding,
    collectionRatePercent,
  };
}

export function getCollectionHealth(
  collectionRatePercent: number
): CollectionHealth {
  const rate =
    Number.isFinite(collectionRatePercent) && collectionRatePercent >= 0
      ? collectionRatePercent
      : 0;
  const pct = rate.toFixed(1);

  if (rate >= 70) {
    return {
      level: "healthy",
      label: "Healthy",
      detail: `${pct}% collected`,
    };
  }
  if (rate >= 40) {
    return {
      level: "improving",
      label: "Improving",
      detail: `${pct}% collected`,
    };
  }
  return {
    level: "needs_attention",
    label: "Needs attention",
    detail: "Collection is below target.",
    subdetail: `Only ${pct}% collected.`,
  };
}

export function buildFinanceInsight(
  lines: FinanceBalanceLine[],
  classMap: Record<string, string>,
  studentClassMap: Record<string, string>
): FinanceInsight {
  if (lines.length === 0) {
    return {
      hasData: false,
      studentsWithOutstanding: 0,
      totalOutstanding: 0,
      largestOutstandingClass: "",
    };
  }

  const balanceByStudent = new Map<string, number>();
  const classIdByStudent = new Map<string, string>();

  for (const line of lines) {
    const sid = line.student_id;
    const bal = Math.max(0, Number(line.balance) || 0);
    balanceByStudent.set(sid, (balanceByStudent.get(sid) ?? 0) + bal);
    if (!classIdByStudent.has(sid)) {
      classIdByStudent.set(sid, studentClassMap[sid] ?? "");
    }
  }

  let studentsWithOutstanding = 0;
  let totalOutstanding = 0;
  const outstandingByClass = new Map<string, number>();

  for (const [sid, bal] of balanceByStudent) {
    if (bal <= 0) continue;
    studentsWithOutstanding += 1;
    totalOutstanding += bal;
    const classId = classIdByStudent.get(sid) ?? "";
    const className = classMap[classId] ?? "Unknown";
    outstandingByClass.set(
      className,
      (outstandingByClass.get(className) ?? 0) + bal
    );
  }

  let largestOutstandingClass = "";
  let maxOutstanding = 0;
  for (const [className, amount] of outstandingByClass) {
    if (amount > maxOutstanding) {
      maxOutstanding = amount;
      largestOutstandingClass = className;
    }
  }

  return {
    hasData: true,
    studentsWithOutstanding,
    totalOutstanding,
    largestOutstandingClass,
  };
}

/** Visual status for a student fee row (does not change balances). */
export function getStudentBalanceStatus(
  totalPaid: number,
  balance: number
): StudentBalanceStatus {
  const bal = Number(balance);
  const paid = Number(totalPaid);
  if (bal <= 0) return "cleared";
  if (paid > 0 && bal > 0) return "partial";
  return "unpaid";
}

export const COLLECTION_RATE_TARGET_PERCENT = 70;

export type OutstandingRiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type TrendTone = "positive" | "negative" | "neutral";

export interface CollectedMonthTrend {
  hint: string;
  tone: TrendTone;
}

/** Month-over-month collected display hint from payment dates (display only). */
export function computeCollectedMonthTrend(
  payments: { payment_date: string; amount: number }[]
): CollectedMonthTrend | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;

  let currentTotal = 0;
  let previousTotal = 0;

  for (const payment of payments) {
    const d = new Date(payment.payment_date);
    if (Number.isNaN(d.getTime())) continue;
    const amount = Number(payment.amount) || 0;
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      currentTotal += amount;
    } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
      previousTotal += amount;
    }
  }

  if (currentTotal === 0 && previousTotal === 0) {
    return { hint: "No collections this month yet", tone: "neutral" };
  }
  if (previousTotal === 0) {
    return { hint: "↑ New collections this month", tone: "positive" };
  }

  const changePct = ((currentTotal - previousTotal) / previousTotal) * 100;
  const rounded = Math.round(changePct);
  if (rounded === 0) {
    return { hint: "→ Steady vs last month", tone: "neutral" };
  }
  if (rounded > 0) {
    return { hint: `↑ +${rounded}% this month`, tone: "positive" };
  }
  return { hint: `↓ ${rounded}% this month`, tone: "negative" };
}

/** Display-only outstanding risk from summary totals. */
export function getOutstandingRiskLevel(
  outstanding: number,
  totalExpected: number
): OutstandingRiskLevel {
  const out = Math.max(0, Number(outstanding) || 0);
  const expected = Number(totalExpected) || 0;
  if (expected <= 0) return out > 0 ? "HIGH" : "LOW";
  const ratio = out / expected;
  if (ratio > 0.5) return "HIGH";
  if (ratio > 0.25) return "MEDIUM";
  return "LOW";
}

/** Target progress bar color for collection rate card. */
export function getCollectionTargetBarColor(ratePercent: number): string {
  const rate = Number.isFinite(ratePercent) ? ratePercent : 0;
  if (rate >= 70) return "bg-emerald-500";
  if (rate >= 30) return "bg-sky-500";
  return "bg-amber-500";
}

/** Action-focused collection message for Finance Insight. */
export function getCollectionFocusMessage(insight: FinanceInsight): string | null {
  if (!insight.hasData || insight.studentsWithOutstanding === 0) {
    return null;
  }
  const parts: string[] = [];
  if (insight.studentsWithOutstanding > 0) {
    parts.push(
      `${insight.studentsWithOutstanding} student${insight.studentsWithOutstanding !== 1 ? "s" : ""} still need follow-up.`
    );
  }
  if (insight.largestOutstandingClass) {
    parts.push(`Focus collections on ${insight.largestOutstandingClass}.`);
  }
  return parts.join(" ");
}
