export type ReportCardFeeScheduleType =
  | "simple"
  | "term_based"
  | "monthly_milestones";

export const SCHEDULE_TYPE_OPTIONS: {
  id: ReportCardFeeScheduleType;
  label: string;
  helper: string;
}[] = [
  {
    id: "simple",
    label: "One rule for this class",
    helper: "Use one payment rule for this class.",
  },
  {
    id: "term_based",
    label: "Different requirement per term",
    helper: "Use this when report cards are released by term.",
  },
  {
    id: "monthly_milestones",
    label: "Payment targets by month",
    helper:
      "Use this when parents are expected to reach payment targets by specific months.",
  },
];

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Parse report card term label (e.g. "Term 1") to 1–3. */
export function parseReportCardTermNumber(term: string | null | undefined): number | null {
  if (!term?.trim()) return null;
  const m = term.trim().match(/^term\s*(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 3 ? n : null;
}

export function formatTermLabel(termNum: number): string {
  return `Term ${termNum}`;
}

export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? `Month ${month}`;
}

export function currentCalendarMonth(): number {
  return new Date().getMonth() + 1;
}

export function defaultAcademicYear(): string {
  return String(new Date().getFullYear());
}

/** Short labels for tables and preview (client-safe). */
export const SCHEDULE_TYPE_SUMMARY_LABELS: Record<
  ReportCardFeeScheduleType,
  string
> = {
  simple: "One rule for the whole year",
  term_based: "Different rules per term (2 or 3 terms)",
  monthly_milestones: "Monthly milestones (Jan–Dec)",
};

export function scheduleTypeSummary(
  scheduleType: ReportCardFeeScheduleType
): string {
  return SCHEDULE_TYPE_SUMMARY_LABELS[scheduleType] ?? SCHEDULE_TYPE_SUMMARY_LABELS.simple;
}
