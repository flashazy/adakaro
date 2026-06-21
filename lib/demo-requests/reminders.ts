import type { DemoRequestRow, DemoRequestTimelineEvent } from "@/lib/demo-requests/types";
import { getLastActivityIso } from "@/lib/demo-requests/sales-execution";

export type ReminderTone = "red" | "amber" | "blue";

export interface LeadReminder {
  emoji: string;
  label: string;
  tone: ReminderTone;
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function isTomorrow(dateIso: string): boolean {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

export function computeLeadReminders(
  row: DemoRequestRow,
  timeline: DemoRequestTimelineEvent[] = []
): LeadReminder[] {
  if (row.status === "Won" || row.status === "Lost") return [];

  const reminders: LeadReminder[] = [];
  const lastActivity = getLastActivityIso(row, timeline);
  const inactiveHours = hoursSince(lastActivity) ?? hoursSince(row.created_at) ?? 0;
  const inactiveDays = daysSince(lastActivity) ?? daysSince(row.created_at) ?? 0;

  if (row.status === "New" && inactiveHours >= 24) {
    reminders.push({
      emoji: "⚠",
      label: "Follow-up overdue",
      tone: "red",
    });
  }

  if (row.status === "Contacted" && inactiveDays >= 3) {
    reminders.push({
      emoji: "⚠",
      label: "Follow-up required",
      tone: inactiveDays >= 5 ? "red" : "amber",
    });
  }

  if (row.status === "Demo Scheduled" && row.demo_date && isTomorrow(row.demo_date)) {
    reminders.push({
      emoji: "📅",
      label: "Demo tomorrow",
      tone: "blue",
    });
  }

  if (row.status === "Demo Completed" && inactiveDays >= 2) {
    reminders.push({
      emoji: "⚠",
      label: "Waiting for next step",
      tone: inactiveDays >= 5 ? "red" : "amber",
    });
  }

  if (row.next_action_date) {
    const due = new Date(row.next_action_date);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due.getTime() === today.getTime()) {
      reminders.push({
        emoji: "⚠",
        label: "Follow-up due today",
        tone: "amber",
      });
    } else if (due < today) {
      reminders.push({
        emoji: "⚠",
        label: "Follow-up overdue",
        tone: "red",
      });
    }
  }

  const seen = new Set<string>();
  return reminders.filter((r) => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  });
}

export function reminderToneClass(tone: ReminderTone): string {
  switch (tone) {
    case "red":
      return "bg-red-50 text-red-800 ring-red-200";
    case "amber":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-blue-50 text-blue-800 ring-blue-200";
  }
}
