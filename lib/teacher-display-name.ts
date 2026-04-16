/**
 * Normalize teacher display names for login matching and duplicate checks
 * (trim, lowercase, collapse internal whitespace).
 */
export function normalizeTeacherDisplayName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
