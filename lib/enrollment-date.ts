/** Local calendar date YYYY-MM-DD (server or client). */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ENROLLMENT_DATE_INVALID =
  "Invalid date. Please use YYYY-MM-DD (e.g., 2026-04-24) or DD/MM/YYYY (e.g., 24/04/2026).";

const ENROLLMENT_DATE_UNRECOGNIZED =
  "Enrollment date format not recognized. Accepted: 2026-04-24, 24/04/2026, or 24-04-2026. Leave blank for today.";

/** YYYY-MM-DD with zero-padded month and day. */
function isoFromYmd(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || y < 1 || y > 9999) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Empty: valid (caller supplies default). Non-empty: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY.
 * Uses local date parts to reject invalid calendar dates (e.g. 31/02/2025).
 */
export function parseOptionalEnrollmentDate(raw: string): {
  iso: string | null;
  error: string | null;
} {
  const t = raw.trim();
  if (t === "") return { iso: null, error: null };

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [ys, ms, ds] = t.split("-");
    const iso = isoFromYmd(Number(ys), Number(ms), Number(ds));
    if (!iso) return { iso: null, error: ENROLLMENT_DATE_INVALID };
    return { iso, error: null };
  }

  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const iso = isoFromYmd(year, month, day);
    if (!iso) return { iso: null, error: ENROLLMENT_DATE_INVALID };
    return { iso, error: null };
  }

  const dashDmy = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDmy) {
    const day = Number(dashDmy[1]);
    const month = Number(dashDmy[2]);
    const year = Number(dashDmy[3]);
    const iso = isoFromYmd(year, month, day);
    if (!iso) return { iso: null, error: ENROLLMENT_DATE_INVALID };
    return { iso, error: null };
  }

  return { iso: null, error: ENROLLMENT_DATE_UNRECOGNIZED };
}

const SHORT_MONTHS = [
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

/** Display-only: ISO date YYYY-MM-DD → "d Mon yyyy". */
export function formatEnrollmentDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ys, ms, ds] = iso.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}
