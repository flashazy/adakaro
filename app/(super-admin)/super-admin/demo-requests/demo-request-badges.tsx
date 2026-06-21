"use client";

import {
  computeLeadPriority,
  computeLeadValue,
  computeLeadScore,
  computeLeadReminders,
  computeRevenueTier,
  formatRevenueTzs,
  computeAnnualRevenueTzs,
  getLeadScoreTier,
  isDemoScheduled,
  isNewLeadFollowUpOverdue,
  needsNextStep,
  reminderToneClass,
  type DemoRequestRow,
  type DemoRequestStatus,
  type DemoRequestTimelineEvent,
  type LeadPriority,
  type LeadScoreTier,
  type LeadValueTier,
  type RevenueTier,
} from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";

const priorityTone: Record<LeadPriority, string> = {
  High: "bg-red-100 text-red-800 ring-red-200",
  Medium: "bg-amber-100 text-amber-900 ring-amber-200",
  Low: "bg-slate-100 text-slate-700 ring-slate-200",
};

const valueTone: Record<LeadValueTier, string> = {
  "Small School": "bg-sky-100 text-sky-800 ring-sky-200",
  "Growing School": "bg-indigo-100 text-indigo-800 ring-indigo-200",
  "Enterprise School": "bg-violet-100 text-violet-900 ring-violet-200",
};

const scoreTierMeta: Record<
  LeadScoreTier,
  { emoji: string; tone: string }
> = {
  "Hot Lead": {
    emoji: "🔥",
    tone: "bg-orange-100 text-orange-900 ring-orange-200",
  },
  "Warm Lead": {
    emoji: "🟡",
    tone: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  "Cold Lead": {
    emoji: "⚪",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
  },
};

const revenueTone: Record<RevenueTier, string> = {
  "Small School": "bg-sky-50 text-sky-800 ring-sky-200",
  "Growing School": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  "Professional School": "bg-violet-50 text-violet-900 ring-violet-200",
  "Enterprise School": "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

const badgeBase =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset";

export function LeadPriorityBadge({
  studentCount,
  schoolType,
  className,
}: {
  studentCount: number | null;
  schoolType: string | null;
  className?: string;
}) {
  const priority = computeLeadPriority(studentCount, schoolType);
  return (
    <span className={cn(badgeBase, priorityTone[priority], className)}>
      {priority}
    </span>
  );
}

export function LeadValueBadge({
  studentCount,
  className,
}: {
  studentCount: number | null;
  className?: string;
}) {
  const value = computeLeadValue(studentCount);
  return (
    <span className={cn(badgeBase, valueTone[value], className)}>
      {value}
    </span>
  );
}

export function LeadScoreBadge({
  row,
  className,
  showScore = true,
}: {
  row: Pick<
    DemoRequestRow,
    "school_type" | "student_count" | "email" | "phone" | "message"
  >;
  className?: string;
  showScore?: boolean;
}) {
  const score = computeLeadScore(row);
  const tier = getLeadScoreTier(score);
  const meta = scoreTierMeta[tier];
  return (
    <span className={cn(badgeBase, meta.tone, className)} title={`Score: ${score}`}>
      {meta.emoji} {tier}
      {showScore ? ` (${score})` : ""}
    </span>
  );
}

export function RevenueOpportunityBadge({
  studentCount,
  className,
  compact = false,
}: {
  studentCount: number | null;
  className?: string;
  compact?: boolean;
}) {
  const tier = computeRevenueTier(studentCount);
  const revenue = formatRevenueTzs(computeAnnualRevenueTzs(studentCount));
  return (
    <span
      className={cn(badgeBase, revenueTone[tier], className)}
      title={revenue}
    >
      {compact ? tier : `${tier} · ${revenue}`}
    </span>
  );
}

export function ScheduledDemoBadge({
  demoDate,
  status,
  className,
}: {
  demoDate: string | null;
  status: DemoRequestStatus;
  className?: string;
}) {
  if (!isDemoScheduled({ demo_date: demoDate, status })) return null;
  return (
    <span
      className={cn(
        badgeBase,
        "bg-emerald-100 text-emerald-800 ring-emerald-200",
        className
      )}
    >
      Scheduled
    </span>
  );
}

export function LeadReminderBadges({
  row,
  timeline = [],
  className,
}: {
  row: DemoRequestRow;
  timeline?: DemoRequestTimelineEvent[];
  className?: string;
}) {
  const reminders = computeLeadReminders(row, timeline);
  if (reminders.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {reminders.map((reminder) => (
        <span
          key={reminder.label}
          className={cn(badgeBase, reminderToneClass(reminder.tone))}
        >
          {reminder.emoji} {reminder.label}
        </span>
      ))}
    </div>
  );
}

export function FollowUpAlertBadges({
  row,
  className,
}: {
  row: Pick<
    DemoRequestRow,
    "status" | "created_at" | "next_action" | "next_action_date"
  >;
  className?: string;
}) {
  const badges: { label: string; tone: string }[] = [];

  if (isNewLeadFollowUpOverdue(row)) {
    badges.push({
      label: "Follow-up overdue",
      tone: "bg-red-100 text-red-800 ring-red-200",
    });
  }
  if (needsNextStep(row)) {
    badges.push({
      label: "Needs next step",
      tone: "bg-orange-100 text-orange-900 ring-orange-200",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((badge) => (
        <span key={badge.label} className={cn(badgeBase, badge.tone)}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}
