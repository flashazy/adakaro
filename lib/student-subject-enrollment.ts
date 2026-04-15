export const SUBJECT_ENROLLMENT_TERMS = ["Term 1", "Term 2"] as const;

export type SubjectEnrollmentTerm = (typeof SUBJECT_ENROLLMENT_TERMS)[number];

export function parseSubjectEnrollmentTerm(
  value: string | null | undefined
): SubjectEnrollmentTerm | null {
  if (value === "Term 1" || value === "Term 2") return value;
  return null;
}

export function currentAcademicYear(): number {
  return new Date().getFullYear();
}

/**
 * Default academic period for enrolment-aware teacher tools.
 * Heuristic: Sept–Dec → Term 2; otherwise Term 1 of the calendar year.
 */
export function getCurrentAcademicYearAndTerm(): {
  academicYear: number;
  term: SubjectEnrollmentTerm;
} {
  const d = new Date();
  const m = d.getMonth() + 1;
  if (m >= 9) {
    return { academicYear: d.getFullYear(), term: "Term 2" };
  }
  return { academicYear: d.getFullYear(), term: "Term 1" };
}

/**
 * Database enrolment helpers (`getStudentsForSubject`, `getStudentEnrolledSubjects`,
 * `reportAcademicYearToEnrollmentYear`) live in `@/lib/student-subject-enrollment-queries`
 * (server-only) because they require a Supabase client.
 */
