/** Academic-year timeline expected completion (Jan 1 – Dec 31). */
export function computeExpectedProgressPercent(academicYear: string): number {
  const year = Number.parseInt(academicYear, 10);
  if (!Number.isFinite(year)) return 0;

  const now = new Date();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  if (now < yearStart) return 0;
  if (now > yearEnd) return 100;

  const elapsed = now.getTime() - yearStart.getTime();
  const total = yearEnd.getTime() - yearStart.getTime();
  return Math.round((elapsed / total) * 100);
}

export function computeProgressVariance(
  actualPercent: number,
  expectedPercent: number
): number {
  return actualPercent - expectedPercent;
}
