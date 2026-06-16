import { formatAnalyticsCurrency } from "./analytics-format";
import type { MonthlyTrendRow } from "./analytics-types";

function formatCompactTsh(amount: number): string {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) {
    return `TSh ${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `TSh ${(n / 1_000).toFixed(0)}K`;
  }
  return formatAnalyticsCurrency(n);
}

export function buildRevenueChartInsight(trends: MonthlyTrendRow[]): string {
  const withData = trends.filter((t) => t.revenue > 0);
  if (!withData.length) {
    return "No revenue recorded in the selected period yet.";
  }
  const peak = withData.reduce((best, row) =>
    row.revenue >= best.revenue ? row : best
  );
  return `Revenue peaked in ${peak.monthLabel} at ${formatCompactTsh(peak.revenue)}.`;
}

export function buildStudentChartInsight(trends: MonthlyTrendRow[]): string {
  const withData = trends.filter((t) => t.newStudents > 0);
  if (!withData.length) {
    return "No new students were added during this period.";
  }
  if (withData.length === 1) {
    return `Student intake was concentrated in ${withData[0]!.monthLabel}.`;
  }

  let bestIdx = 1;
  let bestAccel = -Infinity;
  for (let i = 1; i < trends.length; i += 1) {
    const accel = trends[i]!.newStudents - trends[i - 1]!.newStudents;
    if (accel > bestAccel) {
      bestAccel = accel;
      bestIdx = i;
    }
  }

  if (bestAccel > 0) {
    return `Student growth accelerated sharply in ${trends[bestIdx]!.monthLabel}.`;
  }

  const peak = withData.reduce((best, row) =>
    row.newStudents >= best.newStudents ? row : best
  );
  return `Strongest student intake was in ${peak.monthLabel} (${peak.newStudents.toLocaleString("en-US")} new).`;
}

export function buildSchoolChartInsight(trends: MonthlyTrendRow[]): string {
  const withData = trends.filter((t) => t.newSchools > 0);
  if (!withData.length) {
    return "No new schools joined during this period.";
  }
  if (withData.length === 1) {
    return `The only new school joined in ${withData[0]!.monthLabel}.`;
  }

  const first = withData[0]!.monthLabel;
  const last = withData[withData.length - 1]!.monthLabel;
  if (first === last) {
    return `New school sign-ups clustered in ${first}.`;
  }
  return `Most school growth occurred between ${first} and ${last}.`;
}

export function buildStudentPeriodInsight(totalStudents: number): string {
  if (totalStudents <= 0) {
    return "No new students were added during the selected period.";
  }
  return `${totalStudents.toLocaleString("en-US")} student${totalStudents === 1 ? "" : "s"} were added during the selected period.`;
}

export function buildSchoolStatusInsight(
  active: number,
  suspended: number
): string {
  const total = active + suspended;
  if (total === 0) return "No schools on the platform yet.";
  if (suspended === 0) {
    return `All ${active.toLocaleString("en-US")} schools are currently active.`;
  }
  const pct = Math.round((active / total) * 100);
  return `${pct}% of schools are active (${active} active, ${suspended} suspended).`;
}

export function buildRevenueBySchoolInsight(
  schools: { name: string; revenue: number }[]
): string {
  if (!schools.length) {
    return "No school-level revenue in this date range.";
  }
  const top = schools[0]!;
  const total = schools.reduce((sum, row) => sum + row.revenue, 0);
  const pct = total > 0 ? Math.round((top.revenue / total) * 100) : 0;
  return `${top.name} contributed ${pct}% of recorded revenue.`;
}

export function buildStudentDistributionInsight(
  slices: { name: string; value: number }[]
): string {
  if (!slices.length) return "Student distribution data is not available yet.";
  const top = slices.reduce((best, row) =>
    row.value >= best.value ? row : best
  );
  const total = slices.reduce((sum, row) => sum + row.value, 0);
  const pct = total > 0 ? Math.round((top.value / total) * 100) : 0;
  return `${top.name} accounts for ${pct}% of platform students.`;
}

export function buildCumulativeGrowthInsight(
  trends: MonthlyTrendRow[]
): string {
  const total = trends.reduce((sum, row) => sum + row.newSchools, 0);
  if (total === 0) {
    return "No cumulative school growth in the selected period.";
  }
  return `${total.toLocaleString("en-US")} new school${total === 1 ? "" : "s"} joined across the selected period.`;
}

export function formatAnalyticsUpdatedAt(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }

  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();

  if (sameDay) {
    const hours = Math.floor(diffMin / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const datePart = then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = then.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}
