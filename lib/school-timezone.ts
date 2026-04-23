/** East Africa Time — default when `schools.timezone` is unset */
export const DEFAULT_SCHOOL_DISPLAY_TIMEZONE = "Africa/Dar_es_Salaam";

export function resolveSchoolDisplayTimezone(
  stored: string | null | undefined
): string {
  const t = stored?.trim();
  return t && t.length > 0 ? t : DEFAULT_SCHOOL_DISPLAY_TIMEZONE;
}

/** e.g. "8:43 AM" in the given IANA zone; `null` if `iso` is invalid. */
export function formatTimeInSchoolZone(
  iso: string | null | undefined,
  timeZone: string
): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(d);
}

/** e.g. "23 Apr 2026 - 09:29 AM" in the school zone; `null` if `iso` is invalid. */
export function formatDateTimeInSchoolZone(
  iso: string | null | undefined,
  timeZone: string
): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${dateStr} - ${timeStr}`;
}
