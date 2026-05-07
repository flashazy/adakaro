/**
 * Synthetic auth email for parent accounts provisioned with admission-based login.
 * Must match `resolveParentLoginEmailFromAdmission` / `buildParentAuthEmail`.
 */
export function sanitizeAdmissionForAuthLocalPart(admissionNumber: string): string {
  return admissionNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildParentAuthEmail(
  schoolId: string,
  admissionNumber: string
): string {
  const school = schoolId.replace(/-/g, "").toLowerCase();
  const adm = sanitizeAdmissionForAuthLocalPart(admissionNumber);
  if (!school || !adm) {
    return "";
  }
  return `parent.${school}.${adm}@adakaro-parent.local`;
}
