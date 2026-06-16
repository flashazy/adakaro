/** Tanzania-friendly phone normalization for dedup/search; preserves originals separately. */
export function normalizeTzPhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("255") && digits.length >= 12) {
    return digits.slice(0, 12);
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `255${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `255${digits}`;
  }
  return digits;
}

export function normalizePhoneDisplay(
  raw: string | null | undefined
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t;
}

export function normalizeEmail(
  raw: string | null | undefined
): string | null {
  const t = raw?.trim().toLowerCase();
  return t && t.length > 0 ? t : null;
}
