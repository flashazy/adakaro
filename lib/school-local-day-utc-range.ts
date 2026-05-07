const DAY_MS = 24 * 60 * 60 * 1000;

function calendarYmdInTimeZone(date: Date, timeZone: string): string {
  const tz = timeZone?.trim() || "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function nextCalendarDayYmdFromYmd(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, day));
  u.setUTCDate(u.getUTCDate() + 1);
  const y2 = u.getUTCFullYear();
  const m2 = String(u.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(u.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

/** Smallest UTC instant where local calendar date in `timeZone` is >= `targetYmd`. */
function firstUtcInstantLocalYmdGte(
  timeZone: string,
  referenceMs: number,
  targetYmd: string
): number {
  let lo = referenceMs - 5 * DAY_MS;
  let hi = referenceMs + 5 * DAY_MS;

  const ymdMs = (ms: number): string =>
    calendarYmdInTimeZone(new Date(ms), timeZone);

  while (compareYmd(ymdMs(lo), targetYmd) >= 0) {
    hi = lo;
    lo -= DAY_MS;
  }
  while (compareYmd(ymdMs(hi), targetYmd) < 0) {
    lo = hi;
    hi += DAY_MS;
  }

  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (compareYmd(ymdMs(mid), targetYmd) < 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return hi;
}

/**
 * Returns UTC ISO bounds [startInclusive, endExclusive) for the school's
 * calendar "today", using IANA timezone from `schools.timezone` when set.
 */
export function schoolLocalCalendarDayUtcIsoRangeIso(
  schoolTimezone: string | null | undefined,
  referenceDateUtc: Date = new Date()
): { startIso: string; endExclusiveIso: string } {
  const tz = schoolTimezone?.trim() || "UTC";
  const refMs = referenceDateUtc.getTime();
  const todayYmd = calendarYmdInTimeZone(referenceDateUtc, tz);
  const tomorrowYmd = nextCalendarDayYmdFromYmd(todayYmd);

  const startMs = firstUtcInstantLocalYmdGte(tz, refMs, todayYmd);
  const endMs = firstUtcInstantLocalYmdGte(tz, refMs, tomorrowYmd);

  return {
    startIso: new Date(startMs).toISOString(),
    endExclusiveIso: new Date(endMs).toISOString(),
  };
}
