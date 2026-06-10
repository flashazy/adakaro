/** Days without a syllabus update before a subject is considered stale. */
export const STALE_SUBJECT_DAYS = 14;

export function daysSinceUpdate(iso: string | null): number | null {
  if (!iso) return null;
  const updated = new Date(iso);
  if (Number.isNaN(updated.getTime())) return null;
  return Math.floor((Date.now() - updated.getTime()) / 86_400_000);
}

export function isStaleSubject(lastUpdateAt: string | null): boolean {
  const days = daysSinceUpdate(lastUpdateAt);
  if (days === null) return true;
  return days >= STALE_SUBJECT_DAYS;
}

export function formatStaleWarning(days: number | null): string {
  if (days === null) return "No updates recorded";
  if (days >= 30) return `No updates for ${days} days`;
  if (days >= STALE_SUBJECT_DAYS) return `No updates for ${days} days`;
  return "";
}
