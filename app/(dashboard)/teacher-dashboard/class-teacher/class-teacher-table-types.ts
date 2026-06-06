/** Row shapes for class-teacher dashboard tables (shared server + client). */

export type ClassTeacherStudentParentRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  /** Semicolon-separated when multiple guardians are linked. */
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  /**
   * First linked parent id for deep links to Messages (one icon per row).
   * Null when the student has no linked parent.
   */
  linkedParentId: string | null;
  /** Class-teacher health / excused flag (ill, permitted). */
  healthStatus: "ill" | "permitted" | null;
};

export type ClassTeacherAttendanceRow = {
  id: string;
  studentId: string;
  attendanceDate: string;
  status: string;
  subjectName: string;
  studentName: string;
  recordedByName: string | null;
};

export type ClassTeacherGradeRow = {
  studentId: string;
  studentName: string;
  subject: string;
  assignmentTitle: string;
  maxScore: number;
  score: string | null;
  teacherName: string | null;
};
