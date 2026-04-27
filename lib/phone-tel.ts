/**
 * Build a `tel:` href and display label for parent-facing class-teacher numbers.
 * Tanzania-oriented: local numbers starting with `0` become `+255…`.
 */
export function buildClassTeacherPhoneTel(
  phone: string | null | undefined
): { href: string; display: string } | null {
  if (phone == null) return null;
  const t = phone.trim();
  if (!t) return null;

  const digits = t.replace(/\D/g, "");
  if (!digits) return null;

  let intlDigits: string;
  if (t.startsWith("+")) {
    intlDigits = digits;
  } else if (digits.startsWith("255")) {
    intlDigits = digits;
  } else if (digits.startsWith("0") && digits.length >= 9) {
    intlDigits = `255${digits.slice(1)}`;
  } else if (digits.length === 9) {
    intlDigits = `255${digits}`;
  } else {
    intlDigits = digits;
  }

  return {
    href: `tel:+${intlDigits}`,
    display: `+${intlDigits}`,
  };
}
