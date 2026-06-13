export const SCHOOL_SETTINGS_VISITED_STORAGE_PREFIX =
  "adakaro-school-settings-visited";

export function schoolSettingsVisitedKey(schoolId: string): string {
  return `${SCHOOL_SETTINGS_VISITED_STORAGE_PREFIX}:${schoolId}`;
}

export interface SchoolProfileSetupFields {
  current_academic_year?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
}

/** True when core school profile details exist beyond the initial school name. */
export function isSchoolProfileComplete(
  school: SchoolProfileSetupFields
): boolean {
  if (!school.current_academic_year?.trim()) {
    return false;
  }

  return Boolean(
    school.logo_url?.trim() ||
      school.phone?.trim() ||
      school.email?.trim() ||
      school.address?.trim()
  );
}
