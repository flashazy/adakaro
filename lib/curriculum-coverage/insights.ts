import type {
  CurriculumActivityItem,
  CurriculumCoverageRow,
} from "@/lib/curriculum-coverage/types";
import {
  daysSinceUpdate,
  STALE_SUBJECT_DAYS,
} from "@/lib/curriculum-coverage/stale";

const MAX_INSIGHTS = 5;

interface InsightCandidate {
  text: string;
  priority: number;
}

function hashString(value: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function rotateCandidates(candidates: InsightCandidate[]): InsightCandidate[] {
  const daySeed = new Date().getDate() + new Date().getMonth() * 31;
  return [...candidates].sort((a, b) => {
    const pa = a.priority * 1000 + (hashString(a.text, daySeed) % 100);
    const pb = b.priority * 1000 + (hashString(b.text, daySeed + 1) % 100);
    return pb - pa;
  });
}

export function buildCurriculumInsights(
  rows: CurriculumCoverageRow[],
  activity: CurriculumActivityItem[]
): string[] {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  const candidates: InsightCandidate[] = [];

  const atRiskCount = active.filter((r) => r.status === "at_risk").length;
  if (atRiskCount > 0) {
    candidates.push({
      text: `${atRiskCount} subject${atRiskCount === 1 ? "" : "s"} ${atRiskCount === 1 ? "is" : "are"} currently at risk.`,
      priority: 95,
    });
  }

  const staleRows = active
    .filter((r) => {
      const days = r.staleDays ?? daysSinceUpdate(r.lastUpdateAt);
      return days === null || days >= STALE_SUBJECT_DAYS;
    })
    .sort((a, b) => (b.staleDays ?? 999) - (a.staleDays ?? 999));

  for (const row of staleRows.slice(0, 3)) {
    const days = row.staleDays ?? daysSinceUpdate(row.lastUpdateAt);
    if (days === null) {
      candidates.push({
        text: `${row.subjectName} ${row.className} has not been updated yet this year.`,
        priority: 88,
      });
    } else {
      candidates.push({
        text: `${row.subjectName} ${row.className} has not been updated for ${days} days.`,
        priority: 85 + Math.min(days, 30),
      });
    }
  }

  for (const row of active) {
    if (
      row.progressVariance < -10 &&
      (row.status === "needs_attention" || row.status === "at_risk")
    ) {
      candidates.push({
        text: `${row.subjectName} ${row.className}: actual ${row.coveragePercent}% vs expected ${row.expectedProgressPercent}% (${row.progressVariance >= 0 ? "+" : ""}${row.progressVariance}%).`,
        priority: 78 + Math.abs(row.progressVariance),
      });
    } else if (row.status === "needs_attention" || row.status === "at_risk") {
      candidates.push({
        text: `${row.subjectName} ${row.className} is ${row.coveragePercent}% complete and below expected progress.`,
        priority: 70 + (100 - row.coveragePercent),
      });
    } else if (row.status === "on_track") {
      candidates.push({
        text: `${row.subjectName} ${row.className} is progressing well at ${row.coveragePercent}%.`,
        priority: 55,
      });
    } else if (row.status === "completed") {
      candidates.push({
        text: `${row.subjectName} ${row.className} has completed syllabus coverage.`,
        priority: 45,
      });
    }
  }

  const weekAgo = Date.now() - 7 * 86_400_000;
  const updatesByTeacher = new Map<string, { name: string; count: number }>();
  for (const item of activity) {
    if (new Date(item.updatedAt).getTime() < weekAgo) continue;
    const existing = updatesByTeacher.get(item.teacherName);
    if (existing) {
      existing.count += 1;
    } else {
      updatesByTeacher.set(item.teacherName, {
        name: item.teacherName,
        count: 1,
      });
    }
  }

  for (const { name, count } of updatesByTeacher.values()) {
    if (count >= 2) {
      candidates.push({
        text: `Teacher ${name} has updated ${count} topics this week.`,
        priority: 60 + count,
      });
    }
  }

  const needsAttention = active.filter(
    (r) => r.status === "needs_attention"
  ).length;
  if (needsAttention > 0) {
    candidates.push({
      text: `${needsAttention} subject${needsAttention === 1 ? "" : "s"} need attention across the school.`,
      priority: 72,
    });
  }

  const seen = new Set<string>();
  const unique: InsightCandidate[] = [];
  for (const c of rotateCandidates(candidates)) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    unique.push(c);
    if (unique.length >= MAX_INSIGHTS) break;
  }

  return unique.map((c) => c.text);
}

export function formatCurriculumLastUpdate(iso: string | null): string {
  if (!iso) return "—";
  const days = daysSinceUpdate(iso);
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Short relative label for dense overview tables. */
export function formatCurriculumLastUpdateTable(iso: string | null): string {
  if (!iso) return "—";
  const days = daysSinceUpdate(iso);
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function formatCurriculumRefreshTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = daysSinceUpdate(iso);
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
