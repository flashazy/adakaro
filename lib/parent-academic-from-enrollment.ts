/**
 * Parent dashboard: only show academic records (marks, report cards, sheets)
 * from the student's `students.enrollment_date` onward.
 */

/** YYYY-MM-DD prefix for comparisons (handles date and timestamptz strings). */
export function calendarDateKey(isoOrDate: string | null | undefined): string | null {
  if (isoOrDate == null || typeof isoOrDate !== "string") return null;
  const t = isoOrDate.trim();
  if (t.length < 10) return null;
  return t.slice(0, 10);
}

/** Lexicographic compare works for ISO YYYY-MM-DD. */
export function isCalendarDateOnOrAfter(
  candidate: string | null,
  boundary: string | null
): boolean {
  if (!boundary) return true;
  if (!candidate) return false;
  return candidate >= boundary;
}

/**
 * When the assessment occurred for filtering: prefer explicit due date,
 * otherwise the assignment row creation date (calendar).
 */
export function gradebookAssignmentAssessmentDateKey(a: {
  due_date: string | null;
  created_at: string;
}): string | null {
  const due = calendarDateKey(a.due_date ?? undefined);
  if (due) return due;
  return calendarDateKey(a.created_at);
}

export function gradebookAssignmentIsOnOrAfterEnrollment(
  a: { due_date: string | null; created_at: string },
  enrollmentDate: string | null | undefined
): boolean {
  const boundary = calendarDateKey(enrollmentDate ?? undefined);
  if (!boundary) return true;
  const assess = gradebookAssignmentAssessmentDateKey(a);
  if (!assess) return true;
  return isCalendarDateOnOrAfter(assess, boundary);
}

/** Report card “released to parent” date for filtering (approved cards only in parent UI). */
export function reportCardReleaseCalendarKey(row: {
  approved_at: string | null;
  updated_at: string;
  created_at?: string | null;
}): string | null {
  const a = calendarDateKey(row.approved_at ?? undefined);
  if (a) return a;
  const u = calendarDateKey(row.updated_at);
  if (u) return u;
  return calendarDateKey(row.created_at ?? undefined);
}

export function reportCardIsOnOrAfterEnrollment(
  row: {
    approved_at: string | null;
    updated_at: string;
    created_at?: string | null;
  },
  enrollmentDate: string | null | undefined
): boolean {
  const boundary = calendarDateKey(enrollmentDate ?? undefined);
  if (!boundary) return true;
  const rel = reportCardReleaseCalendarKey(row);
  if (!rel) return true;
  return isCalendarDateOnOrAfter(rel, boundary);
}

export const PARENT_NO_RESULTS_AFTER_ENROLLMENT =
  "No results available for this student yet.";

export const PARENT_NO_REPORT_CARDS_AVAILABLE = "No report cards available";
