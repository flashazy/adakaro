/** Default matches Tailwind indigo-600 / DB default. */
export const DEFAULT_SCHOOL_PRIMARY_HEX = "#4f46e5";

const HEX_RE = /^#?([a-f\d]{6})$/i;

/**
 * Parse a school primary hex from DB; invalid or empty values fall back to default.
 */
export function resolveSchoolPrimaryHex(
  raw: string | null | undefined
): string {
  const t = String(raw ?? "").trim();
  if (!t) return DEFAULT_SCHOOL_PRIMARY_HEX;
  const m = HEX_RE.exec(t);
  if (!m) return DEFAULT_SCHOOL_PRIMARY_HEX;
  return `#${m[1].toLowerCase()}`;
}

/**
 * Space-separated RGB for `rgb(var(--school-primary-rgb) / α)` (CSS Color 4).
 */
export function hexToRgb(hex: string): string {
  const h = resolveSchoolPrimaryHex(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return "79 70 229";
  }
  return `${r} ${g} ${b}`;
}
