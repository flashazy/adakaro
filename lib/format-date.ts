export function formatDate(date: string | Date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Short human-readable date for UI. Uses a fixed locale so server and client
 * produce the same string (avoids React hydration mismatches from `undefined` locale).
 */
export function formatShortLocaleDate(
  date: string | Date,
  locale = "en-US"
): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Date + time for detail views. Fixed locale/options so SSR and the browser match
 * (avoids hydration errors from implicit `toLocaleString()` locale differences).
 */
export function formatLocaleDateTime(
  date: string | Date,
  locale = "en-US"
): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
