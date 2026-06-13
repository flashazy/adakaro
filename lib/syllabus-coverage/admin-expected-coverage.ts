import type { AdminSyllabusSchoolTermDates } from "@/lib/syllabus-coverage/admin-dashboard-types";

function elapsedPercentInRange(start: Date, end: Date, now: Date): number {
  if (now < start) return 0;
  if (now > end) return 100;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.round(((now.getTime() - start.getTime()) / total) * 100);
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function termRange(
  term: string,
  dates: AdminSyllabusSchoolTermDates,
  academicYear: string
): { start: Date; end: Date } | null {
  const year = Number.parseInt(academicYear, 10);
  if (!Number.isFinite(year)) return null;

  if (term === "Term 1") {
    const start = parseDate(dates.term1Start) ?? new Date(year, 0, 1);
    const end = parseDate(dates.term1End) ?? new Date(year, 3, 30, 23, 59, 59, 999);
    return { start, end };
  }
  if (term === "Term 2") {
    const start = parseDate(dates.term2Start) ?? new Date(year, 4, 1);
    const end = parseDate(dates.term2End) ?? new Date(year, 7, 31, 23, 59, 59, 999);
    return { start, end };
  }
  if (term === "Term 3") {
    const start = parseDate(dates.term3Start) ?? new Date(year, 8, 1);
    const end = parseDate(dates.term3End) ?? new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

/** Academic-year timeline expected completion (Jan 1 – Dec 31). */
export function computeAcademicYearExpectedPercent(academicYear: string): number {
  const year = Number.parseInt(academicYear, 10);
  if (!Number.isFinite(year)) return 0;

  const now = new Date();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  return elapsedPercentInRange(yearStart, yearEnd, now);
}

/**
 * Expected coverage from academic year, optional term, and school term dates.
 * Uses planned lesson timeline (elapsed time in term or year).
 */
export function computeAdminExpectedCoveragePercent(
  academicYear: string,
  term: string | null | undefined,
  termDates: AdminSyllabusSchoolTermDates
): number {
  const normalizedTerm = term?.trim();
  if (normalizedTerm && normalizedTerm !== "All Terms") {
    const range = termRange(normalizedTerm, termDates, academicYear);
    if (range) {
      return elapsedPercentInRange(range.start, range.end, new Date());
    }
  }
  return computeAcademicYearExpectedPercent(academicYear);
}
