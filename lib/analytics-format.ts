import type { SuperAdminAnalyticsPayload } from "./analytics-types";

/** Super Admin analytics display currency (Tanzanian Shilling). */
export const ANALYTICS_CURRENCY_CODE = "TZS" as const;

export interface ExecutiveSummaryLine {
  icon: "rocket" | "trending-up" | "trending-down" | "shield";
  text: string;
}

export interface ExecutiveSummaryBadge {
  label: string;
  kind: "growth" | "health" | "schools" | "students";
}

export interface ExecutiveSummaryView {
  lines: ExecutiveSummaryLine[];
  badges: ExecutiveSummaryBadge[];
}

/** Split timestamp for executive summary footer. */
export function formatExecutiveLastUpdated(iso: string): {
  date: string;
  time: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "Unknown", time: "" };
  }

  return {
    date: d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

/** Format: `16 Jun 2026, 10:45 PM` */
export function formatExecutiveReportGenerated(iso: string): string {
  const { date, time } = formatExecutiveLastUpdated(iso);
  return time ? `${date}, ${time}` : date;
}

export function buildExecutiveSummaryView(
  payload: SuperAdminAnalyticsPayload
): ExecutiveSummaryView {
  const s = payload.summary;
  const g = s.growthPercent;
  const health = payload.platformHealth;
  const lines: ExecutiveSummaryLine[] = [];

  if (s.totalSchools > 0 || s.totalStudents > 0) {
    const schoolPhrase =
      s.totalSchools === 1
        ? "1 new school"
        : `${s.totalSchools.toLocaleString("en-US")} new schools`;
    const studentPhrase =
      s.totalStudents === 1
        ? "1 student"
        : `${s.totalStudents.toLocaleString("en-US")} students`;

    let adoptionNote = "";
    if (g.schools !== null && g.schools > 0) {
      adoptionNote = " Platform adoption continued to expand.";
    } else if (s.totalSchools > 0) {
      adoptionNote = " New schools joined the platform during this period.";
    }

    lines.push({
      icon: "rocket",
      text: `Adakaro added ${schoolPhrase} and ${studentPhrase} during the selected period.${adoptionNote}`,
    });
  } else {
    lines.push({
      icon: "rocket",
      text: "No new schools or students were added during the selected period.",
    });
  }

  if (g.revenue !== null) {
    if (g.revenue > 0) {
      lines.push({
        icon: "trending-up",
        text: `Revenue growth accelerated during this period, up ${g.revenue}% compared to the previous period.`,
      });
    } else if (g.revenue < 0) {
      lines.push({
        icon: "trending-down",
        text: `Revenue softened compared to the previous period, down ${Math.abs(g.revenue)}%.`,
      });
    } else {
      lines.push({
        icon: "trending-up",
        text: "Revenue held steady compared to the previous period.",
      });
    }
  } else if (s.totalRevenue > 0) {
    lines.push({
      icon: "trending-up",
      text: "Revenue was recorded during the selected period.",
    });
  }

  const activeRate =
    s.activeRatePercent > 0
      ? `${s.activeRatePercent}% active schools`
      : s.activeSchools > 0
        ? `${s.activeSchools.toLocaleString("en-US")} active schools`
        : "platform schools tracked";

  if (health.score >= 75) {
    lines.push({
      icon: "shield",
      text: `Platform operations remain stable. Platform Health remains ${health.status} with ${activeRate}.`,
    });
  } else {
    lines.push({
      icon: "shield",
      text: `Platform Health is ${health.status} (${health.score}/100) with ${activeRate}.`,
    });
  }

  const badges: ExecutiveSummaryBadge[] = [];

  if (g.revenue !== null) {
    const arrow = g.revenue > 0 ? "↑" : g.revenue < 0 ? "↓" : "→";
    badges.push({
      kind: "growth",
      label: `Growth ${arrow} ${formatGrowthPercent(g.revenue)}`,
    });
  }

  badges.push({
    kind: "health",
    label: `Health ${health.status}`,
  });

  if (s.totalSchools > 0) {
    badges.push({
      kind: "schools",
      label: `Schools +${s.totalSchools.toLocaleString("en-US")}`,
    });
  }

  if (s.totalStudents > 0) {
    badges.push({
      kind: "students",
      label: `Students +${s.totalStudents.toLocaleString("en-US")}`,
    });
  }

  return { lines, badges };
}

/** Format amounts as `TSh 210,213,950` for executive analytics. */
export function formatAnalyticsCurrency(amount: number): string {
  const n = Number(amount) || 0;
  return `TSh ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatGrowthPercent(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

export function trendDirection(
  v: number | null
): "up" | "down" | "flat" | "unknown" {
  if (v === null) return "unknown";
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}

export function formatPeriodDelta(
  delta: number,
  kind: "count" | "currency" | "percent"
): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = Math.abs(delta);
  if (kind === "currency") {
    return `${sign}${formatAnalyticsCurrency(abs)} vs previous period`;
  }
  if (kind === "percent") {
    return `${sign}${abs}% vs previous period`;
  }
  return `${sign}${abs.toLocaleString("en-US")} vs previous period`;
}

export function buildExecutiveSummaryText(
  payload: SuperAdminAnalyticsPayload
): string {
  const s = payload.summary;
  const g = s.growthPercent;
  const schoolPart =
    s.totalSchools === 1
      ? "1 school"
      : `${s.totalSchools.toLocaleString("en-US")} schools`;
  const studentPart =
    s.totalStudents === 1
      ? "1 student"
      : `${s.totalStudents.toLocaleString("en-US")} students`;

  let revenuePart = "Revenue held steady in the selected period.";
  if (g.revenue !== null) {
    if (g.revenue > 0) {
      revenuePart = `Revenue increased by ${g.revenue}%.`;
    } else if (g.revenue < 0) {
      revenuePart = `Revenue decreased by ${Math.abs(g.revenue)}%.`;
    } else {
      revenuePart = "Revenue was unchanged versus the previous period.";
    }
  }

  const health = payload.platformHealth.status;
  return `Adakaro added ${schoolPart} and ${studentPart} in the selected period. ${revenuePart} Platform health remains ${health}.`;
}

export function platformHealthBadgeClass(
  status: SuperAdminAnalyticsPayload["platformHealth"]["status"]
): string {
  switch (status) {
    case "Excellent":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/50";
    case "Good":
      return "bg-blue-100 text-blue-800 ring-blue-200/70 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800/50";
    case "Warning":
      return "bg-amber-100 text-amber-900 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50";
    case "Critical":
      return "bg-red-100 text-red-800 ring-red-200/70 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900/50";
  }
}
