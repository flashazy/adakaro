"use client";

import { toast } from "sonner";

const MILESTONES = [25, 50, 75] as const;

const MILESTONE_MESSAGES: Record<
  (typeof MILESTONES)[number],
  { title: string; body: (subject: string) => string }
> = {
  25: {
    title: "🎉 Great Progress!",
    body: (subject) => `You have completed 25% of the ${subject} syllabus.`,
  },
  50: {
    title: "🎉 Excellent Work!",
    body: (subject) => `You have completed 50% of the ${subject} syllabus.`,
  },
  75: {
    title: "🎉 Outstanding!",
    body: (subject) => `You have completed 75% of the ${subject} syllabus.`,
  },
};

function storageKey(workspaceKey: string): string {
  return `adakaro-syllabus-milestones:${workspaceKey}`;
}

function loadCelebrated(workspaceKey: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(workspaceKey));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n) => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function saveCelebrated(workspaceKey: string, celebrated: Set<number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(workspaceKey),
      JSON.stringify([...celebrated])
    );
  } catch {
    // Ignore quota / private mode errors — milestones are non-critical UX.
  }
}

/**
 * Show milestone toasts when coverage crosses 25/50/75% for the first time
 * per assignment (persisted in localStorage, not repeated on refresh).
 */
export function celebrateSyllabusMilestones(params: {
  workspaceKey: string;
  subjectName: string;
  prevCoveragePercent: number;
  newCoveragePercent: number;
  totalSubtopics: number;
}): void {
  if (params.totalSubtopics <= 0 || !params.workspaceKey) return;

  const celebrated = loadCelebrated(params.workspaceKey);
  let changed = false;

  for (const milestone of MILESTONES) {
    if (celebrated.has(milestone)) continue;
    if (
      params.newCoveragePercent >= milestone &&
      params.prevCoveragePercent < milestone
    ) {
      const msg = MILESTONE_MESSAGES[milestone];
      toast.success(msg.title, { description: msg.body(params.subjectName) });
      celebrated.add(milestone);
      changed = true;
    }
  }

  if (changed) saveCelebrated(params.workspaceKey, celebrated);
}
