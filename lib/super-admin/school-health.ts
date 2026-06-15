/**
 * Super Admin school health score (0–100) and category labels.
 * See weighted components in computeSchoolHealthScore().
 */

export type SchoolHealthCategory =
  | "excellent"
  | "healthy"
  | "at_risk"
  | "inactive";

export interface SchoolHealthInput {
  studentCount: number;
  teacherCount: number;
  adminCount?: number;
  hasOperationalData?: boolean;
  recentStudentActivity: boolean;
  recentTeacherActivity: boolean;
  daysSinceLastLogin: number | null;
  recentAcademicActivity: boolean;
  recentFinanceActivity: boolean;
  reportCardCount?: number;
  syllabusActivityCount?: number;
  paymentCount?: number;
  feeStructureCount?: number;
  attendanceCount?: number;
}

export interface SchoolHealthResult {
  score: number;
  category: SchoolHealthCategory;
  label: string;
}

export function schoolHealthCategory(score: number): SchoolHealthCategory {
  if (score >= 90) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 40) return "at_risk";
  return "inactive";
}

export function schoolHealthCategoryLabel(category: SchoolHealthCategory): string {
  switch (category) {
    case "excellent":
      return "Excellent";
    case "healthy":
      return "Healthy";
    case "at_risk":
      return "At Risk";
    case "inactive":
      return "Inactive";
  }
}

export function schoolHealthBadgeClass(category: SchoolHealthCategory): string {
  switch (category) {
    case "excellent":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50";
    case "healthy":
      return "bg-blue-50 text-blue-800 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/50";
    case "at_risk":
      return "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40";
    case "inactive":
      return "bg-red-50 text-red-800 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50";
  }
}

function loginPoints(daysSinceLastLogin: number | null): number {
  if (daysSinceLastLogin === null) return 0;
  if (daysSinceLastLogin <= 7) return 20;
  if (daysSinceLastLogin <= 30) return 12;
  if (daysSinceLastLogin <= 60) return 5;
  return 0;
}

/** Weighted: students 30, teachers 20, logins 20, academic 15, finance 15. */
export function computeSchoolHealthScore(
  input: SchoolHealthInput
): SchoolHealthResult {
  let studentPoints = 0;
  if (input.studentCount > 0) {
    studentPoints = input.recentStudentActivity ? 30 : 15;
  }

  const staffCount = input.teacherCount + (input.adminCount ?? 0);
  let teacherPoints = 0;
  if (staffCount > 0) {
    teacherPoints = input.recentTeacherActivity ? 20 : 10;
  }

  let loginScore = loginPoints(input.daysSinceLastLogin);
  if (loginScore === 0 && staffCount > 0) {
    loginScore = 5;
  }

  let academicScore = 0;
  if (input.recentAcademicActivity) {
    academicScore = 15;
  } else if (
    (input.reportCardCount ?? 0) > 0 ||
    (input.syllabusActivityCount ?? 0) > 0
  ) {
    academicScore = 8;
  }

  let financeScore = 0;
  if (input.recentFinanceActivity) {
    financeScore = 15;
  } else if (
    (input.paymentCount ?? 0) > 0 ||
    (input.feeStructureCount ?? 0) > 0
  ) {
    financeScore = 8;
  }

  let score = Math.min(
    100,
    Math.round(
      studentPoints + teacherPoints + loginScore + academicScore + financeScore
    )
  );

  const hasOperational =
    input.hasOperationalData ??
    (input.studentCount > 0 ||
      input.teacherCount > 0 ||
      (input.paymentCount ?? 0) > 0 ||
      (input.feeStructureCount ?? 0) > 0 ||
      (input.reportCardCount ?? 0) > 0 ||
      (input.syllabusActivityCount ?? 0) > 0 ||
      (input.attendanceCount ?? 0) > 0);

  if (!hasOperational) {
    score = Math.min(score, 20);
  }

  const category = schoolHealthCategory(score);

  return {
    score,
    category,
    label: schoolHealthCategoryLabel(category),
  };
}

export function formatSchoolLastActivity(
  iso: string | null | undefined
): string {
  if (!iso) return "No activity recorded";
  const updated = new Date(iso);
  if (Number.isNaN(updated.getTime())) return "No activity recorded";
  const days = Math.floor((Date.now() - updated.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function daysSinceIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
