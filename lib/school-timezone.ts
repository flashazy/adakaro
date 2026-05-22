/** East Africa Time — default when `schools.timezone` is unset */
export const DEFAULT_SCHOOL_DISPLAY_TIMEZONE = "Africa/Dar_es_Salaam";

/** Fixed UTC offsets (minutes east of UTC) for stable SSR/client formatting. */
const STABLE_TZ_OFFSET_MINUTES: Record<string, number> = {
  "Africa/Dar_es_Salaam": 180,
  "Africa/Nairobi": 180,
  "Africa/Kampala": 180,
};

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Format an ISO timestamp identically on server and browser (avoids hydration mismatch).
 * Uses a fixed offset for known school zones instead of Intl ICU differences in Node vs Chrome.
 */
export function formatDateTimeStable(
  iso: string,
  timeZone: string = DEFAULT_SCHOOL_DISPLAY_TIMEZONE
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const offsetMinutes =
    STABLE_TZ_OFFSET_MINUTES[timeZone] ??
    STABLE_TZ_OFFSET_MINUTES[DEFAULT_SCHOOL_DISPLAY_TIMEZONE] ??
    0;
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);

  const day = local.getUTCDate();
  const month = MONTHS_SHORT[local.getUTCMonth()] ?? "???";
  const year = local.getUTCFullYear();
  let hours = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

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
  const zone = resolveSchoolDisplayTimezone(timeZone);
  try {
    const dateStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
    const timeStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    return `${dateStr} - ${timeStr}`;
  } catch (err) {
    console.error("[formatDateTimeInSchoolZone] invalid timezone", {
      timeZone: zone,
      error: err instanceof Error ? err.message : String(err),
    });
    return formatDateTimeStable(iso, DEFAULT_SCHOOL_DISPLAY_TIMEZONE);
  }
}

/**
 * e.g. "Apr 26, 2026 · 09:54 AM" in the school IANA zone.
 * Used for student profile payment history.
 */
export function formatPaymentRecordedAtInSchoolZone(
  iso: string | null | undefined,
  timeZone: string
): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${dateStr} · ${timeStr}`;
}
