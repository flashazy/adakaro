/** Period selection and storage for lesson plans (single or consecutive). */

/** Periods available in the lesson planner (1st–10th). */
export const PERIOD_CHECKBOX_RANGE = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const;

export const DURATION_PRESETS = [40, 60, 80, 120] as const;

/** Ordinal labels for lesson periods (e.g. 1st … 10th). */
export function ordinalPeriod(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/** Stored value, e.g. `"1st period"` or `"1st & 2nd period"`. */
export function periodsToStorageString(periods: number[]): string {
  const sorted = [...new Set(periods)]
    .filter((n) => n >= 1 && n <= 10)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return "1st period";
  return sorted.map(ordinalPeriod).join(" & ") + " period";
}

/** Backward compatible: numeric DB values, or strings like `"1st period"` / `"1st & 2nd period"`. */
export function parsePeriodsFromDb(
  value: string | number | null | undefined
): number[] {
  if (value == null) return [1];
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value);
    return n >= 1 && n <= 10 ? [n] : [1];
  }
  const re = /\b(\d+)(?:st|nd|rd|th)\b/gi;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(value))) !== null) {
    const v = parseInt(m[1], 10);
    if (v >= 1 && v <= 10) nums.push(v);
  }
  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  return uniq.length ? uniq : [1];
}

export function isConsecutivePeriods(periods: number[]): boolean {
  if (periods.length <= 1) return true;
  const s = [...periods].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) {
    if (s[i] !== s[i - 1] + 1) return false;
  }
  return true;
}

/** List / PDF / view — display only; storage still uses `… period`. Strips trailing word. */
export function formatPeriodForDisplay(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return ordinalPeriod(Math.floor(value));
  }
  const period = String(value).trim();
  if (!period) return "—";
  return period.replace(/\s+period$/i, "").trim();
}
