import { differenceInYears, format } from "date-fns";

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift from `parseISO`). */
export function parseLocalYmdToDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** e.g. "DOB: 15 Mar 2010 (Age: 14)" — returns null when unset or invalid. */
export function formatStudentDobWithAge(
  ymd: string | null | undefined
): string | null {
  if (!ymd?.trim()) return null;
  const d = parseLocalYmdToDate(ymd);
  if (!d) return null;
  const age = differenceInYears(new Date(), d);
  return `DOB: ${format(d, "d MMM yyyy")} (Age: ${age})`;
}

/** e.g. "15 Mar 2010 (Age: 14)" — returns null when unset or invalid. */
export function formatStudentDobIdentityValue(
  ymd: string | null | undefined
): string | null {
  if (!ymd?.trim()) return null;
  const d = parseLocalYmdToDate(ymd);
  if (!d) return null;
  const age = differenceInYears(new Date(), d);
  return `${format(d, "d MMM yyyy")} (Age: ${age})`;
}
