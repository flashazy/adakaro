/** UI-only presentation helpers for the Super Admin dashboard (no React). */

export function platformHealthFromAverage(score: number): {
  label: "Poor" | "Fair" | "Good" | "Excellent";
  className: string;
} {
  if (score >= 90) {
    return {
      label: "Excellent",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
    };
  }
  if (score >= 70) {
    return {
      label: "Good",
      className: "bg-blue-50 text-blue-800 ring-blue-200/80",
    };
  }
  if (score >= 40) {
    return {
      label: "Fair",
      className: "bg-amber-50 text-amber-800 ring-amber-200/80",
    };
  }
  return {
    label: "Poor",
    className: "bg-red-50 text-red-800 ring-red-200/80",
  };
}

export function averageHealthCaption(score: number): string {
  if (score >= 90) return "Excellent standing";
  if (score >= 70) return "Solid performance";
  if (score >= 40) return "Room to grow";
  return "Needs improvement";
}

/** Static trend helper text for highlighted KPI cards (display only). */
export function highlightedKpiTrend(label: string, score?: number): string {
  if (label === "Total Schools") return "↗ Platform growth";
  if (label === "Paid Schools") return "💰 Revenue generating";
  if (label === "Average Health Score") {
    if (score !== undefined && score >= 70) return "↗ Solid performance";
    if (score !== undefined && score >= 40) return "→ Room to grow";
    return "⚠ Needs attention";
  }
  return averageHealthCaption(score ?? 0);
}

export function attentionSeverityAccent(priority: number): string {
  if (priority === 1) return "border-l-4 border-l-red-500";
  if (priority === 2) return "border-l-4 border-l-orange-500";
  if (priority === 3) return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-slate-300";
}

/** Color for the large health score value only (display). */
export function healthScoreValueColor(
  category: "excellent" | "healthy" | "at_risk" | "inactive"
): string {
  switch (category) {
    case "excellent":
      return "text-emerald-600";
    case "healthy":
      return "text-green-600";
    case "at_risk":
      return "text-amber-600";
    case "inactive":
      return "text-red-600";
  }
}

/** Subtle scan indicator dot for mobile health scores (no charts/bars). */
export function healthScoreIndicatorDot(
  category: "excellent" | "healthy" | "at_risk" | "inactive"
): string {
  switch (category) {
    case "excellent":
    case "healthy":
      return "bg-emerald-500";
    case "at_risk":
      return "bg-amber-500";
    case "inactive":
      return "bg-red-500";
  }
}

/** Executive callout from existing health distribution counts. */
export function healthOverviewCallout(
  lifecycleStats: {
    healthExcellent: number;
    healthHealthy: number;
    healthAtRisk: number;
    healthInactive: number;
  },
  healthTotal: number
): string | null {
  if (healthTotal <= 0) return null;

  const intervention =
    lifecycleStats.healthAtRisk + lifecycleStats.healthInactive;
  const inactivePercent = Math.round(
    (lifecycleStats.healthInactive / healthTotal) * 100
  );

  if (intervention > 0) {
    return `${intervention} of ${healthTotal} schools require intervention.`;
  }
  if (inactivePercent >= 50) {
    return `${inactivePercent}% of schools are currently inactive.`;
  }

  const thriving =
    lifecycleStats.healthExcellent + lifecycleStats.healthHealthy;
  if (thriving === healthTotal) {
    return "All schools are in healthy or excellent standing.";
  }

  return `${lifecycleStats.healthHealthy + lifecycleStats.healthExcellent} of ${healthTotal} schools are thriving.`;
}

export const SA_TOOLTIPS = {
  healthScore:
    "Combined activity, adoption, and engagement score",
  plan: "Current subscription plan for this school",
  status: "Lifecycle stage based on setup progress and activity",
  topSchool: "Highest performing school on the platform",
} as const;

export function growthOpportunityBadge(insight: string): {
  label: string;
  className: string;
} {
  const lower = insight.toLowerCase();
  if (lower.includes("expansion") || lower.includes("healthy growth")) {
    return {
      label: "Potential Expansion",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
    };
  }
  if (lower.includes("engagement")) {
    return {
      label: "Needs Engagement",
      className: "bg-amber-50 text-amber-800 ring-amber-200/70",
    };
  }
  return {
    label: "Needs Onboarding",
    className: "bg-sky-50 text-sky-800 ring-sky-200/70",
  };
}

export function recommendedActionIcon(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("contact") || lower.includes("setup")) return "🔥";
  if (
    lower.includes("follow up") ||
    lower.includes("at-risk") ||
    lower.includes("re-engage")
  ) {
    return "⚠";
  }
  if (lower.includes("review") || lower.includes("low-health")) return "📋";
  if (lower.includes("archive")) return "📦";
  return "✓";
}
