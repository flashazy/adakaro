/** Academic department hub routes (teacher dashboard). */
export const ACADEMIC_HUB = "/teacher-dashboard/academic";

export const ACADEMIC_STUDENT_PROFILES = `${ACADEMIC_HUB}/student-profiles`;

export const ACADEMIC_REPORTS = `${ACADEMIC_HUB}/reports`;

export const ACADEMIC_PROMOTIONS = `${ACADEMIC_HUB}/promotions`;

export const ACADEMIC_CURRICULUM_COVERAGE = `${ACADEMIC_HUB}/curriculum-coverage`;

/** Legacy routes kept for bookmarks and deep links. */
export const LEGACY_STUDENT_PROFILES = "/teacher-dashboard/students";

export const LEGACY_ACADEMIC_REPORTS = "/teacher-dashboard/academic-reports";

export const LEGACY_PROMOTIONS = "/dashboard/promotions";

export function pathIsUnderAcademicSection(pathname: string): boolean {
  if (
    pathname === ACADEMIC_HUB ||
    pathname.startsWith(`${ACADEMIC_HUB}/`)
  ) {
    return true;
  }
  if (
    pathname === LEGACY_STUDENT_PROFILES ||
    pathname.startsWith(`${LEGACY_STUDENT_PROFILES}/`)
  ) {
    return true;
  }
  if (
    pathname === LEGACY_ACADEMIC_REPORTS ||
    pathname.startsWith(`${LEGACY_ACADEMIC_REPORTS}/`)
  ) {
    return true;
  }
  if (
    pathname === LEGACY_PROMOTIONS ||
    pathname.startsWith(`${LEGACY_PROMOTIONS}/`)
  ) {
    return true;
  }
  return false;
}
