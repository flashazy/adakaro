export const CLASS_ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "sick",
  "permitted",
] as const;

export type ClassAttendanceStatus = (typeof CLASS_ATTENDANCE_STATUSES)[number];

export const CLASS_ATTENDANCE_STATUS_LABELS: Record<ClassAttendanceStatus, string> =
  {
    present: "Present",
    absent: "Absent",
    late: "Late",
    sick: "Sick",
    permitted: "Permitted",
  };

/** Max length for optional per-student class_attendance.notes (plain text). */
export const CLASS_ATTENDANCE_NOTE_MAX_LENGTH = 300;

export interface ClassAttendanceStudentRow {
  id: string;
  fullName: string;
  admissionNumber: string | null;
  avatarUrl: string | null;
  status: ClassAttendanceStatus;
  notes: string | null;
}

export interface ClassAttendanceDaySummary {
  present: number;
  absent: number;
  late: number;
  sick: number;
  permitted: number;
}

export interface ClassAttendanceHistoryRow {
  attendanceDate: string;
  summary: ClassAttendanceDaySummary;
  totalStudents: number;
}

export interface ClassAttendanceTodaySummary {
  total: number;
  /** Present + Late (in class). */
  inClass: number;
  /** Absent + Sick + Permitted (not in class). */
  notInClass: number;
  late: number;
  percentPresent: number;
}

export interface ClassAttendancePageData {
  classId: string;
  className: string;
  schoolId: string;
  attendanceDate: string;
  hasRecordsForDate: boolean;
  history: ClassAttendanceHistoryRow[];
  totalClassStudents: number;
  /** Rollup for the selected date (all active students). Null if nothing recorded yet. */
  daySummary: ClassAttendanceDaySummary | null;
}

export interface ClassAttendanceStudentsPageData {
  students: ClassAttendanceStudentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}
