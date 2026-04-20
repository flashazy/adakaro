/**
 * Row-size options (5–50) and per-surface localStorage keys for dashboard
 * and teacher lists (students, classes, subjects, teachers, report cards).
 */
export const STUDENT_LIST_ROW_OPTIONS = [5, 10, 15, 20, 25, 50] as const;

export type StudentListRowOption = (typeof STUDENT_LIST_ROW_OPTIONS)[number];

export const DASHBOARD_STUDENTS_ROWS_STORAGE_KEY =
  "adakaro:dashboardStudents:rowsPerPage";

export const TEACHER_STUDENTS_ROWS_STORAGE_KEY =
  "adakaro:teacherDashboardStudents:rowsPerPage";

export const DASHBOARD_CLASSES_ROWS_STORAGE_KEY =
  "adakaro:dashboardClasses:rowsPerPage";

export const DASHBOARD_SUBJECTS_ROWS_STORAGE_KEY =
  "adakaro:dashboardSubjects:rowsPerPage";

export const DASHBOARD_TEACHERS_ASSIGNMENTS_ROWS_STORAGE_KEY =
  "adakaro:dashboardTeachers:assignments:rowsPerPage";

export const DASHBOARD_TEACHERS_ACCOUNTS_ROWS_STORAGE_KEY =
  "adakaro:dashboardTeachers:accounts:rowsPerPage";

export const TEACHER_REPORT_CARDS_STUDENT_LIST_ROWS_STORAGE_KEY =
  "adakaro:teacherReportCards:studentList:rowsPerPage";

export const DASHBOARD_FEE_TYPES_ROWS_STORAGE_KEY =
  "adakaro:dashboardFeeTypes:rowsPerPage";

export const DASHBOARD_FEE_STRUCTURES_ROWS_STORAGE_KEY =
  "adakaro:dashboardFeeStructures:rowsPerPage";

export const RECORD_PAYMENT_STUDENTS_ROWS_STORAGE_KEY =
  "adakaro:recordPayment:students:rowsPerPage";

export const APPROVED_CONNECTIONS_ROWS_STORAGE_KEY =
  "adakaro:approvedConnections:rowsPerPage";

export const PENDING_APPROVALS_ROWS_STORAGE_KEY =
  "adakaro:pendingApprovals:rowsPerPage";

export const TEAM_MEMBERS_ROWS_STORAGE_KEY =
  "adakaro:teamMembers:rowsPerPage";

export const TEACHER_ASSIGNMENTS_ROWS_STORAGE_KEY =
  "adakaro:teacherAssignments:rowsPerPage";

export function parseStudentListRowsPerPage(
  raw: string | null
): StudentListRowOption | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return (STUDENT_LIST_ROW_OPTIONS as readonly number[]).includes(n)
    ? (n as StudentListRowOption)
    : null;
}
