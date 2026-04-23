/** Digits only for phone comparison (handles +255, spaces, dashes). */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (phone == null) return "";
  return String(phone).replace(/\D/g, "");
}
