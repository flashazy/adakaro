/** Local calendar date YYYY-MM-DD (server or client). */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Empty: valid (caller supplies default). Non-empty: must be YYYY-MM-DD.
 * Uses local date parts to reject invalid calendar dates (e.g. 2024-02-31).
 */
export function parseOptionalEnrollmentDate(raw: string): {
  iso: string | null;
  error: string | null;
} {
  const t = raw.trim();
  if (t === "") return { iso: null, error: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return {
      iso: null,
      error: "Enrollment date must be YYYY-MM-DD or left empty for today.",
    };
  }
  const [ys, ms, ds] = t.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) {
    return { iso: null, error: "Invalid enrollment date." };
  }
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return { iso: null, error: "Enrollment date is not a valid calendar date." };
  }
  return { iso: t, error: null };
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
